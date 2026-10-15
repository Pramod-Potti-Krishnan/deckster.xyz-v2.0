// PASS2B G38 (FRONTEND-2): the template pickers draw a short display name, not the stored upload name. Flag NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES
// (exact "true"), default off.
//   "Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7ure0-...]"  ->  "Deck03 Northwind QBR"   (display only; the full name stays in a title)
//
// Run: node scripts/test-studio-template-display-names.mjs   (plain node: transpile + vm, no network, no timers that matter, no writes)
//   TEMPLATE_DISPLAY_NAMES_BASE=<commit> overrides the base commit the flag-off identity is checked against (default 687b694).
//
// Proven on the REAL sources: lib/studio-template-display-name.ts (standalone, import-free), the toolbar "Template ▾" picker
// (components/studio-template-workspace/picker.tsx), the composer's template popup (components/builder/template-picker.tsx) and the library dialog
// (components/builder/composer-library-dialog.tsx):
//   1. the helper: a table of names (the QA account's two uploads among them), idempotence, never empty, strict-true wrappers, no imports;
//   2. the three components are mounted for real (a small hooks runtime, inert children, the library's requests faked and recorded): flag off, every
//      tree is the base commit's; flag on, only names change (shown short, the full name in a title or the option's hint), the search still matches
//      the stored name, and every payload handed to the page and every request, session title and write the library makes is identical;
//   3. source identity: with the flag-gated display expressions turned back into the base's, each file is the base commit's, and `displayName(` /
//      `nameTitle(` appear only where a name is drawn (never in an id, a request, a payload, a session title or a toast);
//   4. mutation check: every mutant of the four sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripTemplateProgress } from './studio-template-progress-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const BASE_COMMIT = process.env.TEMPLATE_DISPLAY_NAMES_BASE || '687b694'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deq = count(assert.deepStrictEqual)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const plain = value => JSON.parse(JSON.stringify(value))
const refuse = () => { throw new Error('template-display-names fixture refuses services and writes') }

const LIB = 'lib/studio-template-display-name.ts'
const PICKER = 'components/studio-template-workspace/picker.tsx'
const TEMPLATE_PICKER = 'components/builder/template-picker.tsx'
const DIALOG = 'components/builder/composer-library-dialog.tsx'
const DROPDOWN = 'components/theme-dropdown-picker.tsx'
const STATE = 'lib/studio-template-workspace/state.ts'
const SOURCES = { [LIB]: read(LIB), [PICKER]: read(PICKER), [TEMPLATE_PICKER]: read(TEMPLATE_PICKER), [DIALOG]: read(DIALOG) }
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'

const compile = (source, fileName) => {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepStrictEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${fileName} transpiles`)
  return out.outputText
}
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}

// ---------------------------------------------------------------- 1. the helper
const NORTHWIND = 'Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7ure0-0000-4000-8000-n0rthw1nd030]'
const J1 = 'J1-rollout-40-stores.pptx — upload 2026-10-12 22:21 UTC [f1x7ure0-0000-4000-8000-j1r0ll0ut006]'
const NAMES = [
  [NORTHWIND, 'Deck03 Northwind QBR'], [J1, 'J1-rollout-40-stores'],
  ['Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [cmp-northwind]', 'Deck03 Northwind QBR'],
  ['A.pptx — upload 2026-10-12 22:53 UTC [id]', 'A'], ['A.pptx – upload 2026-10-12 22:53 UTC [id]', 'A'], ['A.pptx - upload 2026-10-12 22:53 UTC [id]', 'A'],
  ['A.pptx — upload 2026-10-12 22:53 UTC', 'A'], ['A.pptx — upload 2026-10-12 22:53:10 UTC [id]', 'A'], ['A.pptx — upload 2026-10-12', 'A'], ['A.pptx — upload 2026-10-12 [id]', 'A'],
  ['A.PPTX — UPLOAD 2026-10-12 22:53 UTC [ID]', 'A'], ['A_b.pptx — upload 2026-10-12 22:53 UTC [id]', 'A b'], ['Q3_Übersicht.pptx — upload 2026-10-12 22:53 UTC [i]', 'Q3 Übersicht'],
  ['A [1].pptx — upload 2026-10-12 22:53 UTC [id]', 'A [1]'], ['Plan (v2).pptx — upload 2026-10-12 22:53 UTC [id]', 'Plan (v2)'],
  ['Deck.pptx', 'Deck'], ['DECK.PPTX', 'DECK'], ['deck.ppt', 'deck'], ['deck.potx', 'deck'], ['deck.key', 'deck'], ['deck.odp', 'deck'], ['a.b.pptx', 'a.b'], ['Deck_03.pptx', 'Deck 03'],
  ['Executive briefing', 'Executive briefing'], ['Executive_briefing', 'Executive briefing'], ['Executive briefing · 8 slides', 'Executive briefing · 8 slides'],
  ['Report v2.5', 'Report v2.5'], ['notes.txt', 'notes.txt'], ['notes.pptx.bak', 'notes.pptx.bak'], ['Board deck [draft]', 'Board deck [draft]'], ['Board deck [draft].pptx', 'Board deck [draft]'],
  ['Customer — upload flow', 'Customer — upload flow'], ['Upload 2026-10-12 report', 'Upload 2026-10-12 report'], ['Q3 — upload 2026 plan', 'Q3 — upload 2026 plan'],
  ['A — upload 2026-10-12 22:53 UTC [i] extra', 'A — upload 2026-10-12 22:53 UTC [i] extra'], ['Odd id', 'Odd id'], ['J1', 'J1'],
  ['  A__B   C.pptx  ', 'A B C'], ['A\u00A0B.pptx', 'A B'], ['A\tB.pptx', 'A B'],
  // never empty: everything would go, so the name comes back exactly as given
  ['.pptx', '.pptx'], ['___', '___'], [' — upload 2026-10-12 22:53 UTC [id]', ' — upload 2026-10-12 22:53 UTC [id]'], ['   ', '   '], ['', ''], ['_.pptx', '_.pptx'],
]
const BIG = `${'x'.repeat(1500)} — upload 2026-10-12 22:53 UTC [id]`
function proveLib(lib, label = 'lib', source = SOURCES[LIB]) {
  for (const [name, want] of NAMES) {
    const got = lib.studioTemplateDisplayName(name)
    eq(got, want, `${label}: display name of ${JSON.stringify(name)}`)
    if (name.trim()) ok(got.trim().length > 0, `${label}: never empty for ${JSON.stringify(name)}`)
    eq(lib.studioTemplateShownName(name, false), name, `${label}: flag off is the stored name`)
    eq(lib.studioTemplateShownName(name, true), want, `${label}: flag on is the display name`)
    deq(plain(lib.studioTemplateTitleProps(name, false)), {}, `${label}: no title with the flag off`)
    deq(plain(lib.studioTemplateTitleProps(name, true)), want === name ? {} : { title: name }, `${label}: the full name in a title only when it differs`)
    eq('title' in lib.studioTemplateTitleProps(name, false), false, `${label}: no title key at all with the flag off`)
    for (const notTrue of [undefined, null, 0, 1, '', 'true', 'false', {}]) {
      eq(lib.studioTemplateShownName(name, notTrue), name, `${label}: ${JSON.stringify(notTrue) ?? String(notTrue)} is not a real true`)
      deq(plain(lib.studioTemplateTitleProps(name, notTrue)), {}, `${label}: ${JSON.stringify(notTrue) ?? String(notTrue)} gives no title`)
    }
  }
  // the result of the second pass is the first pass's result for every name that was shortened
  for (const [name] of NAMES) { const once = lib.studioTemplateDisplayName(name); eq(lib.studioTemplateDisplayName(once), once, `${label}: idempotent (${JSON.stringify(name)})`) }
  for (const notString of [null, undefined, 42, {}, [], true]) eq(lib.studioTemplateDisplayName(notString), '', `${label}: ${String(notString)} is not a name`)
  const started = Date.now()
  eq(lib.studioTemplateDisplayName(BIG), BIG, `${label}: a very long string is returned as given`)
  eq(lib.studioTemplateDisplayName(' '.repeat(100000) + ' — upload 2026-10-12'), ' '.repeat(100000) + ' — upload 2026-10-12', `${label}: a long run of spaces is returned as given`)
  ok(Date.now() - started < 1000, `${label}: and quickly`)
  nomatch(source.replace(/^\/\/.*$/gm, ''), /^import |require\(|\bfetch\b|\bDate\b/m, `${label}: standalone and import-free`)
  deq(Object.keys(lib).sort(), ['studioTemplateDisplayName', 'studioTemplateShownName', 'studioTemplateTitleProps'], `${label}: the exports`)
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the components, mounted
class MutationTargetMissing extends Error {}
const transpiled = new Map()
function createLoader({ env = {}, stubs = {}, globals = {}, overrides = {} } = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(repoRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(repoRoot, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(repoRoot, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const rel = path.relative(repoRoot, file)
    const source = overrides[rel] ?? fs.readFileSync(file, 'utf8')
    const key = `${rel}\0${sha(source)}`
    if (!transpiled.has(key)) transpiled.set(key, compile(source, file))
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(repoRoot, rel)) }
}

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
    useLayoutEffect() {}, useSyncExternalStore: (_subscribe, get) => get(), useId: () => 'local-id', Fragment: 'Fragment',
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
  }
}
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
async function drain(runtime, Component, props, turns = 6) {
  let tree = runtime.render(Component, props())
  for (let i = 0; i < turns; i++) { await tick(); tree = runtime.render(Component, props()) }
  return tree
}
// A tree as data: functions as a marker, undefined props dropped (React draws an undefined prop as no attribute), so two trees compare by what they draw.
const norm = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item)

const OWNER = 'local-owner'
const LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const SESSION = 'fresh-session-0001'
const COMPOSER_TEMPLATES = [
  { id: 'cmp-northwind', name: NORTHWIND.replace('[f1x7ure0-0000-4000-8000-n0rthw1nd030]', '[cmp-northwind]'), slide_count: 30, stage_template_summary: { slide_count: 30, schema_version: 'composer-template-v1' } },
  { id: 'cmp-j1', name: J1.replace('[f1x7ure0-0000-4000-8000-j1r0ll0ut006]', '[cmp-j1]'), slide_count: 6, stage_template_summary: { slide_count: 6 } },
  { id: 'cmp odd/id', name: 'Odd id', slide_count: 3 },
]
const SHORT = { 'cmp-northwind': 'Deck03 Northwind QBR', 'cmp-j1': 'J1-rollout-40-stores', 'cmp odd/id': 'Odd id' }
const SAVED_TEMPLATES = [
  { id: 'tp-1', name: 'Quarterly_Review.pptx — upload 2026-10-12 22:30 UTC [tp-1]', description: 'Eight-slide QBR', slide_count: 8, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
  { id: 'tp-2', name: 'Product launch', description: null, slide_count: 12, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
  { id: 'tp-4', name: 'Case_study.pptx — upload 2026-10-12 22:31 UTC [tp-4]', description: 'Failed', slide_count: 6, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'synthetic failure', template_purity_status: 'pending' },
]
const COMPOSER_ENV = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' }
const envFor = value => ({ [SHELL]: 'true', NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE: 'true', ...COMPOSER_ENV, ...(value === undefined ? {} : { [FLAG]: value }) })

function composerServices({ templates = COMPOSER_TEMPLATES } = {}) {
  const log = []
  const answer = (status, data) => ({ ok: status < 400, status, json: async () => data })
  let lastUse = null
  const fetch = async (url, init = {}) => {
    log.push(['fetch', url, { method: init.method, body: init.body ?? null }])
    const route = url.replace('/api/composer-library/', '')
    if (route === 'templates' && init.method === 'GET') return answer(200, { templates })
    const use = /^templates\/([^/]+)\/use$/.exec(route)
    if (use && init.method === 'POST') { lastUse = { templateId: decodeURIComponent(use[1]), sessionId: JSON.parse(init.body).session_id }; return answer(202, { job_id: 'job-use-1', status: 'queued' }) }
    const job = /^jobs\/([^/]+)$/.exec(route)
    if (job && init.method === 'GET') return answer(200, { job_id: job[1], status: 'complete', checkpoint: { result: { session_id: lastUse?.sessionId, template_id: lastUse?.templateId, presentation_id: 'deck-1', viewer_url: `${LAYOUT}/p/deck-1`, slide_count: 9 } } })
    return answer(404, { error: 'Not found' })
  }
  const store = new Map()
  const globals = {
    fetch, URL, AbortController, DOMException, Error,
    setTimeout: callback => { setTimeout(callback, 0); return 1 }, clearTimeout() {},
    crypto: { randomUUID: () => SESSION },
    sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { log.push(['sessionStorage.setItem', key, value]); store.set(key, value) }, removeItem: key => { log.push(['sessionStorage.removeItem', key]); store.delete(key) } },
    window: { location: { assign: url => log.push(['location.assign', url]) } },
  }
  const stubs = {
    '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: OWNER } }) },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession: async (id, title) => { log.push(['createSession', id, title]); return true } }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: refuse },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'allowed' }) },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  }
  return { log, globals, stubs }
}
const BASE_STUBS = runtime => ({
  react: runtime.react, 'react/jsx-runtime': jsxRuntime,
  'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
  '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  'next/link': { default: 'a' },
})
const THEME_STUBS = { '@/lib/theme-builder': { isValidThemeHex: () => true }, '@/lib/theme-fonts': { ensureThemeFontStylesheet() {}, themeFontCss: () => '', themeFontFields: () => ({}) } }

/** The toolbar "Template ▾" picker: real picker.tsx and the real dropdown module; the workspace's own uploads are a fixture. */
function mountPicker({ flag, overrides = {} }) {
  const services = composerServices()
  const runtime = createRuntime()
  const stubs = { ...BASE_STUBS(runtime), '@/components/ui/popover': { Popover: 'Popover', PopoverContent: 'PopoverContent', PopoverTrigger: 'PopoverTrigger' }, ...THEME_STUBS }
  const loader = createLoader({ env: envFor(flag), stubs, globals: services.globals, overrides })
  const state = loader.load(STATE)
  stubs['@/components/theme-dropdown-picker'] = loader.load(DROPDOWN)
  const uploads = [{ v: 1, session_id: 'up-1', file_name: 'Tidewell-QBR-master-2026.pptx', file_size: 1000, created_at: 1_760_000_000_000 }]
  stubs['./shared'] = {
    SlideView: 'SlideView', uploadedAgo: () => 'uploaded today',
    useTemplateWorkspaceUserKey: () => OWNER, useTemplateWorkspaceRecords: () => uploads,
    useTemplateWorkspaceSnapshots: (_key, records) => records.map(record => ({ record, store: { commands: {} }, snapshot: { state: state.initialTemplateWorkspaceState('job-1'), fixture: null, sourceKind: 'director' } })),
  }
  return { runtime, StudioTemplatePicker: loader.load(PICKER).StudioTemplatePicker, services }
}
const rowsOf = tree => flat(tree).filter(n => n.props?.role === 'option')
/** Open the popover as Radix does, then drive it: returns each state's tree and every payload handed to the page. */
async function driveToolbar(options) {
  const world = mountPicker(options)
  const callbacks = [], libraryCalls = []
  const props = () => ({ onComposerTemplateAction: request => callbacks.push(plain(request)), onOpenComposerLibrary: () => libraryCalls.push('library') })
  let tree = world.runtime.render(world.StudioTemplatePicker, props())
  flat(tree).find(n => n.type === 'Popover').props.onOpenChange(true)
  const states = { list: await drain(world.runtime, world.StudioTemplatePicker, props) }
  for (const id of ['cmp-northwind', 'cmp-j1', 'cmp odd/id']) {
    rowsOf(states.list).find(n => n.props['data-studio-template-composer-option'] === id).props.onClick()
    states[`chosen ${id}`] = await drain(world.runtime, world.StudioTemplatePicker, props, 2)
    for (const action of ['use', 'ditto', 'new-topic']) {
      const button = flat(states[`chosen ${id}`]).find(n => n.props?.['data-studio-template-composer-action'] === action)
      if (button) button.props.onClick()
    }
  }
  // the workspace's own upload (the popover is opened again: the actions above closed it), then a search by a word only the stored name holds
  flat(states.list).find(n => n.type === 'Popover').props.onOpenChange(true)
  states.reopened = await drain(world.runtime, world.StudioTemplatePicker, props, 2)
  rowsOf(states.list).find(n => n.props.id?.endsWith('opt-up-1')).props.onClick()
  states.upload = await drain(world.runtime, world.StudioTemplatePicker, props, 2)
  const search = flat(states.upload).find(n => n.type === 'input' && n.props.placeholder === 'Search templates')
  for (const query of ['upload', 'pptx', 'northwind', 'Deck03 Northwind', 'cmp-j1', 'zzz']) {
    search.props.onChange({ target: { value: query } })
    states[`search ${query}`] = await drain(world.runtime, world.StudioTemplatePicker, props, 2)
  }
  return { states, callbacks, libraryCalls, log: world.services.log }
}

/** The composer's template popup (real template-picker.tsx): the dropdown is a recording element so its options can be read. */
function mountPopup({ flag, overrides = {} }) {
  const services = composerServices()
  const runtime = createRuntime()
  const stubs = {
    ...BASE_STUBS(runtime),
    '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger', DropdownMenuItem: 'DropdownMenuItem', DropdownMenuLabel: 'DropdownMenuLabel', DropdownMenuSeparator: 'DropdownMenuSeparator' },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, './studio-composer-hint': { StudioComposerHint: ({ children }) => children }, ...THEME_STUBS,
  }
  const loader = createLoader({ env: envFor(flag), stubs, globals: services.globals, overrides })
  const real = loader.load('hooks/use-templates.ts')
  stubs['@/hooks/use-templates'] = { ...real, useTemplates: () => ({ loading: false, listTemplates: async () => ({ templates: SAVED_TEMPLATES, count: SAVED_TEMPLATES.length }), reoptimizeTemplate: refuse, watchTemplateStatus: () => () => {} }) }
  stubs['@/components/theme-dropdown-picker'] = { ...loader.load(DROPDOWN), ThemeDropdownPicker: props => jsx('ThemeDropdownPicker', props) }
  const mod = loader.load(TEMPLATE_PICKER)
  return { runtime, Body: mod.ComposerTemplatePopupBody, Content: mod.TemplatePickerContent, services }
}
async function drivePopup({ flag, overrides }) {
  const world = mountPopup({ flag, overrides })
  const requests = [], selected = []
  const props = () => ({ onSelect: value => selected.push(plain(value)), open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {},
    onOpenLibrary() {}, onComposerAction: request => requests.push(plain(request)), composerUserId: OWNER })
  const states = { list: await drain(world.runtime, world.Body, props) }
  const mine = tree => flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  for (const option of mine(states.list).props.options) {
    mine(states.list).props.onSelect(option.id)
    states[`chosen ${option.id}`] = await drain(world.runtime, world.Body, props, 3)
    for (const action of ['use', 'ditto', 'new-topic']) {
      const button = flat(states[`chosen ${option.id}`]).find(n => n.props?.['data-studio-template-composer-action'] === action)
      if (button) button.props.onClick()
    }
  }
  return { states, requests, selected, mine, log: world.services.log }
}
/** The saved templates (real TemplatePickerContent as the root): the dropdown's options, then the card list with a preferred template. */
async function driveSaved({ flag, overrides, dropdowns }) {
  const world = mountPopup({ flag, overrides })
  const selected = [], closed = []
  const props = () => ({ onSelect: value => selected.push(plain(value)), isOpen: true, mode: 'generation', label: 'Reuse a template', preferredTemplateId: dropdowns ? null : 'tp-1', standalone: !dropdowns,
    ...(dropdowns ? { dropdowns: { selectedTemplateId: 'tp-2', locked: false, savedTemplates: true, onClose: () => closed.push('close'), onNewTemplate() {} } } : {}) })
  const states = { list: await drain(world.runtime, world.Content, props, 8) }
  if (dropdowns) {
    const mine = flat(states.list).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
    for (const option of mine.props.options) mine.props.onSelect(option.id)
  } else {
    for (const row of flat(states.list).filter(n => n.props?.className === 'stp-main')) row.props.onClick?.()
  }
  return { states, selected, closed, log: world.services.log }
}

/** The library dialog: real composer-library-dialog.tsx; its own buttons are pressed and everything that leaves is recorded. */
async function driveDialog({ flag, overrides }) {
  const services = composerServices()
  const runtime = createRuntime()
  const stubs = { ...BASE_STUBS(runtime), '@/components/ui/button': { Button: 'Button' }, '@/components/ui/textarea': { Textarea: 'Textarea' }, ...services.stubs }
  const loader = createLoader({ env: envFor(flag), stubs, globals: services.globals, overrides })
  const Dialog = loader.load(DIALOG).ComposerLibraryDialog
  const props = () => ({ open: true, onOpenChange() {} })
  const states = { list: await drain(runtime, Dialog, props) }
  for (const template of COMPOSER_TEMPLATES) {
    const record = flat(states.list).find(n => n.props?.['data-studio-composer-record'] === template.id)
    flat(record).find(n => n.props?.['data-studio-composer-action'] === 'use').props.onClick()
    states[`using ${template.id}`] = await drain(runtime, Dialog, props, 40)
  }
  return { states, log: services.log }
}

const textOf = (tree, predicate) => flat(tree).filter(predicate).map(text)
function proveComponents(overrides, lib, label = 'components') {
  const base = {}
  for (const rel of [PICKER, TEMPLATE_PICKER, DIALOG]) { const b = baseSource(rel); if (b) base[rel] = b }
  const haveBase = Object.keys(base).length === 3
  return (async () => {
    const WORK = {}
    // toolbar picker
    const tOff = await driveToolbar({ flag: undefined, overrides })
    const tOn = await driveToolbar({ flag: 'true', overrides })
    if (haveBase) {
      const tBase = await driveToolbar({ flag: undefined, overrides: base })
      for (const state of Object.keys(tBase.states)) eq(norm(tOff.states[state]), norm(tBase.states[state]), `${label}: toolbar "${state}" flag off is the base commit's tree`)
      eq(norm(tOff.callbacks), norm(tBase.callbacks), `${label}: toolbar payloads flag off are the base commit's`)
      eq(norm(tOff.log), norm(tBase.log), `${label}: toolbar requests flag off are the base commit's`)
      for (const flagValue of ['false', 'TRUE', '1', 'yes', '']) {
        const other = await driveToolbar({ flag: flagValue, overrides })
        eq(norm(other.states.list), norm(tBase.states.list), `${label}: toolbar flag ${JSON.stringify(flagValue)} is off`)
      }
    }
    // flag on: names short, full name in the title, search still on the stored name, payloads and requests identical
    eq(norm(tOn.callbacks), norm(tOff.callbacks), `${label}: toolbar payloads handed to the page are identical flag on and off`)
    eq(norm(tOn.log), norm(tOff.log), `${label}: toolbar requests are identical flag on and off`)
    ok(tOn.callbacks.length >= 6, `${label}: the actions were really pressed`)
    const full = Object.fromEntries(COMPOSER_TEMPLATES.map(t => [t.id, t.name]))
    for (const [id, name] of Object.entries(full)) {
      const row = rowsOf(tOn.states.list).find(n => n.props['data-studio-template-composer-option'] === id)
      eq(text(row).startsWith(SHORT[id]), true, `${label}: row ${id} reads ${SHORT[id]}`)
      eq(row.props.title, name, `${label}: row ${id} keeps its full name in the title`)
      nomatch(text(row), /\.pptx|upload|\[cmp/, `${label}: row ${id} shows no extension, upload suffix or id`)
      const chosen = tOn.states[`chosen ${id}`]
      eq(textOf(chosen, n => n.type === 'h4')[0], SHORT[id], `${label}: the preview heading for ${id}`)
      eq(flat(chosen).find(n => n.type === 'h4').props.title, SHORT[id] === name ? undefined : name, `${label}: the preview heading's title for ${id}`)
      eq(flat(chosen).find(n => n.props?.['data-studio-template-composer'] === id).props['aria-label'], `What to do with ${SHORT[id]}`, `${label}: the actions group for ${id}`)
      // the preview's heading in the flag-off tree is the stored name
      eq(textOf(tOff.states[`chosen ${id}`], n => n.type === 'h4')[0], name, `${label}: off, the preview heading is the stored name (${id})`)
    }
    eq(text(rowsOf(tOn.states.upload).find(n => n.props.id?.endsWith('opt-up-1'))), text(rowsOf(tOff.states.upload).find(n => n.props.id?.endsWith('opt-up-1'))), `${label}: the workspace's own upload row reads as before`)
    for (const query of ['upload', 'pptx', 'northwind', 'Deck03 Northwind', 'cmp-j1', 'zzz']) {
      eq(rowsOf(tOn.states[`search ${query}`]).map(n => n.props.id).join('|'), rowsOf(tOff.states[`search ${query}`]).map(n => n.props.id).join('|'), `${label}: the search "${query}" finds the same rows`)
    }
    ok(rowsOf(tOn.states['search upload']).some(n => n.props['data-studio-template-composer-option']), `${label}: a word only the stored name holds still finds the template`)

    // composer popup (the composer library's templates)
    {
      const pOff = await drivePopup({ flag: undefined, overrides })
      const pOn = await drivePopup({ flag: 'true', overrides })
      if (haveBase) {
        const pBase = await drivePopup({ flag: undefined, overrides: base })
        for (const state of Object.keys(pBase.states)) eq(norm(pOff.states[state]), norm(pBase.states[state]), `${label}: popup "${state}" flag off is the base commit's tree`)
        eq(norm(pOff.requests), norm(pBase.requests), `${label}: popup requests flag off`)
      }
      eq(norm(pOn.requests), norm(pOff.requests), `${label}: popup requests identical flag on and off`)
      ok(pOn.requests.length >= 6, `${label}: the popup's actions were really pressed`)
      const offOptions = pOff.mine(pOff.states.list).props.options, onOptions = pOn.mine(pOn.states.list).props.options
      eq(onOptions.length, 3, `${label}: the three library templates`)
      offOptions.forEach((off, index) => {
        const on = onOptions[index]
        eq(off.name, COMPOSER_TEMPLATES[index].name, `${label}: off, the option is the stored name`)
        eq(on.id, off.id, `${label}: option id unchanged ${off.id}`); eq(on.search, off.search, `${label}: option search unchanged ${off.id}`); eq(on.hint, off.hint, `${label}: the tooltip is the full name ${off.id}`)
        eq(on.sub, off.sub, `${label}: option sub unchanged ${off.id}`); eq(on.muted, off.muted, `${label}: option muted unchanged ${off.id}`)
        eq(on.name, SHORT[COMPOSER_TEMPLATES[index].id], `${label}: option name is the display name ${off.id}`)
        eq(on.hint, COMPOSER_TEMPLATES[index].name, `${label}: the full name stays in the option's tooltip ${off.id}`)
      })
      const group = flat(pOn.states['chosen composer:cmp-northwind']).find(n => n.props?.['data-studio-template-composer'] === 'cmp-northwind')
      eq(group.props['aria-label'], 'What to do with Deck03 Northwind QBR', `${label}: popup actions group`)
      const strong = flat(group).find(n => n.type === 'strong')
      eq(text(strong), 'Deck03 Northwind QBR', `${label}: popup chosen name`)
      eq(strong.props.title, COMPOSER_TEMPLATES[0].name, `${label}: popup chosen name keeps the stored name in a title`)
      eq(flat(pOff.states['chosen composer:cmp-northwind']).find(n => n.type === 'strong').props.title, undefined, `${label}: off, no title`)
    }
    // saved templates: the dropdown's options and the card list
    for (const dropdowns of [true, false]) {
      const sOff = await driveSaved({ flag: undefined, overrides, dropdowns })
      const sOn = await driveSaved({ flag: 'true', overrides, dropdowns })
      if (haveBase) {
        const sBase = await driveSaved({ flag: undefined, overrides: base, dropdowns })
        eq(norm(sOff.states.list), norm(sBase.states.list), `${label}: saved (${dropdowns ? 'dropdown' : 'cards'}) flag off is the base commit's tree`)
        eq(norm(sOff.selected), norm(sBase.selected), `${label}: saved selections flag off`)
      }
      eq(norm(sOn.selected), norm(sOff.selected), `${label}: saved selection payloads identical flag on and off (${dropdowns ? 'dropdown' : 'cards'})`)
      eq(norm(sOn.closed), norm(sOff.closed), `${label}: saved close behaviour identical (${dropdowns ? 'dropdown' : 'cards'})`)
      ok(sOn.selected.length >= 2, `${label}: saved templates were really chosen (${dropdowns ? 'dropdown' : 'cards'}): ${sOn.selected.length}`)
      ok(sOn.selected.some(item => item.name?.includes('— upload')), `${label}: the payload still carries the stored name (${dropdowns ? 'dropdown' : 'cards'})`)
      if (dropdowns) {
        const offOptions = flat(sOff.states.list).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.options
        const onOptions = flat(sOn.states.list).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.options
        eq(onOptions.length, SAVED_TEMPLATES.length, `${label}: the saved options`)
        offOptions.forEach((off, index) => {
          const on = onOptions[index], saved = SAVED_TEMPLATES[index]
          eq(off.name, saved.name, `${label}: off, the saved option is the stored name`)
          eq(on.id, off.id, `${label}: saved option id`); eq(on.search, off.search, `${label}: saved option search`); eq(on.sub, off.sub, `${label}: saved option sub`); eq(on.muted, off.muted, `${label}: saved option muted`)
          eq(on.name, lib.studioTemplateDisplayName(saved.name), `${label}: saved option name ${saved.id}`)
          if (on.name !== saved.name) eq(on.hint, `${saved.name} · ${off.hint}`, `${label}: the stored name leads the tooltip ${saved.id}`)
          else eq(on.hint, off.hint, `${label}: an unchanged name keeps its tooltip ${saved.id}`)
        })
        const attention = tree => flat(tree).find(n => n.props?.className === 'stcd-attention-row')
        eq(text(attention(sOff.states.list)).startsWith('Case_study.pptx — upload'), true, `${label}: off, the attention row names the stored name`)
        eq(text(attention(sOn.states.list)).startsWith('Case study'), true, `${label}: on, the attention row names the display name`)
        eq(flat(attention(sOn.states.list)).find(n => n.type === 'strong').props.title, SAVED_TEMPLATES[2].name, `${label}: the attention row keeps the stored name in a title`)
      } else {
        const titles = tree => flat(tree).filter(n => n.props?.className === 'stp-title')
        eq(titles(sOn.states.list).map(text).join('|'), SAVED_TEMPLATES.map(t => lib.studioTemplateDisplayName(t.name)).join('|'), `${label}: card titles`)
        eq(titles(sOff.states.list).map(text).join('|'), SAVED_TEMPLATES.map(t => t.name).join('|'), `${label}: off, card titles are the stored names`)
        eq(titles(sOn.states.list).map(n => n.props.title).join('|'), SAVED_TEMPLATES.map(t => lib.studioTemplateDisplayName(t.name) === t.name ? '' : t.name).join('|'), `${label}: card titles keep the stored names`)
        const notice = tree => flat(tree).find(n => n.props?.className === 'stp-notice')
        eq(text(flat(notice(sOn.states.list)).find(n => n.type === 'strong')), 'From your library: Quarterly Review', `${label}: the preferred-template notice`)
        eq(text(flat(notice(sOff.states.list)).find(n => n.type === 'strong')), `From your library: ${SAVED_TEMPLATES[0].name}`, `${label}: off, the notice is the stored name`)
      }
    }

    // library dialog
    const dOff = await driveDialog({ flag: undefined, overrides })
    const dOn = await driveDialog({ flag: 'true', overrides })
    if (haveBase) {
      const dBase = await driveDialog({ flag: undefined, overrides: base })
      for (const state of Object.keys(dBase.states)) eq(norm(dOff.states[state]), norm(dBase.states[state]), `${label}: dialog "${state}" flag off is the base commit's tree`)
      eq(norm(dOff.log), norm(dBase.log), `${label}: dialog requests flag off`)
    }
    eq(norm(dOn.log), norm(dOff.log), `${label}: dialog requests, session titles and writes are identical flag on and off`)
    ok(dOn.log.some(entry => entry[0] === 'createSession' && String(entry[2]).includes('Deck03_Northwind_QBR.pptx — upload')), `${label}: the session title still carries the stored name`)
    for (const template of COMPOSER_TEMPLATES) {
      const record = flat(dOn.states.list).find(n => n.props?.['data-studio-composer-record'] === template.id)
      const p = flat(record).find(n => n.props?.['data-studio-composer-name'])
      eq(text(p), SHORT[template.id], `${label}: dialog row ${template.id}`)
      eq(p.props.title, template.name, `${label}: dialog row ${template.id} keeps the stored name in its title`)
      const off = flat(flat(dOff.states.list).find(n => n.props?.['data-studio-composer-record'] === template.id)).find(n => n.props?.['data-studio-composer-name'])
      eq(text(off), template.name, `${label}: off, the dialog row is the stored name (${template.id})`)
    }
    return WORK
  })()
}
await proveComponents({}, loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 3. source identity
const HEAD_IMPORT = "import { studioTemplateShownName, studioTemplateTitleProps } from '@/lib/studio-template-display-name'\n"
const HEAD_CONSTS = `// PASS2B G38 (NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES, default off): templates are drawn by a short display name; the full stored name stays in a tooltip and in every payload.
const TEMPLATE_DISPLAY_NAMES = process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES === 'true'
const displayName = (name: string) => studioTemplateShownName(name, TEMPLATE_DISPLAY_NAMES)
const nameTitle = (name: string) => studioTemplateTitleProps(name, TEMPLATE_DISPLAY_NAMES)
`
// the dialog draws a name but never a tooltip (its row already carries the full name in its title), so it needs only the first wrapper
const DIALOG_IMPORT = "import { studioTemplateShownName } from '@/lib/studio-template-display-name'\n"
const DIALOG_CONSTS = HEAD_CONSTS.replace("const nameTitle = (name: string) => studioTemplateTitleProps(name, TEMPLATE_DISPLAY_NAMES)\n", '')
const HEADS = { [TEMPLATE_PICKER]: [HEAD_IMPORT, HEAD_CONSTS], [PICKER]: [HEAD_IMPORT, HEAD_CONSTS], [DIALOG]: [DIALOG_IMPORT, DIALOG_CONSTS] }
// [the G38 text, the base's text] for every display expression
const PAIRS = {
  [TEMPLATE_PICKER]: [
    ["      const note = template.description || templateGenerationUnavailableReason(template)\n      return { id: template.id, name: displayName(template.name), hint: displayName(template.name) !== template.name ? `${template.name} · ${note}` : note, swatches: [], current: false,",
      "      return { id: template.id, name: template.name, hint: template.description || templateGenerationUnavailableReason(template), swatches: [], current: false,"],
    ["({ id: `${COMPOSER_OPTION}${template.id}`, name: displayName(template.name), hint: template.name,", "({ id: `${COMPOSER_OPTION}${template.id}`, name: template.name, hint: template.name,"],
    ["aria-label={`What to do with ${displayName(chosen.name)}`}", "aria-label={`What to do with ${chosen.name}`}"],
    ["<strong {...nameTitle(chosen.name)}>{displayName(chosen.name)}</strong> ·", "<strong>{chosen.name}</strong> ·"],
    ["<span><strong {...nameTitle(template.name)}>{displayName(template.name)}</strong> · {templateGenerationStatusLabel(template)}</span>", "<span><strong>{template.name}</strong> · {templateGenerationStatusLabel(template)}</span>"],
    ['<span className="stp-title" {...nameTitle(template.name)}>{displayName(template.name)}</span>', '<span className="stp-title">{template.name}</span>'],
    ["<strong {...nameTitle(preferred.name)}>From your library: {displayName(preferred.name)}</strong>", "<strong>From your library: {preferred.name}</strong>"],
  ],
  [PICKER]: [
    ['<span className="name"><span>{displayName(row.name)}</span></span>', '<span className="name"><span>{row.name}</span></span>'],
    ['<span className="name"><span {...nameTitle(entry.name)}>{displayName(entry.name)}</span>{fresh &&', '<span className="name"><span>{entry.name}</span>{fresh &&'],
    ["aria-label={`What to do with ${displayName(selectedComposer.name)}`}", "aria-label={`What to do with ${selectedComposer.name}`}"],
    ["      <h4 {...nameTitle(row.name)}>{displayName(row.name)}</h4>", "      <h4>{row.name}</h4>"],
    ["      <h4 {...nameTitle(entry.name)}>{displayName(entry.name)}</h4>", "      <h4>{entry.name}</h4>"],
  ],
  [DIALOG]: [
    ['title={template.name}>{displayName(template.name)}</p>', 'title={template.name}>{template.name}</p>'],
  ],
}
const HEAD_AFTER = {
  [TEMPLATE_PICKER]: ["import { useToast } from '@/hooks/use-toast'\n", "const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n"],
  [PICKER]: ["import { templateNameFromFile } from '@/lib/studio-template-workspace/registry'\n", "const COMPOSER_ROW_PREFIX = 'composer:'\n"],
  [DIALOG]: ["import type { ComposerLibraryRequest } from '@/lib/studio-composer-popups'\n", "interface PendingJob { job_id: string; session_id: string; kind: 'upload' | 'use'; retry?: ComposerRetryAction | null }\n"],
}
// PASS2B G39 (db0b716) adds three lines and one conditional to the pop-up file (proven in test-studio-empty-catalog-hide.mjs); they are turned back here so the file is compared as the base's.
const G39_ADDED = `    // PASS2B G39 (NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE, default off): no Deckster catalog exists yet, so with the flag on the empty "Deckster templates" block
    // (a disabled dropdown and its explanation) is not drawn until the list has an entry. Off, or with a catalog, the block is the base's.
    const hideEmptyDeckster = process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' && deckster.length === 0
    const decksterField = hideEmptyDeckster ? null : <div className="stcd-field" data-studio-template-dd="deckster">\n`
const G39_BASE = '    const decksterField = <div className="stcd-field" data-studio-template-dd="deckster">\n'
function revert(rel, source) {
  let text = rel === TEMPLATE_PICKER ? source.replace(G39_ADDED, () => G39_BASE) : source
  for (const [mine, theirs] of PAIRS[rel]) text = text.replace(mine, () => theirs)
  const [importAfter, constsAfter] = HEAD_AFTER[rel], [headImport, headConsts] = HEADS[rel]
  return text.replace(importAfter + headImport, importAfter).replace(constsAfter + headConsts, constsAfter)
}
function proveSources(sources, label = 'sources') {
  for (const rel of [PICKER, TEMPLATE_PICKER, DIALOG]) {
    // NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (default off): the lines it adds to the dialog are taken out first, as the sibling pins do; scripts/test-studio-template-progress.mjs proves them.
    const source = stripTemplateProgress(rel, sources[rel])
    const [headImport, headConsts] = HEADS[rel]
    eq(source.split(headImport).length - 1, 1, `${label}: ${rel} imports the helper once`)
    eq(source.split(headConsts).length - 1, 1, `${label}: ${rel} reads the exact flag once, inline, and defines its wrappers`)
    eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES/g) ?? []).length, 1, `${label}: ${rel} reads the flag once`)
    for (const [mine] of PAIRS[rel]) eq(source.split(mine).length - 1, 1, `${label}: ${rel} holds each display expression once: ${mine.slice(0, 50)}`)
    // displayName( / nameTitle( appear only inside those expressions: never in an id, a request, a payload, a session title or a toast
    const stripped = PAIRS[rel].reduce((text, [mine]) => text.replace(mine, ''), source).replace(headConsts, '')
    nomatch(stripped, /\bdisplayName\(|\bnameTitle\(/, `${label}: ${rel} draws names nowhere else`)
    const base = baseSource(rel)
    if (base) eq(revert(rel, source), base, `${label}: with its display expressions reverted ${rel} is ${BASE_COMMIT}'s`)
  }
}
proveSources(SOURCES)
if (!baseSource(PICKER)) console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  // the helper
  [LIB, 'upload suffix kept', 'const UPLOAD_SUFFIX = /', 'const UPLOAD_SUFFIX = /ZZZ'],
  [LIB, 'date not required', 'upload\\s+\\d{4}-\\d{2}-\\d{2}[^\\[\\]]*?', 'upload\\b[^\\[\\]]*?'],
  [LIB, 'id bracket kept', '(?:\\s*\\[[^\\[\\]]*\\])?\\s*$/i', '\\s*$/i'],
  [LIB, 'every bracket stripped', "    .replace(EXTENSION, '')", "    .replace(EXTENSION, '')\n    .replace(/\\s*\\[[^\\[\\]]*\\]\\s*$/, '')"],
  [LIB, 'em dash only', '[\\u2014\\u2013-]', '[\\u2014]'],
  [LIB, 'extension kept', "    .replace(EXTENSION, '')\n", ''],
  [LIB, 'any extension', '\\.(?:pptx|pptm|ppt|potx|potm|pot|ppsx|ppsm|pps|odp|key)\\s*$/i', '\\.[a-z0-9]{2,5}\\s*$/i'],
  [LIB, 'extension case-sensitive', '|odp|key)\\s*$/i', '|odp|key)\\s*$/'],
  [LIB, 'underscores kept', ".replace(/_/g, ' ')\n", ''],
  [LIB, 'hyphens to spaces', ".replace(/_/g, ' ')", ".replace(/[_-]/g, ' ')"],
  [LIB, 'white space not collapsed', "    .replace(/\\s+/g, ' ')\n", ''],
  [LIB, 'not trimmed', '    .trim()\n', ''],
  [LIB, 'empty allowed', 'return shown || name', 'return shown'],
  [LIB, 'fallback trimmed', 'return shown || name', 'return shown || name.trim()'],
  [LIB, 'non-string', "if (typeof name !== 'string') return ''", "if (typeof name !== 'string') return String(name)"],
  [LIB, 'wrapper loose', 'return enabled === true ? studioTemplateDisplayName(name) : name', 'return enabled ? studioTemplateDisplayName(name) : name'],
  [LIB, 'wrapper always', 'return enabled === true ? studioTemplateDisplayName(name) : name', 'return studioTemplateDisplayName(name)'],
  [LIB, 'title loose', "return enabled === true && studioTemplateDisplayName(name) !== name ? { title: name } : {}", "return enabled && studioTemplateDisplayName(name) !== name ? { title: name } : {}"],
  [LIB, 'title always', "return enabled === true && studioTemplateDisplayName(name) !== name ? { title: name } : {}", "return enabled === true ? { title: name } : {}"],
  [LIB, 'title the short name', "!== name ? { title: name } : {}", "!== name ? { title: studioTemplateDisplayName(name) } : {}"],
  [LIB, 'title key kept when off', "!== name ? { title: name } : {}", "!== name ? { title: name } : { title: undefined }"],
  [LIB, 'an import', 'const UPLOAD_SUFFIX', "import { x } from './x'\nconst UPLOAD_SUFFIX"],
  // the toolbar picker
  [PICKER, 'composer row not shortened', '<span className="name"><span>{displayName(row.name)}</span></span>', '<span className="name"><span>{row.name}</span></span>'],
  [PICKER, 'upload row not shortened', '<span {...nameTitle(entry.name)}>{displayName(entry.name)}</span>', '<span {...nameTitle(entry.name)}>{entry.name}</span>'],
  [PICKER, 'preview heading not shortened', '<h4 {...nameTitle(row.name)}>{displayName(row.name)}</h4>', '<h4 {...nameTitle(row.name)}>{row.name}</h4>'],
  [PICKER, 'preview heading without title', '<h4 {...nameTitle(row.name)}>{displayName(row.name)}</h4>', '<h4>{displayName(row.name)}</h4>'],
  [PICKER, 'actions group name', "aria-label={`What to do with ${displayName(selectedComposer.name)}`}", "aria-label={`What to do with ${selectedComposer.name}`}"],
  [PICKER, 'search on the display name', 'themeDropdownMatches(row.name, query)', 'themeDropdownMatches(displayName(row.name), query)'],
  [PICKER, 'row key from the display name', 'key: `${COMPOSER_ROW_PREFIX}${template.id}`, template, name: template.name', 'key: `${COMPOSER_ROW_PREFIX}${template.id}`, template, name: displayName(template.name)'],
  [PICKER, 'payload carries the display name', 'onClick={() => runComposerAction({ action, template: selectedComposer.template })}', 'onClick={() => runComposerAction({ action, template: { ...selectedComposer.template, name: displayName(selectedComposer.template.name) } })}'],
  [PICKER, 'flag read loosely', "=== 'true'\nconst displayName", "!== 'false'\nconst displayName"],
  [PICKER, 'row title dropped', 'className="stw-pick" title={row.name} data-studio-template-composer-option', 'className="stw-pick" data-studio-template-composer-option'],
  // the composer popup
  [TEMPLATE_PICKER, 'composer option not shortened', 'name: displayName(template.name), hint: template.name,', 'name: template.name, hint: template.name,'],
  [TEMPLATE_PICKER, 'saved option not shortened', 'name: displayName(template.name), hint: displayName(template.name) !==', 'name: template.name, hint: displayName(template.name) !=='],
  [TEMPLATE_PICKER, 'saved option hint decided on the flag', 'hint: displayName(template.name) !== template.name ?', 'hint: TEMPLATE_DISPLAY_NAMES ?'],
  [TEMPLATE_PICKER, 'saved option loses the stored name', '? `${template.name} · ${note}` : note', '? note : note'],
  [TEMPLATE_PICKER, 'saved option hint changed', '? `${template.name} · ${note}` : note', '? `${template.name} · ${note}` : `${note} `'],
  [TEMPLATE_PICKER, 'composer option hint shortened', 'name: displayName(template.name), hint: template.name,', 'name: displayName(template.name), hint: displayName(template.name),'],
  [TEMPLATE_PICKER, 'chosen name not shortened', '<strong {...nameTitle(chosen.name)}>{displayName(chosen.name)}</strong> ·', '<strong {...nameTitle(chosen.name)}>{chosen.name}</strong> ·'],
  [TEMPLATE_PICKER, 'chosen name without title', '<strong {...nameTitle(chosen.name)}>{displayName(chosen.name)}</strong> ·', '<strong>{displayName(chosen.name)}</strong> ·'],
  [TEMPLATE_PICKER, 'actions group name', "aria-label={`What to do with ${displayName(chosen.name)}`}", "aria-label={`What to do with ${chosen.name}`}"],
  [TEMPLATE_PICKER, 'id from the display name', 'id: `${COMPOSER_OPTION}${template.id}`, name: displayName(template.name)', 'id: `${COMPOSER_OPTION}${displayName(template.name)}`, name: displayName(template.name)'],
  [TEMPLATE_PICKER, 'search on the display name', 'search: template.name }))\n    // A locked deck', 'search: displayName(template.name) }))\n    // A locked deck'],
  [TEMPLATE_PICKER, 'selection carries the display name', "      handleTemplateClick(template)\n      // As with", "      handleTemplateClick({ ...template, name: displayName(template.name) })\n      // As with"],
  [TEMPLATE_PICKER, 'action carries the display name', "onClick={() => composer.onAction({ action, template: chosen })}", "onClick={() => composer.onAction({ action, template: { ...chosen, name: displayName(chosen.name) } })}"],
  [TEMPLATE_PICKER, 'toast shortened', 'description: `"${snapshot.name}" is ready to reuse.`', 'description: `"${displayName(snapshot.name)}" is ready to reuse.`'],
  [TEMPLATE_PICKER, 'attention row not shortened', '<strong {...nameTitle(template.name)}>{displayName(template.name)}</strong> · {templateGenerationStatusLabel(template)}', '<strong {...nameTitle(template.name)}>{template.name}</strong> · {templateGenerationStatusLabel(template)}'],
  [TEMPLATE_PICKER, 'stp row not shortened', '<span className="stp-title" {...nameTitle(template.name)}>{displayName(template.name)}</span>', '<span className="stp-title" {...nameTitle(template.name)}>{template.name}</span>'],
  [TEMPLATE_PICKER, 'flag read loosely', "=== 'true'\nconst displayName", "!== 'false'\nconst displayName"],
  [TEMPLATE_PICKER, 'always short', 'const displayName = (name: string) => studioTemplateShownName(name, TEMPLATE_DISPLAY_NAMES)', 'const displayName = (name: string) => studioTemplateShownName(name, true)'],
  // the library dialog
  [DIALOG, 'row not shortened', 'title={template.name}>{displayName(template.name)}</p>', 'title={template.name}>{template.name}</p>'],
  [DIALOG, 'row title shortened', 'title={template.name}>{displayName(template.name)}</p>', 'title={displayName(template.name)}>{displayName(template.name)}</p>'],
  [DIALOG, 'session title shortened', '`Template: ${template.name}`', '`Template: ${displayName(template.name)}`'],
  [DIALOG, 'rebuild title shortened', '`Rebuild: ${template.name}`', '`Rebuild: ${displayName(template.name)}`'],
  [DIALOG, 'flag read loosely', "=== 'true'\nconst displayName", "!== 'false'\nconst displayName"],
  [DIALOG, 'always short', 'const displayName = (name: string) => studioTemplateShownName(name, TEMPLATE_DISPLAY_NAMES)', 'const displayName = (name: string) => studioTemplateShownName(name, true)'],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { const lib = loadLib(mutated); proveLib(lib, name, mutated); await proveComponents({}, lib, name) }
    else { proveSources({ ...SOURCES, [file]: mutated }, name); await proveComponents({ [file]: mutated }, loadLib(SOURCES[LIB]), name) }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES="false"$/m, 'documented in .env.example, default off')

console.log(`Studio template display names (G38): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
