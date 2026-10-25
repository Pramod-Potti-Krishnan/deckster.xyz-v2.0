// Toolbar template picker fix-forward (frontend-2, FRONTEND-2 bug 4). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (exact "true", Studio shell only, default
// off): the flag that renders the toolbar's "Template ▾" picker (components/studio-template-workspace/picker.tsx, "Start from a template").
//
// The bug: that picker listed only this tab's template uploads (sessionStorage), so on Studio dev it said "No templates yet" while the account had composer
// library uploads (the composer's template popup had the same root cause, P0 #380: it listed the old saved-template records, off in dev). The fix reuses
// #380's mechanism: the picker lists the composer library's own list (`loadComposerTemplates`, the library dialog's request) and hands an action
// (Use original, Rebuild from own content, New topic) to the library dialog, which runs it with its own handlers (the page's request state, the dialog's
// `request` prop). "Template library" opens that dialog; /studio/templates is linked only where it works.
//
// Run: node scripts/test-studio-toolbar-template-list.mjs   (plain node: transpile + vm, no network, no timers that matter, no writes)
//   TOOLBAR_TEMPLATES_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-toolbar-template-list.mjs
//     re-prints the flag-off goldens below from the base sources (origin/studio-v4-dev-preparation-code at fcf99ab, before this change).
//
// What is proved, on the REAL sources (picker.tsx, studio-composer-popups.ts, composer-library.ts, the library dialog, template-picker.tsx for the
// composer popup, and page.tsx / presentation-area.tsx / presentation-viewer.tsx by AST):
//   - composer library off (no callbacks): the picker renders byte-for-byte as the base's (real React server render over a matrix of states), except that
//     "Template library" no longer links the disabled /studio/templates;
//   - the list is the composer popup's: one request, identical to the library dialog's, made only while the popover is open for a signed-in user;
//   - every action (Use original, Rebuild, New topic) hands the page the same request the composer popup hands it, and the library dialog then makes
//     exactly the requests, writes and navigation of its own buttons (compared in order, for every template);
//   - empty / loading / failed / signed-out / stale states are explained; the library link; keyboard and search;
//   - the page, the area and the viewer pass the callbacks only with the flag and a composer library, and every check fails for the mutation it guards.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (SPEED-PERCEIVED)

const treeRoot = process.env.TOOLBAR_TEMPLATES_ROOT
  ? path.resolve(process.env.TOOLBAR_TEMPLATES_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const nodeRequire = createRequire(path.join(treeRoot, 'package.json'))
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const refuse = () => { throw new Error('toolbar-templates fixture refuses services and writes') }
const PICKER = 'components/studio-template-workspace/picker.tsx'
const TEMPLATE_PICKER = 'components/builder/template-picker.tsx'
const DIALOG = 'components/builder/composer-library-dialog.tsx'
const DROPDOWN = 'components/theme-dropdown-picker.tsx'
const PAGE = 'app/builder/page.tsx'
const AREA = 'components/builder/presentation-area.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const ENTRY = 'components/studio-template-workspace/entry.tsx'
const STATE = 'lib/studio-template-workspace/state.ts'
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

// ---- module loader: transpile repo files (optionally with in-memory mutations) and run them in a vm ---------------------------------------------
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
    useSyncExternalStore: (_subscribe, get) => get(),
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
/** Render a stateful root again and again while its async work (requests, polling) runs to the end. */
async function drain(runtime, Component, props, turns = 40) {
  let tree = runtime.render(Component, props())
  for (let i = 0; i < turns; i++) { await tick(); tree = runtime.render(Component, props()) }
  return tree
}

// ---- fixtures ---------------------------------------------------------------------------------------------------------------------------------
const OWNER = 'local-owner'
const LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const SESSION = 'fresh-session-0001'
// Shaped like the QA account's two composer uploads (live read, 13 Oct: Northwind 30 slides, J1 6 slides): the dialog's own record shape.
const COMPOSER_TEMPLATES = [
  { id: 'cmp-northwind', name: 'Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [cmp-northwind]', slide_count: 30, stage_template_summary: { slide_count: 30, schema_version: 'composer-template-v1' } },
  { id: 'cmp-j1', name: 'J1-rollout-40-stores.pptx — upload 2026-10-12 22:21 UTC [cmp-j1]', slide_count: 6, stage_template_summary: { slide_count: 6 } },
  { id: 'cmp odd/id', name: 'Odd id', slide_count: 3 },
]
const COMPOSER_ENV = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' }
const ON_ENV = { [SHELL]: 'true', [FLAG]: 'true', ...COMPOSER_ENV }

/** The services the composer library uses, faked and recorded: every fetch, session create, sessionStorage write and navigation, in order. */
function composerServices({ templates = COMPOSER_TEMPLATES, listStatus = 200, pending = null, auth = true, listDelay = null } = {}) {
  const log = []
  const store = new Map(pending ? [[`deckster_composer_job_${encodeURIComponent(OWNER)}`, JSON.stringify(pending)]] : [])
  const answer = (status, data) => ({ ok: status < 400, status, json: async () => data })
  let lastUse = null
  let held = Boolean(pending)
  let failNext = 0
  const fetch = async (url, init = {}) => {
    log.push(['fetch', url, { method: init.method, cache: init.cache, signal: init.signal ? 'AbortSignal' : init.signal ?? null, headers: init.headers ?? null, body: init.body ?? null }])
    const route = url.replace('/api/composer-library/', '')
    if (route === 'templates' && init.method === 'GET') {
      if (failNext > 0) { failNext -= 1; return answer(503, { error: 'Template library is not configured.' }) }
      return answer(listStatus, listStatus < 400 ? { templates } : { error: 'Template library is not configured.' })
    }
    const use = /^templates\/([^/]+)\/use$/.exec(route)
    if (use && init.method === 'POST') { lastUse = { templateId: decodeURIComponent(use[1]), sessionId: JSON.parse(init.body).session_id }; return answer(202, { job_id: 'job-use-1', status: 'queued' }) }
    const job = /^jobs\/([^/]+)$/.exec(route)
    if (job && init.method === 'GET' && job[1] === 'job-use-1') return answer(200, { job_id: 'job-use-1', status: 'complete', checkpoint: { result: { session_id: lastUse.sessionId, template_id: lastUse.templateId, presentation_id: 'deck-1', viewer_url: `${LAYOUT}/p/deck-1`, slide_count: 9 } } })
    if (job && init.method === 'GET') return answer(200, held ? { job_id: job[1], status: 'running', stage: 'preparing' } : { job_id: job[1], status: 'complete' })
    return answer(404, { error: 'Not found' })
  }
  const globals = {
    // One Error for every module, as in the browser (each module here runs in its own vm realm): the dialog and the picker both test `instanceof Error`.
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
  return { log, store, globals, stubs, release: () => { held = false }, failNext: count => { failNext = count } }
}
function collapse(log) { return log.filter((entry, i) => i === 0 || ser(entry) !== ser(log[i - 1])) }

const BASE_STUBS = runtime => ({
  react: runtime.react, 'react/jsx-runtime': jsxRuntime,
  'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
  '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  'next/link': { default: 'a' },
})
const cnOf = node => node?.props?.className ?? ''

// ---- the toolbar picker, mounted for real: real picker.tsx, the real list module, the real search rule; the workspace's uploads are a fixture --------
function mountPicker({ env = ON_ENV, services = composerServices(), userKey = OWNER, uploads = [], mutate = {}, loaderStubs = {} } = {}) {
  const runtime = createRuntime()
  const stubs = {
    ...BASE_STUBS(runtime),
    '@/components/ui/popover': { Popover: 'Popover', PopoverContent: 'PopoverContent', PopoverTrigger: 'PopoverTrigger' },
    '@/lib/theme-builder': { isValidThemeHex: () => true },
    '@/lib/theme-fonts': { ensureThemeFontStylesheet() {}, themeFontCss: () => '', themeFontFields: () => ({}) },
    ...loaderStubs,
  }
  const loader = createLoader({ env, stubs, globals: services.globals, mutate })
  const state = loader.load(STATE)
  stubs['@/components/theme-dropdown-picker'] = loader.load(DROPDOWN)
  stubs['./shared'] = {
    SlideView: 'SlideView', uploadedAgo: () => 'uploaded today',
    useTemplateWorkspaceUserKey: () => userKey,
    useTemplateWorkspaceRecords: () => uploads,
    useTemplateWorkspaceSnapshots: (_key, records) => records.map(record => ({ record, store: { commands: {} }, snapshot: { state: state.initialTemplateWorkspaceState('job-1'), fixture: null, sourceKind: 'director' } })),
  }
  const { StudioTemplatePicker } = loader.load(PICKER)
  return { runtime, StudioTemplatePicker, services, loader }
}
const upload = (id, name = 'Tidewell-QBR-master-2026.pptx') => ({ v: 1, session_id: id, file_name: name, file_size: 1000, created_at: 1_760_000_000_000 })
const rowsOf = tree => flat(tree).filter(n => n.props?.role === 'option')
const optionLabels = tree => rowsOf(tree).map(n => text(n))
const popoverOf = tree => flat(tree).find(n => n.type === 'Popover')
const noteOf = tree => flat(tree).find(n => n.props?.['data-studio-template-composer-note'])
const actionsOf = tree => flat(tree).filter(n => n.props?.['data-studio-template-composer-action'])
const libraryOf = tree => flat(tree).find(n => n.props?.['data-studio-template-action'] === 'library' || (n.type === 'a' && n.props?.href === '/studio/templates'))
const ev = (key = '', over = {}) => { const e = { key, prevented: false, preventDefault() { e.prevented = true }, target: { value: '' }, ...over }; return e }

/** Mount, open the popover (as Radix does: onOpenChange(true)), and let the list request settle. */
async function openedPicker(options = {}, props = {}) {
  const world = mountPicker(options)
  const callbacks = []
  const libraryCalls = []
  const base = () => ({ onComposerTemplateAction: request => callbacks.push(plain(request)), onOpenComposerLibrary: () => libraryCalls.push('library'), ...props })
  const render = props_ => () => ({ ...base(), ...props_ })
  let tree = world.runtime.render(world.StudioTemplatePicker, base())
  popoverOf(tree).props.onOpenChange(true)
  tree = await drain(world.runtime, world.StudioTemplatePicker, base, 6)
  return { ...world, base, tree, callbacks, libraryCalls, redraw: async (turns = 3) => (await drain(world.runtime, world.StudioTemplatePicker, base, turns)), render }
}

// ---- the composer's template popup (real template-picker.tsx), for the parity snapshot ----------------------------------------------------------
function mountPopup({ env = ON_ENV, services = composerServices(), mutate = {} } = {}) {
  const runtime = createRuntime()
  const stubs = {
    ...BASE_STUBS(runtime),
    '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger', DropdownMenuItem: 'DropdownMenuItem', DropdownMenuLabel: 'DropdownMenuLabel', DropdownMenuSeparator: 'DropdownMenuSeparator' },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    './studio-composer-hint': { StudioComposerHint: ({ children }) => children },
    '@/lib/theme-builder': { isValidThemeHex: () => true },
    '@/lib/theme-fonts': { ensureThemeFontStylesheet() {}, themeFontCss: () => '', themeFontFields: () => ({}) },
  }
  const loader = createLoader({ env, stubs, globals: services.globals, mutate })
  const real = loader.load('hooks/use-templates.ts')
  stubs['@/hooks/use-templates'] = { ...real, useTemplates: () => ({ loading: false, listTemplates: async () => ({ templates: [], count: 0 }), reoptimizeTemplate: refuse, watchTemplateStatus: () => () => {} }) }
  stubs['@/components/theme-dropdown-picker'] = { ...loader.load(DROPDOWN), ThemeDropdownPicker: props => jsx('ThemeDropdownPicker', props) }
  return { runtime, ComposerTemplatePopupBody: loader.load(TEMPLATE_PICKER).ComposerTemplatePopupBody, services }
}
/** What the composer popup hands the page when a template is picked and its action clicked. */
async function popupRequest(action, templateId, options = {}) {
  const world = mountPopup(options)
  const requests = []
  let closed = 0
  const props = () => ({ onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose: () => { closed += 1 },
    onOpenLibrary() {}, onComposerAction: request => requests.push(plain(request)), composerUserId: OWNER })
  let tree = await drain(world.runtime, world.ComposerTemplatePopupBody, props, 6)
  flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect(`composer:${templateId}`)
  tree = await drain(world.runtime, world.ComposerTemplatePopupBody, props, 2)
  flat(tree).find(n => n.props?.['data-studio-template-composer-action'] === action).props.onClick()
  return { requests, closed, log: world.services.log }
}
/** What the toolbar picker hands the page for the same template and action. */
async function toolbarRequest(action, templateId, options = {}, mutatePicker = {}) {
  const picker = await openedPicker({ ...options, mutate: mutatePicker })
  let tree = picker.tree
  rowsOf(tree).find(n => n.props['data-studio-template-composer-option'] === templateId).props.onClick()
  tree = await picker.redraw(2)
  actionsOf(tree).find(n => n.props['data-studio-template-composer-action'] === action).props.onClick()
  tree = await picker.redraw(2)
  return { requests: picker.callbacks, open: popoverOf(tree).props.open, log: picker.services.log }
}

// ---- the page: its elements, by AST --------------------------------------------------------------------------------------------------------------
const createElement = (type, props, ...children) => ({ type, props: { ...(props ?? {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) }, key: props?.key })
function compileJsx(source, label) {
  const out = ts.transpileModule(`var __el = (${source});`, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React, alwaysStrict: false } })
  deq((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), [], `${label} compiles`)
  // eslint-disable-next-line no-new-func
  const factory = new Function('scope', `with (scope) { ${out.outputText}\nreturn __el }`)
  return scope => factory({ React: { createElement }, ...scope })
}
/** Every JSX element named `tag` in `source`: its attributes (name -> text) and the text of each spread. */
function elementsOf(source, tag, file = 'x.tsx') {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const found = []
  const visit = node => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      if (opening.tagName.getText(sf) === tag) {
        const props = opening.attributes.properties
        found.push({ node: node.getText(sf), attrs: props.filter(ts.isJsxAttribute).map(p => p.getText(sf)), spreads: props.filter(ts.isJsxSpreadAttribute).map(p => p.expression.getText(sf)) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}
function oneElement(source, tag) { const found = elementsOf(source, tag); assert.equal(found.length, 1, `exactly one <${tag}> in the source`); return found[0] }
/** The initialiser of `const <name> = ...` in a function component body. */
function constInit(source, name) {
  const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let out = null
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name && node.initializer) out = node.initializer.getText(sf); ts.forEachChild(node, visit) }
  visit(sf)
  assert.ok(out, `const ${name} in the source`)
  return out
}
const FIX = /onComposerTemplateAction|onOpenComposerLibrary|onRequestTaken/
/** A mutated copy of a source: the target must exist, or the mutant would silently test nothing. */
const mut = (source, from, to) => { assert.ok(source.includes(from), `mutation target missing: ${from.slice(0, 70)}`); return source.replace(from, to) }
// Sibling flag-gated attributes that later merged PRs add to the same elements. Each is proven inert flag-off by its own test,
// so this pin ignores them like the fix's own spreads (scope: #382 chat PR D, NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT ->
// ChatInput studioContextLabel; flag-off value proven by scripts/test-studio-chat-composer-recovery-answered.mjs).
// + NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB -> ChatInput pausedInOtherTab and PresentationArea studioTabPausedHint (false / undefined unless the tab is
// paused; flag-off equality with the base: scripts/test-studio-one-live-tab.mjs --base-root).
// + PASS2B J1-10 (NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT) -> ChatInput studioEditPrompt (`studioEditPromptActive || undefined`: undefined flag off; scripts/test-studio-pass2b-chat.mjs).
// + PASS2B G09 (NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE) -> PresentationArea studioBriefSent (`undefined` unless the flag is exactly "true" in the Studio shell;
// flag-off equality: scripts/test-studio-first-run-poster-hide.mjs).
const SIBLING_FLAG_ATTR = /^(studioContextLabel|pausedInOtherTab|studioTabPausedHint|studioEditPrompt|studioBriefSent)=/
// + PASS2B J2-04 (NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS) -> PresentationArea addSlideV2Settings: `includeJobId: STUDIO_ADD_SLIDE_STATUS_ENABLED` in the
// createAddSlideV2Hooks call and a `status: STUDIO_ADD_SLIDE_STATUS_ENABLED ? createAddSlideV2StatusSettings({...}) : undefined` entry. Both are false /
// undefined flag-off (scripts/test-studio-add-slide-status.mjs); cut out here, the attribute is the base's byte for byte.
const SIBLING_SETTINGS_ENTRIES = [
  /\n[ \t]*\/\/ PASS2B J2-04 [^\n]*\n[ \t]*includeJobId: STUDIO_ADD_SLIDE_STATUS_ENABLED,/,
  /\n[ \t]*\/\/ PASS2B J2-04 [^\n]*\n[ \t]*\/\/ [^\n]*\n[ \t]*status: STUDIO_ADD_SLIDE_STATUS_ENABLED \? createAddSlideV2StatusSettings\(\{[\s\S]*?\}\) : undefined,/,
]
const withoutSiblingEntries = attr => SIBLING_SETTINGS_ENTRIES.reduce((text, entry) => text.replace(entry, ''), attr)
const withoutFix = element => [...element.attrs.filter(a => !SIBLING_FLAG_ATTR.test(a)).map(withoutSiblingEntries), ...element.spreads.filter(s => !FIX.test(s))].join('\n')

// ---- library dialog helpers (the dialog's own buttons are the reference) --------------------------------------------------------------------------
function mountDialog({ env, services, mutate = {} }) {
  const runtime = createRuntime()
  const stubs = { ...BASE_STUBS(runtime), '@/components/ui/button': { Button: 'Button' }, '@/components/ui/textarea': { Textarea: 'Textarea' }, ...services.stubs }
  const loader = createLoader({ env, stubs, globals: services.globals, mutate })
  return { runtime, ComposerLibraryDialog: loader.load(DIALOG).ComposerLibraryDialog }
}
/** The library dialog's own button (as a person clicks it), recording everything that leaves. */
async function dialogOwnAction({ action, templateId, brief, pending = null, mutate = {} }) {
  const services = composerServices({ pending })
  const { runtime, ComposerLibraryDialog } = mountDialog({ env: ON_ENV, services, mutate })
  const props = () => ({ open: true, onOpenChange() {} })
  let tree = await drain(runtime, ComposerLibraryDialog, props, 6)
  const record = flat(tree).find(n => n.props?.['data-studio-composer-record'] === templateId)
  assert.ok(record, `the dialog lists ${templateId}`)
  const button = flat(record).find(n => n.props?.['data-studio-composer-action'] === action)
  if (!button.props.disabled) button.props.onClick()
  tree = await drain(runtime, ComposerLibraryDialog, props, 6)
  if (action === 'new-topic' && brief !== undefined) {
    flat(tree).find(n => n.props?.id === 'composer-new-brief').props.onChange({ target: { value: brief } })
    tree = await drain(runtime, ComposerLibraryDialog, props, 2)
    flat(tree).find(n => n.props?.['data-studio-composer-action'] === 'create').props.onClick()
  }
  services.release()
  tree = await drain(runtime, ComposerLibraryDialog, props, 40)
  return { log: collapse(services.log), tree, buttonDisabled: Boolean(button.props.disabled) }
}
/** The toolbar, end to end on the real sources: page.tsx's wiring -> the area -> the picker -> page.tsx's callback and dialog element -> the dialog. */
async function toolbarAction({ action, templateId, brief, pending = null, mutate = {}, page = read(PAGE), pickerMutate = {} }) {
  const pageState = { request: null, show: false }
  const pageScope = () => ({ studioPopupsV2: false, studioTemplateWorkspace: true, composerLibraryEnabled: true, showComposerLibrary: pageState.show, composerLibraryRequest: pageState.request,
    setShowComposerLibrary: v => { pageState.show = v }, setComposerLibraryRequest: v => { pageState.request = v }, ComposerLibraryDialog: 'ComposerLibraryDialog' })
  const area = oneElement(page, 'PresentationArea')
  const fixSpread = area.spreads.filter(s => FIX.test(s))
  assert.equal(fixSpread.length, 1, 'page.tsx hands PresentationArea the callbacks through one spread')
  const scope = pageScope()
  scope.runComposerTemplateAction = compileJsx(constInit(page, 'runComposerTemplateAction'), 'runComposerTemplateAction')(scope)
  const fromPage = compileJsx(fixSpread[0], 'PresentationArea spread')(scope)
  // the picker (real) gets what the page hands down, is opened, a template picked, its action clicked
  const picker = mountPicker({ env: ON_ENV, services: composerServices(), mutate: pickerMutate })
  let tree = picker.runtime.render(picker.StudioTemplatePicker, fromPage)
  popoverOf(tree).props.onOpenChange(true)
  tree = await drain(picker.runtime, picker.StudioTemplatePicker, () => fromPage, 6)
  rowsOf(tree).find(n => n.props['data-studio-template-composer-option'] === templateId).props.onClick()
  tree = await drain(picker.runtime, picker.StudioTemplatePicker, () => fromPage, 2)
  actionsOf(tree).find(n => n.props['data-studio-template-composer-action'] === action).props.onClick()
  // the page opens the library dialog with the request (the element from page.tsx), and the dialog runs it
  const services = composerServices({ pending })
  const { runtime, ComposerLibraryDialog } = mountDialog({ env: ON_ENV, services, mutate })
  const dialogProps = () => compileJsx(oneElement(page, 'ComposerLibraryDialog').node, 'dialog element')(pageScope()).props
  const shown = pageState.show
  const picked = pageState.request
  tree = await drain(runtime, ComposerLibraryDialog, dialogProps, 6)
  if (action === 'new-topic' && brief !== undefined) {
    flat(tree).find(n => n.props?.id === 'composer-new-brief').props.onChange({ target: { value: brief } })
    tree = await drain(runtime, ComposerLibraryDialog, dialogProps, 2)
    flat(tree).find(n => n.props?.['data-studio-composer-action'] === 'create').props.onClick()
  }
  services.release()
  tree = await drain(runtime, ComposerLibraryDialog, dialogProps, 40)
  return { log: collapse(services.log), tree, pickerLog: picker.services.log, fromPage, shown, picked, pageState, popoverOpen: popoverOf(await drain(picker.runtime, picker.StudioTemplatePicker, () => fromPage, 2)).props.open }
}

// ---- the flag-off render: the picker as React renders it ------------------------------------------------------------------------------------------
/** Real React, real react-dom/server: the picker's markup (the popover content always shown) for one state. */
function serverMarkup({ env, uploads = [], userKey = OWNER }) {
  const React = nodeRequire('react')
  const { renderToStaticMarkup } = nodeRequire('react-dom/server')
  const stubs = {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
    'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : props => React.createElement('svg', { 'data-icon': String(name), ...(props?.className ? { className: props.className } : {}) }) }),
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    'next/link': { default: ({ href, children, prefetch, ...rest }) => React.createElement('a', { href, ...rest }, children) },
    '@/components/ui/popover': {
      Popover: ({ children }) => React.createElement('div', { 'data-popover': '' }, children),
      PopoverTrigger: ({ children }) => children,
      PopoverContent: ({ children, onOpenAutoFocus, portalContainer, align, sideOffset, ...rest }) => React.createElement('div', rest, children),
    },
    '@/lib/theme-builder': { isValidThemeHex: () => true },
    '@/lib/theme-fonts': { ensureThemeFontStylesheet() {}, themeFontCss: () => '', themeFontFields: () => ({}) },
  }
  const loader = createLoader({ env, stubs, globals: { fetch: refuse, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [1_760_100_000_000])) } static now() { return 1_760_100_000_000 } } } })
  const state = loader.load(STATE)
  stubs['@/components/theme-dropdown-picker'] = loader.load(DROPDOWN)
  stubs['./shared'] = {
    SlideView: ({ index }) => React.createElement('i', { 'data-slide': index }), uploadedAgo: () => 'uploaded today',
    useTemplateWorkspaceUserKey: () => userKey,
    useTemplateWorkspaceRecords: () => uploads,
    useTemplateWorkspaceSnapshots: (_key, records) => records.map(record => ({ record, store: { commands: {} }, snapshot: { state: state.initialTemplateWorkspaceState('job-1'), fixture: null, sourceKind: 'director' } })),
  }
  const { StudioTemplatePicker } = loader.load(PICKER)
  return renderToStaticMarkup(React.createElement(StudioTemplatePicker, { disabled: false, triggerClassName: 'tb', labelClassName: 'lb', onUploadTemplate: () => {}, onSaveTemplate: () => {}, templateMode: { on: false, available: true, toggle() {} } }))
}
const MATRIX = [
  { name: 'no uploads, signed in', uploads: [] },
  { name: 'one upload converting', uploads: [upload('s-1')] },
  { name: 'two uploads', uploads: [upload('s-1'), upload('s-2', 'Northwind QBR.pptx')] },
  { name: 'signed out', uploads: [], userKey: null },
]
const markupHash = (env, matrix = MATRIX) => sha(matrix.map(item => `${item.name}:${sha(serverMarkup({ env, ...item }))}`).join('\n'))
const LINK_HTML = /<a href="\/studio\/templates">.*?<\/a>/

// ---- goldens: the BASE's flag-off picker (printed from a pristine base checkout with PRINT_GOLDEN=1) ----------------------------------------
const GOLDEN = {
  // the picker with the composer library off, the Templates page enabled (its link kept): every state of MATRIX
  pickerOffTemplatesPage: '445898fc665ebf28a4652e80ffa197235c6d94b25611b19328c51d164e903b70',
  // the same, with the page disabled: the base's markup with the one disabled link removed is what the fix renders
  pickerOffNoPage: 'b50f822f6ac0f6cf01703d607344f1bf2bdf5779376947e22ba87f4197527727',
  // PresentationArea's JSX attributes and the page's dialog element, without the fix's own props
  areaWiring: 'de762e153d76de53e9d7640ad2c2636db1d1ae2fd685da2ff2550eb366763e2b',
  dialogWiring: '4200f055e57c5aedeea66e1a9a6f3dc7552f5c7daf72a81c5258f6e8e7438a4b',
  chatInputWiring: 'cc14cd479d12c8a7060a516b03badf75c58797cc83ab9a1e73541876b728361f',
}
function wiringHashes(root = treeRoot) {
  const page = stripLaterChanges(PAGE, fs.readFileSync(path.join(root, PAGE), 'utf8')) // LATER-CHANGES: registry read (SPEED-PERCEIVED): a registered later change's marked lines come out first (an unmarked line still counts)
  return {
    areaWiring: sha(withoutFix(oneElement(page, 'PresentationArea'))),
    dialogWiring: sha(withoutFix(oneElement(page, 'ComposerLibraryDialog'))),
    chatInputWiring: sha(withoutFix(oneElement(page, 'ChatInput'))),
  }
}
const OFF_ENV_PAGE = { [SHELL]: 'true', [FLAG]: 'true', NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true' }
const OFF_ENV_NOPAGE = { [SHELL]: 'true', [FLAG]: 'true' }
const stripLink = html => html.replace(LINK_HTML, '')
const noPageHash = () => sha(MATRIX.map(item => `${item.name}:${sha(stripLink(serverMarkup({ env: OFF_ENV_PAGE, ...item })))}`).join('\n'))

if (process.env.PRINT_GOLDEN) {
  console.log(JSON.stringify({ pickerOffTemplatesPage: markupHash(OFF_ENV_PAGE), pickerOffNoPage: noPageHash(), ...wiringHashes() }, null, 2))
  process.exit(0)
}

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try { await fn() } catch (error) { console.error(`FAIL: ${name}`); throw error }
}
const mutants = []   // [name, async () => void] each must THROW
const mutant = (name, fn) => mutants.push([name, fn])

// ================================================================================================================================================
// The flag, and flag off
// ================================================================================================================================================
await run('the picker is behind the same flag as before (exact "true", Studio shell only); this change adds no new flag', () => {
  const entry = read(ENTRY)
  assert.match(entry, /export const StudioTemplatePicker: ComponentType<StudioTemplatePickerProps> =\n  process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'/)
  const page = read(PAGE)
  assert.match(page, /const studioTemplateWorkspace = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'/)
  assert.equal((page.match(/NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE/g) ?? []).length, 2, 'the page reads the flag once (and names it once in a comment)')
  assert.doesNotMatch(read(PICKER), /NEXT_PUBLIC_STUDIO_TOOLBAR_TEMPLATES/)
})

await run('composer library off (no callbacks): the picker renders as the base did, over every state, except that "Template library" never links the disabled /studio/templates', () => {
  assert.equal(markupHash(OFF_ENV_PAGE), GOLDEN.pickerOffTemplatesPage, 'the Templates page enabled: the link stays, the markup is the base\'s byte for byte')
  assert.equal(noPageHash(), GOLDEN.pickerOffNoPage, 'the base\'s markup without its one disabled link')
  for (const item of MATRIX) {
    const html = serverMarkup({ env: OFF_ENV_NOPAGE, ...item })
    assert.doesNotMatch(html, /\/studio\/templates/, `${item.name}: no link to the disabled page`)
    assert.equal(html, stripLink(serverMarkup({ env: OFF_ENV_PAGE, ...item })), `${item.name}: otherwise identical`)
  }
})

await run('the page hands PresentationArea, ChatInput and the library dialog exactly what it did before, except the fix\'s own props', () => {
  deq(wiringHashes(), { areaWiring: GOLDEN.areaWiring, dialogWiring: GOLDEN.dialogWiring, chatInputWiring: GOLDEN.chatInputWiring })
})

await run('flag off or no composer library: the page passes nothing new to the area, and the dialog gets a request only for a composer popup or the toolbar picker', () => {
  const page = read(PAGE)
  const area = oneElement(page, 'PresentationArea')
  const fix = area.spreads.filter(s => FIX.test(s))
  assert.equal(fix.length, 1)
  const make = (studioTemplateWorkspace, composerLibraryEnabled) => {
    const scope = { studioTemplateWorkspace, composerLibraryEnabled, setShowComposerLibrary() {}, setComposerLibraryRequest() {} }
    scope.runComposerTemplateAction = () => {}
    return compileJsx(fix[0], 'spread')(scope)
  }
  deq(Object.keys(make(false, false)), []); deq(Object.keys(make(false, true)), []); deq(Object.keys(make(true, false)), [])
  deq(Object.keys(make(true, true)), ['onComposerTemplateAction', 'onOpenComposerLibrary'])
  const dialog = oneElement(page, 'ComposerLibraryDialog')
  const dialogSpread = dialog.spreads.filter(s => /onRequestTaken/.test(s))
  assert.equal(dialogSpread.length, 1)
  const request = (studioPopupsV2, studioTemplateWorkspace) => Object.keys(compileJsx(dialogSpread[0], 'dialog spread')({ studioPopupsV2, studioTemplateWorkspace, composerLibraryRequest: null, setComposerLibraryRequest() {} }))
  deq(request(false, false), []); deq(request(true, false), ['request', 'onRequestTaken']); deq(request(false, true), ['request', 'onRequestTaken']); deq(request(true, true), ['request', 'onRequestTaken'])
})

await run('the area and the viewer pass the two props on unchanged, and only when given (the viewer\'s element keys are the base\'s without them)', () => {
  const areaViewer = oneElement(read(AREA), 'PresentationViewer')
  const spread = areaViewer.spreads.filter(s => FIX.test(s))
  deq(spread, ['(onComposerTemplateAction ? { onComposerTemplateAction, onOpenComposerLibrary } : {})'])
  const picker = oneElement(read(VIEWER), 'StudioTemplatePicker')
  assert.ok(picker.attrs.includes('onComposerTemplateAction={onComposerTemplateAction}'))
  assert.ok(picker.attrs.includes('onOpenComposerLibrary={onOpenComposerLibrary}'))
  const flagged = read(VIEWER).split("process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' ? <>\n                {tabPausedWrap(<StudioTemplatePicker")
  assert.equal(flagged.length, 2, 'the picker is still rendered only inside the workspace flag\'s branch')
})

// ================================================================================================================================================
// The list
// ================================================================================================================================================
await run('the picker lists the composer library\'s own list: one request, identical to the library dialog\'s and to the composer popup\'s, made only while open, signed in, with a composer library', async () => {
  const dialog = await dialogOwnAction({ action: 'use', templateId: 'cmp-j1' })
  const dialogList = dialog.log.filter(e => e[0] === 'fetch' && e[1].endsWith('/templates'))[0]
  deq(dialogList, ['fetch', '/api/composer-library/templates', { method: 'GET', cache: 'no-store', signal: null, headers: null, body: null }])
  const popup = await popupRequest('use', 'cmp-j1')
  deq(popup.log, [dialogList], 'the composer popup\'s request is the dialog\'s')
  const picker = await openedPicker()
  deq(picker.services.log, [dialogList], 'the toolbar picker\'s request is the dialog\'s: one request, no other')
  deq(optionLabels(picker.tree), COMPOSER_TEMPLATES.map(t => `${t.name}${t.stage_template_summary?.slide_count ?? t.slide_count ?? 0} slides`), 'the dialog\'s records, names and slide counts, in its order')
  // readiness: closed, signed out, no composer library -> no request
  const closed = mountPicker()
  const props = () => ({ onComposerTemplateAction() {}, onOpenComposerLibrary() {} })
  await drain(closed.runtime, closed.StudioTemplatePicker, props, 4)
  deq(closed.services.log, [], 'closed: no request')
  const signedOut = await openedPicker({ userKey: null })
  deq(signedOut.services.log, [], 'signed out: no request')
  assert.match(text(signedOut.tree), /Sign in to see your templates\./)
  const bare = mountPicker()
  let tree = bare.runtime.render(bare.StudioTemplatePicker, {})
  popoverOf(tree).props.onOpenChange(true)
  await drain(bare.runtime, bare.StudioTemplatePicker, () => ({}), 4)
  deq(bare.services.log, [], 'no composer library: no request')
  // closing again drops an answer that has not arrived, as the popup does
  const reopened = await openedPicker()
  popoverOf(reopened.tree).props.onOpenChange(false)
  await reopened.redraw(3)
  assert.equal(reopened.services.log.length, 1, 'closing does not request again')
})
mutant('the picker reads another list (a different path)', async () => {
  const picker = await openedPicker({ services: composerServices() }, {})
  deq(picker.services.log[0][1], '/api/composer-library/templates')
  const other = mountPicker({ mutate: { 'lib/studio-composer-popups.ts': [["composerRequest<{ templates: ComposerTemplate[] }>('templates')", "composerRequest<{ templates: ComposerTemplate[] }>('templates?all=1')"]] } })
  const props = () => ({ onComposerTemplateAction() {}, onOpenComposerLibrary() {} })
  popoverOf(other.runtime.render(other.StudioTemplatePicker, props())).props.onOpenChange(true)
  await drain(other.runtime, other.StudioTemplatePicker, props, 4)
  deq(other.services.log[0][1], '/api/composer-library/templates')
})
mutant('the picker lists while closed (the readiness rule is dropped)', async () => {
  const world = mountPicker({ mutate: { [PICKER]: [['useComposerTemplates(Boolean(onComposerTemplateAction && open && userKey))', 'useComposerTemplates(Boolean(onComposerTemplateAction))']] } })
  const props = () => ({ onComposerTemplateAction() {}, onOpenComposerLibrary() {} })
  await drain(world.runtime, world.StudioTemplatePicker, props, 4)
  deq(world.services.log, [])
})
mutant('the picker lists for a signed-out user', async () => {
  const world = mountPicker({ userKey: null, mutate: { [PICKER]: [['useComposerTemplates(Boolean(onComposerTemplateAction && open && userKey))', 'useComposerTemplates(Boolean(onComposerTemplateAction && open))']] } })
  const props = () => ({ onComposerTemplateAction() {}, onOpenComposerLibrary() {} })
  popoverOf(world.runtime.render(world.StudioTemplatePicker, props())).props.onOpenChange(true)
  await drain(world.runtime, world.StudioTemplatePicker, props, 4)
  deq(world.services.log, [])
})

await run('composer templates are listed first, then this tab\'s uploads; the first is selected and its actions are the dialog\'s (labels and flags); a workspace upload keeps its own control', async () => {
  const picker = await openedPicker({ uploads: [upload('s-1')] })
  const labels = optionLabels(picker.tree)
  assert.equal(labels.length, COMPOSER_TEMPLATES.length + 1)
  assert.match(labels[0], /Northwind/); assert.match(labels[1], /J1-rollout/); assert.match(labels[3], /Tidewell QBR master 2026/)
  assert.match(text(flat(picker.tree).find(n => n.type === 'h3')), /Start from a template\s*4/, 'the count covers both lists')
  const selected = rowsOf(picker.tree).map(n => n.props['aria-selected'])
  deq(selected, [true, false, false, false], 'the first template is selected')
  deq(actionsOf(picker.tree).map(n => [n.props['data-studio-template-composer-action'], text(n), n.props.disabled]), [['use', 'Use original', false], ['ditto', 'Rebuild from own content', false], ['new-topic', 'New topic', false]])
  assert.equal(flat(picker.tree).some(n => text(n) === 'Start presentation' || (n.type === 'button' && /^Start presentation/.test(text(n)))), false, 'no dead Start button beside the actions')
  // the preview says what the template is
  assert.match(text(flat(picker.tree).find(n => n.props?.['aria-label'] === 'Preview of the selected template')), /30 slides · from your template library/)
  // picking the upload brings back its own preview and Start button (disabled: Director gives it no command yet), and no composer actions
  rowsOf(picker.tree)[3].props.onClick()
  const after = await picker.redraw(2)
  assert.equal(actionsOf(after).length, 0)
  const start = flat(after).find(n => n.type === 'button' && /^Start presentation/.test(text(n)))
  assert.ok(start && start.props.disabled === true)
  assert.match(text(flat(after).find(n => n.props?.['aria-label'] === 'Preview of the selected template')), /Still converting/)
  // the actions follow the dialog's flags
  for (const [name, env, expected] of [['both off', { ...ON_ENV, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'false', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'false' }, ['use']],
    ['rebuild only', { ...ON_ENV, NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'false' }, ['use', 'ditto']], ['topic only', { ...ON_ENV, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'false' }, ['use', 'new-topic']]]) {
    const opened = await openedPicker({ env })
    deq(actionsOf(opened.tree).map(n => n.props['data-studio-template-composer-action']), expected, name)
  }
})
mutant('the keyboard walks the uploads before the composer templates (the first match is the wrong row)', async () => {
  const world = await openedPicker({ uploads: [upload('s-1')], mutate: { [PICKER]: [['const visibleKeys = [...visibleComposer.map(row => row.key), ...visible.map(entry => entry.record.session_id)]', 'const visibleKeys = [...visible.map(entry => entry.record.session_id), ...visibleComposer.map(row => row.key)]']] } })
  flat(world.tree).find(n => n.props?.role === 'combobox').props.onChange({ target: { value: 'qbr' } })
  const tree = await world.redraw(2)
  assert.equal(rowsOf(tree).length, 2)
  assert.equal(rowsOf(tree)[0].props['data-active'], 'true', 'the first drawn match is the highlighted one')
})
mutant('the dead Start button stays beside the composer actions', async () => {
  const world = await openedPicker({ mutate: { [PICKER]: [['{selectedComposer ? (\n              <div className="stw-picker-actions"', '{false ? (\n              <div className="stw-picker-actions"']] } })
  assert.ok(actionsOf(world.tree).length > 0)
})

await run('the search rule, arrows and Enter are the workspace picker\'s own, over both lists', async () => {
  const picker = await openedPicker({ uploads: [upload('s-1')] })
  const input = () => flat(picker.tree).find(n => n.props?.role === 'combobox')
  // typing narrows both lists; "no match" when nothing is left
  input().props.onChange({ target: { value: 'north' } })
  let tree = await picker.redraw(2)
  assert.equal(rowsOf(tree).length, 1); assert.match(optionLabels(tree)[0], /Northwind/)
  assert.equal(rowsOf(tree)[0].props['data-active'], 'true', 'the first match is highlighted')
  input().props.onChange({ target: { value: 'qbr' } })
  tree = await picker.redraw(2)
  assert.equal(rowsOf(tree).length, 2, 'a word in both lists matches in both'); assert.equal(rowsOf(tree)[0].props['data-active'], 'true', 'the first drawn match is highlighted')
  input().props.onChange({ target: { value: 'zzz' } })
  tree = await picker.redraw(2)
  assert.match(text(tree), /No templates match “zzz”\./)
  input().props.onChange({ target: { value: '' } })
  tree = await picker.redraw(2)
  // arrows move across both lists, Enter picks
  const key = k => { const e = ev(k); flat(tree).find(n => n.props?.role === 'combobox').props.onKeyDown(e); return e }
  key('ArrowDown'); tree = await picker.redraw(2)
  assert.equal(rowsOf(tree).findIndex(n => n.props['data-active'] === 'true'), 1)
  key('ArrowDown'); tree = await picker.redraw(2); key('ArrowDown'); tree = await picker.redraw(2)
  assert.equal(rowsOf(tree).findIndex(n => n.props['data-active'] === 'true'), 3, 'down into the uploads')
  assert.equal(key('Enter').prevented, true); tree = await picker.redraw(2)
  assert.equal(actionsOf(tree).length, 0, 'the upload is now selected: no composer actions')
  key('ArrowUp'); tree = await picker.redraw(2); key('Enter'); tree = await picker.redraw(2)
  assert.equal(actionsOf(tree).length, 3, 'back on a composer template: its actions')
  assert.equal(flat(tree).find(n => n.props?.role === 'combobox').props['aria-activedescendant'], 'local-id-opt-composer:cmp odd/id')
})

// ================================================================================================================================================
// States in plain words
// ================================================================================================================================================
await run('empty, loading, failed (with Try again), stale and signed-out states each say why', async () => {
  // empty list: the library is empty and there are no uploads
  const empty = await openedPicker({ services: composerServices({ templates: [] }) })
  assert.match(text(empty.tree), /No templates yet\. Upload a PowerPoint in the template library and Deckster turns it into a template you can reuse here\./)
  assert.equal(noteOf(empty.tree).props['data-studio-template-composer-note'], 'ready')
  // loading: before the first answer
  const loading = mountPicker()
  const props = () => ({ onComposerTemplateAction() {}, onOpenComposerLibrary() {} })
  popoverOf(loading.runtime.render(loading.StudioTemplatePicker, props())).props.onOpenChange(true)
  const first = loading.runtime.render(loading.StudioTemplatePicker, props())
  assert.match(text(first), /Loading your templates…/)
  assert.equal(flat(first).find(n => n.props?.['data-studio-template-composer-note'] === 'loading').props.role, 'status')
  // failed first load: the reason, and Try again requests again and then shows the list
  const services = composerServices()
  services.failNext(1)
  const failed = await openedPicker({ services })
  const alert = flat(failed.tree).find(n => n.props?.role === 'alert')
  assert.match(text(alert), /Your templates could not be loaded: Template library is not configured\./)
  const retry = flat(alert).find(n => n.type === 'button')
  assert.equal(text(retry), 'Try again')
  assert.equal(flat(failed.tree).some(n => n.props?.['data-studio-template-composer-note'] === 'ready'), false, 'no "No templates yet" under a failure')
  retry.props.onClick()
  const recovered = await failed.redraw(4)
  assert.equal(rowsOf(recovered).length, 3)
  deq(services.log.filter(e => e[0] === 'fetch').length, 2, 'Try again requests once more')
  // a refresh that fails keeps the last list and says so
  const stale = await openedPicker()
  stale.services.failNext(1)
  popoverOf(stale.tree).props.onOpenChange(false); await stale.redraw(2)
  popoverOf(stale.tree).props.onOpenChange(true)
  const again = await stale.redraw(6)
  assert.equal(rowsOf(again).length, 3, 'the last loaded list stays')
  assert.match(text(flat(again).find(n => n.props?.['data-studio-template-composer-note'] === 'stale')), /Your templates could not be refreshed: Template library is not configured\. Showing the last loaded list\./)
  // with uploads present a failure does not hide them
  const withUpload = await openedPicker({ services: composerServices({ listStatus: 503 }), uploads: [upload('s-1')] })
  assert.equal(rowsOf(withUpload.tree).length, 1); assert.ok(flat(withUpload.tree).some(n => n.props?.role === 'alert'))
})
mutant('a failed list is reported as empty', async () => {
  const world = await openedPicker({ services: composerServices({ listStatus: 503 }), mutate: { [PICKER]: [["composerList.templates === null ? (composerList.error ? 'failed' as const : 'loading' as const)", "composerList.templates === null ? ('ready' as const)"]] } })
  assert.ok(flat(world.tree).some(n => n.props?.role === 'alert'))
})

// ================================================================================================================================================
// Template library link
// ================================================================================================================================================
await run('"Template library" opens the working library dialog; /studio/templates is linked only where saved templates are enabled; never the disabled page', async () => {
  const picker = await openedPicker()
  const link = flat(picker.tree).find(n => n.props?.['data-studio-template-action'] === 'library')
  assert.equal(link.type, 'button'); assert.equal(link.props.href, undefined)
  link.props.onClick()
  deq(picker.libraryCalls, ['library'], 'the dialog is opened')
  assert.equal(popoverOf(await picker.redraw(2)).props.open, false, 'the popover closes')
  // no library callback: the page link, but only where that page works
  for (const [tb, expected] of [['true', '/studio/templates'], [undefined, undefined]]) {
    const world = mountPicker({ env: { ...ON_ENV, ...(tb ? { NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: tb } : {}) } })
    const tree = world.runtime.render(world.StudioTemplatePicker, {})
    assert.equal(libraryOf(tree)?.props.href, expected)
    if (!expected) assert.equal(flat(tree).some(n => /studio\/templates/.test(String(n.props?.href ?? ''))), false)
  }
  // with a library, the dialog wins even where the page is enabled
  const both = await openedPicker({ env: { ...ON_ENV, NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true' } })
  assert.equal(libraryOf(both.tree).type, 'button')
})
mutant('"Template library" links the disabled page', async () => {
  const world = mountPicker({ mutate: { [PICKER]: [["const library = templateLibraryTarget({ composerLibrary: Boolean(onOpenComposerLibrary), templatesPage: TEMPLATES_PAGE_ENABLED })", "const library = 'page' as const"]] } })
  const tree = world.runtime.render(world.StudioTemplatePicker, { onOpenComposerLibrary() {} })
  assert.equal(libraryOf(tree).type, 'button')
})

// ================================================================================================================================================
// Actions: parity with the composer popup and the library dialog
// ================================================================================================================================================
const ACTIONS = ['use', 'ditto', 'new-topic']
await run('snapshot: every action hands the page exactly the request the composer popup hands it ({ action, template } with the record the list returned), and closes the popover', async () => {
  const snapshot = {}
  for (const action of ACTIONS) for (const template of COMPOSER_TEMPLATES) {
    const popup = await popupRequest(action, template.id)
    const toolbar = await toolbarRequest(action, template.id)
    deq(toolbar.requests, popup.requests, `${action} ${template.id}: the same request`)
    deq(toolbar.requests, [{ action, template }], `${action} ${template.id}: ${'{ action, template }'}, the listed record untouched`)
    assert.equal(popup.closed, 1); assert.equal(toolbar.open, false, 'the toolbar popover closes, as the composer popup does')
    snapshot[`${action}|${template.id}`] = sha(ser(toolbar.requests))
  }
  assert.equal(Object.keys(snapshot).length, 9)
  // a snapshot of one of them, written out
  deq((await toolbarRequest('use', 'cmp-j1')).requests, [{ action: 'use', template: COMPOSER_TEMPLATES[1] }])
  deq((await toolbarRequest('ditto', 'cmp-northwind')).requests, [{ action: 'ditto', template: COMPOSER_TEMPLATES[0] }])
  deq((await toolbarRequest('new-topic', 'cmp odd/id')).requests, [{ action: 'new-topic', template: COMPOSER_TEMPLATES[2] }])
})
mutant('the picker hands over another template than the one picked', async () => {
  const toolbar = await toolbarRequest('use', 'cmp-j1', {}, { [PICKER]: [['onClick={() => runComposerAction({ action, template: selectedComposer.template })}', 'onClick={() => runComposerAction({ action, template: composerRows[0].template })}']] })
  deq(toolbar.requests, [{ action: 'use', template: COMPOSER_TEMPLATES[1] }])
})
mutant('Use original is handed as Rebuild', async () => {
  const toolbar = await toolbarRequest('use', 'cmp-j1', {}, { [PICKER]: [['onClick={() => runComposerAction({ action, template: selectedComposer.template })}', "onClick={() => runComposerAction({ action: 'ditto', template: selectedComposer.template })}"]] })
  deq(toolbar.requests, [{ action: 'use', template: COMPOSER_TEMPLATES[1] }])
})
mutant('the popover stays open after an action', async () => {
  const toolbar = await toolbarRequest('use', 'cmp-j1', {}, { [PICKER]: [['const runComposerAction = (request: ComposerLibraryRequest) => { setOpen(false); onComposerTemplateAction?.(request) }', 'const runComposerAction = (request: ComposerLibraryRequest) => { onComposerTemplateAction?.(request) }']] })
  assert.equal(toolbar.open, false)
})

await run('end to end: Use original and Rebuild from the toolbar make exactly the requests the library dialog\'s own buttons make (session, use payload, job polling, ready record, navigation), for every listed template', async () => {
  for (const action of ['use', 'ditto']) {
    for (const template of COMPOSER_TEMPLATES) {
      const off = await dialogOwnAction({ action, templateId: template.id })
      const on = await toolbarAction({ action, templateId: template.id })
      deq(on.pickerLog.map(e => e[1]), ['/api/composer-library/templates'], 'the picker only lists')
      deq(on.log, off.log, `${action} ${template.id}: every request, write and navigation`)
      assert.equal(ser(on.tree), ser(off.tree), `${action} ${template.id}: the dialog ends in the same state`)
      const posted = off.log.find(e => e[0] === 'fetch' && e[2].method === 'POST')
      assert.equal(posted[1], `/api/composer-library/templates/${encodeURIComponent(template.id)}/use`)
      assert.equal(posted[2].body, action === 'use' ? JSON.stringify({ session_id: SESSION }) : JSON.stringify({ session_id: SESSION, mode: 'ditto' }))
      deq(off.log.find(e => e[0] === 'createSession'), ['createSession', SESSION, action === 'use' ? `Template: ${template.name}` : `Rebuild: ${template.name}`])
      deq(off.log.at(-1), ['location.assign', `/builder?session_id=${SESSION}`])
      assert.equal(on.shown, true); assert.equal(on.pageState.request, null, 'the request was taken (cleared) once'); assert.equal(on.popoverOpen, false)
    }
  }
})
await run('end to end: New topic from the toolbar opens the dialog\'s topic box for that template, and Create deck then sends the same brief', async () => {
  const brief = 'Quarterly results for the board: revenue up 12 percent, two new regions, hiring plan for next year.'
  const offOpen = await dialogOwnAction({ action: 'new-topic', templateId: 'cmp-northwind' })
  const onOpen = await toolbarAction({ action: 'new-topic', templateId: 'cmp-northwind' })
  assert.equal(ser(onOpen.tree), ser(offOpen.tree), 'the same dialog, with the topic box open for that template')
  assert.ok(flat(onOpen.tree).some(n => n.props?.['data-studio-composer-topic']))
  deq(onOpen.log, offOpen.log, 'opening the box sends nothing beyond the dialog\'s list')
  const off = await dialogOwnAction({ action: 'new-topic', templateId: 'cmp-northwind', brief })
  const on = await toolbarAction({ action: 'new-topic', templateId: 'cmp-northwind', brief })
  deq(on.log, off.log)
  assert.equal(off.log.find(e => e[0] === 'fetch' && e[2].method === 'POST')[2].body, JSON.stringify({ session_id: SESSION, brief }))
})
await run('end to end: a job the dialog resumes on opening keeps running, and the action is dropped, as a click on its disabled buttons is', async () => {
  const pending = { job_id: 'job-upload-9', session_id: 'upload-session-9', kind: 'upload' }
  for (const action of ACTIONS) {
    const off = await dialogOwnAction({ action, templateId: 'cmp-j1', pending })
    assert.equal(off.buttonDisabled, true)
    const on = await toolbarAction({ action, templateId: 'cmp-j1', pending })
    deq(on.log, off.log, `${action}: the same requests as the disabled buttons make (none beyond resuming)`)
    assert.equal(on.log.some(e => e[0] === 'location.assign' && /fresh-session/.test(e[1])), false)
  }
})
mutant('the page hands the toolbar a callback that opens the dialog without the request', async () => {
  const page = mut(read(PAGE), 'const runComposerTemplateAction = (request: ComposerLibraryRequest) => { setComposerLibraryRequest(request); setShowComposerLibrary(true) }', 'const runComposerTemplateAction = (request: ComposerLibraryRequest) => { setShowComposerLibrary(true) }')
  const off = await dialogOwnAction({ action: 'use', templateId: 'cmp-j1' })
  const on = await toolbarAction({ action: 'use', templateId: 'cmp-j1', page })
  deq(on.log, off.log)
})
mutant('the dialog runs Use original as a rebuild', async () => {
  const off = await dialogOwnAction({ action: 'use', templateId: 'cmp-j1' })
  const on = await toolbarAction({ action: 'use', templateId: 'cmp-j1', mutate: { [DIALOG]: [["if (action === 'use') useTemplate(template)", "if (action === 'use') rebuildTemplate(template)"]] } })
  deq(on.log, off.log)
})
mutant('the page gives the dialog no request channel for the toolbar (only for the composer popup)', async () => {
  const page = mut(read(PAGE), 'studioPopupsV2 || studioTemplateWorkspace ? { request: composerLibraryRequest', 'studioPopupsV2 ? { request: composerLibraryRequest')
  const off = await dialogOwnAction({ action: 'use', templateId: 'cmp-j1' })
  const on = await toolbarAction({ action: 'use', templateId: 'cmp-j1', page })
  deq(on.log, off.log)
})
mutant('the page passes the toolbar callbacks without the flag', async () => {
  const page = mut(read(PAGE), '...(studioTemplateWorkspace && composerLibraryEnabled ? {', '...(composerLibraryEnabled ? {')
  const spread = oneElement(page, 'PresentationArea').spreads.find(s => FIX.test(s))
  deq(Object.keys(compileJsx(spread, 'spread')({ studioTemplateWorkspace: false, composerLibraryEnabled: true, setShowComposerLibrary() {}, runComposerTemplateAction() {} })), [])
})
mutant('the area passes the props on even when absent (new keys on every viewer element)', async () => {
  const area = mut(read(AREA), '{...(onComposerTemplateAction ? { onComposerTemplateAction, onOpenComposerLibrary } : {})}', 'onComposerTemplateAction={onComposerTemplateAction}')
  deq(oneElement(area, 'PresentationViewer').spreads.filter(s => FIX.test(s)), ['(onComposerTemplateAction ? { onComposerTemplateAction, onOpenComposerLibrary } : {})'])
})
mutant('the page hands ChatInput an unmarked extra spread (not a registered later change\'s: the wiring hash sees it)', async () => { const page = stripLaterChanges(PAGE, mut(read(PAGE), '<ChatInput\n', '<ChatInput\n                    {...({ extra: 1 })}\n')); deq(sha(withoutFix(oneElement(page, 'ChatInput'))), GOLDEN.chatInputWiring) }) // LATER-CHANGES: registry read (SPEED-PERCEIVED)
mutant('the viewer drops the callbacks (the picker never gets them)', async () => {
  const viewer = mut(read(VIEWER), 'onComposerTemplateAction={onComposerTemplateAction}\n', '')
  assert.ok(oneElement(viewer, 'StudioTemplatePicker').attrs.includes('onComposerTemplateAction={onComposerTemplateAction}'))
})
mutant('flag off, composer library off: the picker renders a different link than the base (the page link dropped where it works)', async () => {
  const mutated = mountPicker({ env: OFF_ENV_PAGE, mutate: { [PICKER]: [["templatesPage: TEMPLATES_PAGE_ENABLED", 'templatesPage: false']] } })
  const tree = mutated.runtime.render(mutated.StudioTemplatePicker, {})
  assert.equal(libraryOf(tree)?.props.href, '/studio/templates')
})

// ================================================================================================================================================
// Mutants
// ================================================================================================================================================
await run(`mutants: each of ${mutants.length} in-memory mutants of the change is caught`, async () => {
  for (const [name, fn] of mutants) {
    let caught = false
    try { await fn() } catch (error) { if (error instanceof MutationTargetMissing) throw error; caught = true }
    assert.ok(caught, `mutant caught: ${name}`)
  }
})

console.log(`PASS: studio toolbar template list (${testCount} tests, ${mutants.length} mutants caught)`)
