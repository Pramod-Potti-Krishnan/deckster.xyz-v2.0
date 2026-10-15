// J4-01 (ELEMENT-2 PASS2B): Undo for deleting a saved theme in the composer's Build theme popover.
// Flag NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO (exact "true"), default off.
//
// Defect: Manage themes > Delete removed a saved theme from the shared library on one click: no confirm, no undo.
// Fix (flag on): Delete hides the theme and opens a 6 s undo window (an inline Undo in the popover + the app's toast with an Undo action).
// No request is made until the window runs out. Undo restores the theme with no write.
//
// Run: node scripts/test-studio-theme-delete-undo.mjs   (plain node: transpile + vm; no network, no real timers, no writes)
//   DELETE_UNDO_BASE_ROOT=<pristine base checkout> node scripts/test-studio-theme-delete-undo.mjs
//     compares the flag-off output with that tree's output live (the base is origin/studio-v4-dev-preparation-code at 82c22f7);
//   DELETE_UNDO_BASE_ROOT=<base> PRINT_GOLDEN=1 node scripts/test-studio-theme-delete-undo.mjs    re-prints the pinned hashes below.
//
// What runs is the REAL code: components/builder/chat-input.tsx (its real runStudioThemeMutation, selection epochs, ownership and mount
// guards), components/builder/studio-theme-menu.tsx and lib/studio-theme-delete-undo.ts, transpiled and evaluated in a vm under a small hooks
// runtime that keeps per-component state, runs effects and cleanups, and unmounts what leaves the tree (so closing the popover really runs the
// menu's cleanup, and leaving the page really runs ChatInput's). Only what ChatInput imports from outside the repo is stubbed: the Radix menu
// (open/closed), the theme-profiles hook (every write is recorded, the "server" is a local list), the toast modules (recorded) and the timers
// (virtual: a 6 s window costs nothing). Nothing here opens a socket.
//
//  1. lib unit proofs: the window, undo, expiry, flush, the selection guard, late toasts, the settle fallback.
//  2. flag on, through the real composer: hidden + toast + no write; 5.999 s no write; 6 s exactly one write; Undo (inline and toast) restores
//     with no write; popover closed mid-window (the delete still goes out at 6 s, Undo still works); page left mid-window (no write);
//     another theme chosen mid-window (the delete goes first, the newer choice is kept); the selection moved by the page (dropped, never
//     redirected); a refused delete (the theme comes back, the failure notice shows); a delete in flight stays hidden; Delete while another
//     change is in flight is ignored; keyboard/aria (Undo is a focused button, the live region announces).
//  3. flag off (unset, "false", any other spelling, and "true" without the Studio shell): the menu in a grid of states, the composer, and the
//     whole Delete trace (one immediate deleteTheme, no toast, same notices) are identical to the base's (hashed).
//  4. wiring (.env.example, package.json) and mutants: deliberately broken copies of the lib and the menu must each be caught by 1, 2 or 3.
//  5. PASS2B-THEME-DELETE-BYID: the delete that goes out when the window runs out names the theme captured at click time (through the
//     real ChatInput), so a selection that moved to another saved theme while the popover was closed is never deleted in its place.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseRoot = process.env.DELETE_UNDO_BASE_ROOT ? path.resolve(process.env.DELETE_UNDO_BASE_ROOT) : null
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CHAT_INPUT = 'components/builder/chat-input.tsx'
const MENU = 'components/builder/studio-theme-menu.tsx'
const LIB = 'lib/studio-theme-delete-undo.ts'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const refuse = () => { throw new Error('theme-delete-undo fixture refuses services and writes') }
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)
const turn = () => new Promise(resolve => setImmediate(resolve))
let checks = 0
const ok = (value, message) => { checks++; assert.ok(value, message) }
const eq = (actual, expected, message) => { checks++; if (message === undefined) assert.deepStrictEqual(plain(actual), plain(expected)); else assert.deepStrictEqual(plain(actual), plain(expected), message) }

// ---- module loader (repo files load for real, in-memory mutations allowed) -------------------------------------------------------------------
class MutationTargetMissing extends Error {}
const transpiled = new Map()
function createLoader({ root, env = {}, stubs = {}, globals = {}, mutate = {} }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(root, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(root, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const rel = path.relative(root, file)
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
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, Promise, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(root, rel)), exists: rel => fs.existsSync(path.join(root, rel)) }
}

// ---- a hooks runtime with per-component state, effects, cleanups and unmounting ---------------------------------------------------------------
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
function createHost() {
  const instances = new Map()
  let current = null, cursor = 0, dirty = false, seen = new Set(), tree = null, Root = null, rootProps = null
  const queue = []
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    useState(init) {
      const inst = current, i = cursor++
      inst.cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = inst.cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const inst = current, i = cursor++; return inst.cells[i] ??= { current: init } },
    useMemo(fn, deps) { const inst = current, i = cursor++, old = inst.cells[i]; if (!old || !deps || !same(old.deps, deps)) inst.cells[i] = { deps, value: fn() }; return inst.cells[i].value },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const inst = current, i = cursor++, old = inst.cells[i]
      if (!old || !deps || !same(old.deps, deps)) {
        const cell = { deps, cleanup: old?.cleanup }
        inst.cells[i] = cell
        queue.push(() => { cell.cleanup?.(); cell.cleanup = fn() ?? undefined })
      }
    },
    useLayoutEffect() {},
    useId: () => 'local-id',
    useSyncExternalStore(subscribe, getSnapshot) {
      const inst = current, i = cursor++
      const value = getSnapshot()
      if (!inst.cells[i]) {
        const cell = inst.cells[i] = { cleanup: undefined }
        queue.push(() => { cell.cleanup = subscribe(() => { dirty = true }); if (getSnapshot() !== value) dirty = true })
      }
      return value
    },
    Fragment: 'Fragment',
  }
  react.default = react
  const cleanupInstance = inst => { for (const cell of inst.cells) { try { cell?.cleanup?.() } catch (error) { if (!(error instanceof Error)) throw error } if (cell) cell.cleanup = undefined } }
  function expand(node, at) {
    if (Array.isArray(node)) return node.map((item, index) => expand(item, `${at}.${index}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const id = `${at}/${node.type.name || 'anon'}`
      let inst = instances.get(id)
      if (!inst) instances.set(id, inst = { cells: [] })
      seen.add(id)
      current = inst; cursor = 0
      return expand(node.type(node.props), id)
    }
    const props = {}
    for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value, `${at}>${typeof node.type === 'string' ? node.type : 'x'}`) : value
    return { type: node.type, props, key: node.key }
  }
  const host = {
    react,
    mount(Component, props) { Root = Component; rootProps = props; return host.render() },
    setProps(next) { Object.assign(rootProps, next); return host.render() },
    render() {
      if (!Root) return null
      for (let attempt = 0; attempt < 25; attempt++) {
        dirty = false; seen = new Set()
        tree = expand(jsx(Root, rootProps), 'r')
        for (const [id, inst] of [...instances]) if (!seen.has(id)) { cleanupInstance(inst); instances.delete(id) }
        while (queue.length) queue.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    async settle() {
      host.render()
      for (let i = 0; i < 8; i++) { await turn(); if (dirty) host.render() }
      return tree
    },
    unmount() { for (const [, inst] of [...instances]) cleanupInstance(inst); instances.clear(); tree = null; Root = null },
    get tree() { return tree },
    get dirty() { return dirty },
  }
  return host
}
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const byAction = (tree, action) => flat(tree).find(n => n.type === 'button' && n.props['data-studio-theme-action'] === action)

// ---- a virtual clock --------------------------------------------------------------------------------------------------------------------------
function createClock() {
  let now = 0, id = 0
  const timers = new Map()
  return {
    setTimeout(fn, ms) { const t = ++id; timers.set(t, { fn, at: now + Math.max(0, ms ?? 0) }); return t },
    clearTimeout(t) { timers.delete(t) },
    get now() { return now },
    get pending() { return timers.size },
    async advance(ms, after) {
      const end = now + ms
      for (;;) {
        let next = null
        for (const [t, entry] of timers) if (entry.at <= end && (!next || entry.at < next[1].at)) next = [t, entry]
        if (!next) break
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await after?.()
      }
      now = end; await after?.()
    },
  }
}

// ---- fixtures ---------------------------------------------------------------------------------------------------------------------------------
const PRESETS = [{ preset_id: 'minimal', name: 'Minimal', description: 'Quiet theme' }, { preset_id: 'vibrant', name: 'Vibrant', description: 'Loud theme' }]
const SAVED = [
  { id: 'th-1', name: 'Northwind brand', is_standard: true, theme_payload: { mode: 'custom', primary_hex: '#0f766e' } },
  { id: 'th-2', name: 'Investor update', is_standard: false, theme_payload: { mode: 'custom', primary_hex: '#7c3aed' } },
  { id: 'th-3', name: 'Workshop warm', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'pastel' } },
]
const profileOf = theme => ({ id: theme.id, name: theme.name, theme_payload: theme.theme_payload })

/** ChatInput's imports that are not repo code, as stubs; every repo module loads for real. */
function makeWorld({ root = repoRoot, env, mutate = {}, deleteResult = true, gate = {} } = {}) {
  const host = createHost()
  const clock = createClock()
  const toasts = []
  const log = []
  const calls = { list: 0, save: [], setStandard: [], clearStandard: [], deleteTheme: [] }
  let server = SAVED.map(theme => ({ ...theme }))
  const profiles = {
    loading: false, error: null,
    listThemes: async () => { calls.list += 1; return { themes: server.map(theme => ({ ...theme })), count: server.length } },
    saveTheme: async arg => { calls.save.push(arg); return null },
    setStandardTheme: async id => { calls.setStandard.push(id); if (gate.setStandard) await gate.setStandard.promise; return null },
    clearStandardTheme: async () => { calls.clearStandard.push(true); return false },
    deleteTheme: async id => {
      calls.deleteTheme.push(id)
      if (gate.deleteTheme) await gate.deleteTheme.promise
      if (!deleteResult) return false
      server = server.filter(theme => theme.id !== id)
      return true
    },
  }
  const DropdownMenuContent = props => jsx('DropdownMenuContent', props)
  const DropdownMenu = props => jsx('DropdownMenu', { ...props, children: [].concat(props.children ?? []).flat().map(child => child && child.type === DropdownMenuContent && !props.open ? null : child) })
  const stubs = {
    react: host.react,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/ui/dropdown-menu': { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger: props => jsx('DropdownMenuTrigger', props) },
    '@/components/file-chip': { FileChip: 'FileChip' },
    '@/components/builder/chat/mention-popover': { SlideMentionPopover: () => null },
    '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse },
    '@/lib/mdc-flags': { CHAT_MENTIONS: false },
    '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9', features: { enableFileUploads: true } },
    'next/link': { default: 'a' },
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => profiles },
    './template-picker': { TemplatePicker: () => null },
    './studio-composer-hint': { StudioComposerHint: ({ children }) => children },
    // what the menu imports on use (the toast modules): recorded
    '@/hooks/use-toast': {
      toast: value => {
        const record = { ...value, dismissed: false }
        toasts.push(record)
        return { id: String(toasts.length), dismiss: () => { record.dismissed = true }, update() {} }
      },
    },
    '@/components/ui/toast': { ToastAction: 'ToastAction' },
  }
  const globals = { fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }
  const loader = createLoader({ root, env, stubs, globals, mutate })
  const realTemplates = loader.load('hooks/use-templates.ts')
  stubs['@/hooks/use-templates'] = { ...realTemplates, useTemplates: () => ({ loading: false }) }
  stubs['@/lib/utils'] = { cn: (...values) => values.filter(Boolean).join(' ') }
  const { ChatInput } = loader.load(CHAT_INPUT)
  const props = {
    inputMessage: '', onInputChange: () => {}, onSubmit: () => {}, uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
    pendingActionInput: null, onCancelAction: () => {}, researchEnabled: false, onResearchEnabledChange: refuse, webSearchEnabled: false,
    onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse, showKnowledgeGraphToggle: false,
    knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse, isReady: true, isLoadingSession: false, connected: true, connecting: false,
    user: { id: 'synthetic-user' }, currentSessionId: 'synthetic-session', onRequestSession: async () => {}, templateBuilderEnabled: false,
    buildTheme: SAVED[1].theme_payload, activeBuildThemeProfile: profileOf(SAVED[1]),
    // the page keeps these two and hands them back as props
    onBuildThemeChange: value => { log.push(['onBuildThemeChange', plain(value)]); props.buildTheme = value },
    onActiveBuildThemeProfileChange: value => { log.push(['onActiveBuildThemeProfileChange', value ? value.id : null]); props.activeBuildThemeProfile = value ?? undefined },
  }
  const world = {
    host, clock, toasts, log, calls, loader, env,
    settle: () => host.settle(),
    get tree() { return host.tree },
    get writes() { return calls.save.length + calls.setStandard.length + calls.clearStandard.length + calls.deleteTheme.length },
    async advance(ms) { await clock.advance(ms, () => host.settle()) },
    async mount() { host.mount(ChatInput, props); await host.settle(); return world },
    /** Opens the Build theme popover (the same onOpenChange the composer wires: it reads the library) and its Manage themes view. */
    async openManage() {
      await world.openPopover()
      byAction(world.tree, 'manage-entry').props.onClick()
      await host.settle()
    },
    async openPopover() {
      const menu = flat(world.tree).find(n => n.type === 'DropdownMenu' && flat(n).some(x => x.type === 'button' && x.props['aria-label'] === 'Build theme'))
      menu.props.onOpenChange(true)
      await host.settle()
    },
    async closePopover() {
      const menu = flat(world.tree).find(n => n.type === 'DropdownMenu' && flat(n).some(x => x.type === 'button' && x.props['aria-label'] === 'Build theme'))
      menu.props.onOpenChange(false)
      await host.settle()
    },
    async setProps(next) { host.setProps(next); await host.settle() },
    options: () => flat(world.tree).filter(n => n.type === 'option').map(n => text(n)).filter(label => label !== 'Select saved theme').map(label => label.replace(/^★ /, '')),
    menuOpen: () => flat(world.tree).some(n => n.props?.['data-studio-theme-view']),
    undoNotice: () => flat(world.tree).find(n => n.props?.['data-studio-theme-delete-undo']),
    notices: () => flat(world.tree).filter(n => n.props?.['data-studio-theme-mutation-state']).map(n => `${n.props['data-studio-theme-mutation-kind']}:${n.props['data-studio-theme-mutation-state']}:${text(n)}`),
    removeFromServer: id => { server = server.filter(theme => theme.id !== id) },
    selectedValue: () => flat(world.tree).find(n => n.type === 'select' && n.props['aria-label'] === 'Saved theme')?.props.value,
    async clickDelete() { byAction(world.tree, 'delete').props.onClick(); await host.settle() },
    async chooseSaved(id) { flat(world.tree).find(n => n.type === 'select' && n.props['aria-label'] === 'Saved theme').props.onChange({ target: { value: id } }); await host.settle() },
  }
  return world
}
const ON = { [SHELL]: 'true', [FLAG]: 'true' }
const OFF_VARIANTS = [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: ' true' }, { [FLAG]: 'true ' }, { [FLAG]: '' }]
const withShell = variant => ({ [SHELL]: 'true', ...variant })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

// ---- 1. lib unit proofs ----------------------------------------------------------------------------------------------------------------------
async function proveLib({ mutate = {}, root = repoRoot } = {}) {
  const loader = createLoader({ root, env: { [FLAG]: 'true' }, mutate })
  const lib = loader.load(LIB)
  const fresh = (windowMs = 6000, settleMs = 10000) => {
    const clock = createClock()
    const deleted = []
    const store = lib.createThemeDeleteUndo({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }, windowMs, settleMs)
    const toasts = []
    const notify = async (name, onUndo) => { const t = { name, onUndo, closed: 0 }; toasts.push(t); return () => { t.closed += 1 } }
    store.attach({ onDelete: () => deleted.push('x'), selectedId: 'a' })
    return { clock, store, deleted, toasts, notify }
  }
  eq(lib.STUDIO_THEME_DELETE_UNDO_ENABLED, true, 'the flag reads exact "true"')
  eq(lib.STUDIO_THEME_DELETE_UNDO_MS, 6000)
  { // the window
    const { clock, store, deleted, toasts, notify } = fresh()
    eq(store.getSnapshot().pending, null)
    store.begin('a', 'Alpha', notify); await turn()
    eq(store.getSnapshot().pending, { id: 'a', name: 'Alpha' }); eq(deleted.length, 0, 'begin writes nothing'); eq(toasts.length, 1)
    await clock.advance(5999); eq(deleted.length, 0, 'no write inside the window'); eq(store.getSnapshot().pending?.id, 'a')
    await clock.advance(1); eq(deleted.length, 1, 'exactly one delete when the window runs out'); eq(store.getSnapshot().pending, null)
    eq(store.getSnapshot().committing, ['a'], 'hidden until seen finished'); eq(toasts[0].closed, 1, 'the toast closes with the window')
    await clock.advance(60000); eq(deleted.length, 1, 'never repeated'); eq(store.getSnapshot().committing, [], 'the settle fallback gives the theme back')
  }
  { // undo, stale undo, late notify
    const { clock, store, deleted, toasts, notify } = fresh()
    store.begin('a', 'Alpha', notify); await turn()
    eq(store.undo(), true); eq(store.getSnapshot().pending, null); eq(toasts[0].closed, 1)
    await clock.advance(60000); eq(deleted.length, 0, 'undo: no write, ever')
    eq(store.undo(), false, 'a second undo is a no-op')
    store.begin('a', 'Alpha', notify); await turn(); toasts[1].onUndo(); await clock.advance(60000); eq(deleted.length, 0, 'the toast action undoes the same way')
    store.begin('a', 'Alpha', notify); await clock.advance(6000); toasts[2].onUndo(); eq(deleted.length, 1, 'an Undo clicked after the window did nothing')
    let release; const slow = async () => new Promise(done => { release = () => done(() => { late.closed += 1 }) }); const late = { closed: 0 }
    const s2 = fresh(); s2.store.begin('a', 'Alpha', slow); s2.store.undo(); release(); await turn(); eq(late.closed, 1, 'a toast that appears after the window closed is closed at once')
  }
  { // flush, guard, detach
    const { clock, store, deleted, notify } = fresh()
    store.begin('a', 'Alpha', notify); eq(store.flush(), true); eq(deleted.length, 1, 'flush commits now'); eq(store.flush(), false)
    await clock.advance(60000); eq(deleted.length, 1)
    const g = fresh()
    g.store.begin('a', 'Alpha', g.notify); g.store.attach({ onDelete: () => g.deleted.push('wrong'), selectedId: 'b' })
    await g.clock.advance(6000); eq(g.deleted.length, 0, 'the selection moved while the popover was open: the delete is dropped, not redirected'); eq(g.store.getSnapshot().pending, null); eq(g.store.getSnapshot().committing, [])
    const d = fresh()
    d.store.begin('a', 'Alpha', d.notify); d.store.detach(); await d.clock.advance(6000)
    eq(d.deleted.length, 1, 'closing the popover does not cancel: the last onDelete goes out at 6 s')
    const n = fresh()
    n.store.begin('a', 'Alpha', n.notify); n.store.begin('b', 'Beta', n.notify); eq(n.deleted.length, 1, 'a second begin commits the first'); eq(n.store.getSnapshot().pending?.id, 'b')
    const named = fresh(), ids = []
    named.store.attach({ onDelete: id => ids.push(id), selectedId: 'a' })
    named.store.begin('a', 'Alpha', named.notify); await named.clock.advance(6000); eq(ids, ['a'], 'the delete is handed the id captured at click time')
    const closed = fresh(), closedIds = []
    closed.store.attach({ onDelete: id => closedIds.push(id), selectedId: 'a' })
    closed.store.begin('a', 'Alpha', closed.notify); closed.store.detach(); await closed.clock.advance(6000); eq(closedIds, ['a'], 'popover closed: the remembered onDelete is still handed the id')
    const early = fresh(), earlyIds = []
    early.store.attach({ onDelete: id => earlyIds.push(id), selectedId: 'a' })
    early.store.begin('a', 'Alpha', early.notify); early.store.begin('b', 'Beta', early.notify)
    early.store.attach({ onDelete: id => earlyIds.push(id), selectedId: 'b' }); early.store.flush(); eq(earlyIds, ['a', 'b'], 'a commit forced early (second begin, flush) names its own theme')
    const r = fresh()
    r.store.begin('a', 'Alpha', r.notify); await r.clock.advance(6000); r.store.release('a'); eq(r.store.getSnapshot().committing, [], 'release shows the theme again')
    r.store.reset(); eq(r.store.getSnapshot().pending, null)
  }
}

// ---- 2. flag on, through the real composer ---------------------------------------------------------------------------------------------------
async function proveOn({ mutate = {} } = {}) {
  const name = 'Investor update'
  { // hidden, toast, no write, 6 s, exactly one write
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage()
    eq(w.options(), ['Northwind brand', 'Investor update', 'Workshop warm'], 'the library is listed')
    ok(byAction(w.tree, 'delete'), 'Delete is offered for the selected theme')
    eq(w.undoNotice()?.props['data-studio-theme-delete-undo'], 'idle', 'the live region exists before anything happens'); eq(text(w.undoNotice()), '')
    await w.clickDelete()
    eq(w.options(), ['Northwind brand', 'Workshop warm'], 'Delete hides the theme at once')
    eq(byAction(w.tree, 'delete'), undefined, 'the Delete button leaves with it')
    eq(w.writes, 0, 'NO request on the click'); eq(w.toasts.length, 1)
    const toast = w.toasts[0]
    eq([toast.title, toast.description, toast.duration, toast.dismissed], ['Theme deleted', name, 6000, false], 'the toast: copy, the name, ~6 s')
    eq(toast.action.type, 'ToastAction'); ok(toast.action.props.altText.includes(name), 'the toast action has alt text'); eq(text(toast.action), 'Undo'); eq(typeof toast.action.props.onClick, 'function')
    const undo = byAction(w.tree, 'undo-delete')
    ok(undo, 'inline Undo is offered in the popover'); eq(undo.props.autoFocus, true, 'Undo takes focus (the Delete button it replaces left the page)')
    ok(undo.props['aria-label'].includes(name), 'Undo names the theme'); eq(undo.type, 'button'); eq(undo.props.type, 'button')
    const live = w.undoNotice()
    eq(live.props['data-studio-theme-delete-undo'], 'pending')
    const region = flat(live).find(n => n.props?.role === 'status')
    eq(region.props['aria-live'], 'polite'); ok(text(region).includes(`Theme deleted: ${name}`) && text(region).includes('6 seconds'), 'the live region announces it')
    await w.advance(5999)
    eq(w.writes, 0, 'no write at 5.999 s'); eq(w.toasts[0].dismissed, false); eq(w.options(), ['Northwind brand', 'Workshop warm'])
    await w.advance(1)
    eq(w.calls.deleteTheme, ['th-2'], 'exactly one write at 6 s, for that theme'); eq(w.writes, 1); eq(w.toasts[0].dismissed, true, 'the toast closes')
    eq(w.options(), ['Northwind brand', 'Workshop warm'], 'still gone after the request')
    eq(byAction(w.tree, 'undo-delete'), undefined)
    eq(w.notices(), ['delete:success:Saved theme deleted.'], "ChatInput's own acknowledgment")
    eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange'), [['onActiveBuildThemeProfileChange', null]], 'the selection is cleared as it always was')
    await w.advance(60000); eq(w.writes, 1, 'never repeated')
  }
  for (const how of ['inline', 'toast']) { // undo restores with no write
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.advance(3000)
    eq(w.writes, 0)
    if (how === 'inline') { byAction(w.tree, 'undo-delete').props.onClick(); await w.settle() } else { w.toasts[0].action.props.onClick(); await w.settle() }
    eq(w.options(), ['Northwind brand', 'Investor update', 'Workshop warm'], `${how} Undo restores the theme`)
    ok(byAction(w.tree, 'delete'), 'Delete is back'); eq(byAction(w.tree, 'undo-delete'), undefined); eq(w.toasts[0].dismissed, true, 'the toast closes')
    await w.advance(120000)
    eq(w.writes, 0, `${how} Undo: no write at all, ever`); eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange'), [], 'the selection was never touched')
    await w.clickDelete(); await w.advance(6000); eq(w.calls.deleteTheme, ['th-2'], 'a fresh Delete after an Undo works: one write')
  }
  { // popover closed mid-window: the window keeps running, Undo still works
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.closePopover()
    eq(w.menuOpen(), false, 'the popover (and with it the menu component) is gone'); eq(w.toasts[0].dismissed, false, 'the toast stays')
    await w.advance(5999); eq(w.writes, 0); await w.advance(1)
    eq(w.calls.deleteTheme, ['th-2'], 'closed popover: the delete goes out when the window runs out (once)')
    const v = await makeWorld({ env: ON, mutate }).mount()
    await v.openManage(); await v.clickDelete(); await v.closePopover(); v.toasts[0].action.props.onClick(); await v.advance(60000)
    eq(v.writes, 0, 'closed popover, then the toast Undo: no write'); await v.openPopover(); byAction(v.tree, 'manage-entry')?.props.onClick(); await v.settle()
    eq(v.options(), ['Northwind brand', 'Investor update', 'Workshop warm'], 'and the theme is back when it reopens')
  }
  { // PASS2B-THEME-DELETE-BYID: the selection moves to another saved theme while the popover is closed: the deleted theme goes, the other is untouched
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.closePopover()
    await w.setProps({ activeBuildThemeProfile: profileOf(SAVED[2]), buildTheme: SAVED[2].theme_payload })
    eq(w.menuOpen(), false, 'the popover is closed while the selection moves')
    await w.advance(5999); eq(w.writes, 0, 'nothing before the window runs out'); await w.advance(1)
    eq(w.calls.deleteTheme, ['th-2'], 'exactly one DELETE, for the theme that was deleted (th-2), never the selected th-3'); eq(w.writes, 1)
    eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange' && entry[1] === null), [], 'the selected th-3 is not cleared')
    eq(w.log.filter(entry => entry[0] === 'onBuildThemeChange'), [], 'the page choice is not rewritten')
    await w.openPopover(); byAction(w.tree, 'manage-entry')?.props.onClick(); await w.settle()
    eq(w.options(), ['Northwind brand', 'Workshop warm'], 'th-2 is gone, th-3 is still in the library'); eq(w.selectedValue(), 'th-3', 'and th-3 is still the selected theme')
    eq(w.notices(), ['delete:success:Saved theme deleted.'])
    await w.advance(120000); eq(w.writes, 1, 'never repeated')
  }
  { // the same, with the page now on a preset (no saved theme selected): the deleted theme still goes, the preset choice is kept
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.closePopover()
    await w.setProps({ activeBuildThemeProfile: undefined, buildTheme: { mode: 'preset', preset_id: 'minimal' } })
    await w.advance(6000)
    eq(w.calls.deleteTheme, ['th-2'], 'the deleted theme is deleted by id even though nothing is selected now'); eq(w.writes, 1)
    eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange' && entry[1] === null), [], 'the preset choice is not reset')
  }
  { // the captured theme is already gone (another tab deleted it) and the selection is another saved theme: nothing is deleted
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.closePopover()
    await w.setProps({ activeBuildThemeProfile: profileOf(SAVED[2]), buildTheme: SAVED[2].theme_payload })
    w.removeFromServer('th-2')
    const reads = w.calls.list
    await w.openPopover(); ok(w.calls.list > reads, 'reopening reads the library: the composer now knows th-2 is gone'); await w.closePopover()
    await w.advance(6000)
    eq(w.calls.deleteTheme, [], 'no DELETE: not for the gone th-2, and never redirected to the selected th-3'); eq(w.writes, 0)
    eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange' && entry[1] === null), [], 'the selection is untouched'); eq(w.toasts[0].dismissed, true)
    await w.advance(120000); eq(w.writes, 0)
  }
  { // page left mid-window: nothing is sent
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); w.host.unmount()
    await w.advance(120000)
    eq(w.writes, 0, 'page left before the window ran out: no request'); eq(w.toasts[0].dismissed, true, 'the toast is closed with the window')
  }
  { // another theme chosen mid-window: the delete goes first, the newer choice is kept
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete(); await w.advance(2000)
    await w.chooseSaved('th-1')
    eq(w.calls.deleteTheme, ['th-2'], 'the waiting delete is committed first, for the theme that was deleted'); eq(w.toasts[0].dismissed, true)
    eq(w.options(), ['Northwind brand', 'Workshop warm']); eq(w.notices(), ['delete:success:Saved theme deleted. Your newer theme choice is kept.'])
    eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange').map(entry => entry[1]), ['th-1'], 'the newer choice (th-1) is the selection; it was not cleared')
    await w.advance(120000); eq(w.writes, 1)
  }
  { // the page moves the selection while the popover is open: dropped, never redirected to the other theme
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.clickDelete()
    await w.setProps({ activeBuildThemeProfile: profileOf(SAVED[0]), buildTheme: SAVED[0].theme_payload })
    await w.advance(6000)
    eq(w.writes, 0, 'the selected theme changed under the window: nothing is deleted (th-1 above all)'); eq(w.toasts[0].dismissed, true)
    ok(w.options().includes('Investor update'), 'the theme that was never deleted is listed again')
  }
  { // a refused delete: the theme comes back with the failure notice
    const w = await makeWorld({ env: ON, mutate, deleteResult: false }).mount()
    await w.openManage(); await w.clickDelete(); await w.advance(6000)
    eq(w.calls.deleteTheme, ['th-2']); eq(w.notices(), ['delete:failed:Could not delete saved theme. Your changes are kept.'])
    eq(w.options(), ['Northwind brand', 'Investor update', 'Workshop warm'], 'the delete failed: the theme is listed again')
  }
  { // a delete in flight stays hidden
    const gate = { deleteTheme: deferred() }
    const w = await makeWorld({ env: ON, mutate, gate }).mount()
    await w.openManage(); await w.clickDelete(); await w.advance(6000)
    eq(w.calls.deleteTheme, ['th-2']); eq(w.notices()[0], 'delete:loading:Deleting saved theme…')
    eq(w.options(), ['Northwind brand', 'Workshop warm'], 'hidden while the request is in flight (no flicker)')
    gate.deleteTheme.resolve(); await w.settle(); await w.settle()
    eq(w.options(), ['Northwind brand', 'Workshop warm']); eq(w.notices(), ['delete:success:Saved theme deleted.'])
  }
  { // Delete while another change is in flight is ignored (as ChatInput does)
    const gate = { setStandard: deferred() }
    const w = await makeWorld({ env: ON, mutate, gate }).mount()
    await w.openManage()
    byAction(w.tree, 'set-standard').props.onClick(); await w.settle()
    eq(w.calls.setStandard, ['th-2']); eq(w.notices()[0], 'set-standard:loading:Setting standard theme…')
    await w.clickDelete()
    eq(w.toasts.length, 0, 'no undo window, no toast'); eq(w.options(), ['Northwind brand', 'Investor update', 'Workshop warm'])
    gate.setStandard.resolve(); await w.advance(60000); eq(w.calls.deleteTheme, [], 'and nothing is deleted later')
  }
  { // locked (sign-out / locked deck): Delete does not open a window
    const w = await makeWorld({ env: ON, mutate }).mount()
    await w.openManage(); await w.setProps({ templateSelectionLocked: true })
    const del = byAction(w.tree, 'delete')
    eq(del.props.disabled, true, 'a locked deck disables Delete')
    del.props.onClick(); await w.settle() // even a click that got through is refused
    eq(w.toasts.length, 0); await w.advance(60000); eq(w.writes, 0)
  }
}

// ---- 3. flag off is the base ---------------------------------------------------------------------------------------------------------------------
const MENU_STATES = (() => {
  const states = []
  for (const view of ['choices', 'save', 'manage']) for (const selection of [{ mode: 'auto' }, { mode: 'custom', primary_hex: '#7c3aed' }]) for (const locked of [false, true]) for (const selectedId of [null, 'th-2']) {
    for (const mutation of [null, { kind: 'delete', phase: 'loading', message: 'Deleting saved theme…' }, { kind: 'delete', phase: 'failed', message: 'Could not delete saved theme. Your changes are kept.' }]) states.push({ view, selection, locked, selectedId, mutation })
  }
  return states
})()
const menuProps = ({ view, selection, locked, selectedId, mutation }, dropdowns) => ({
  view, onView() {}, onClose() {}, selection, presets: PRESETS, presetsLoading: false, presetsError: false, themes: SAVED, selectedId,
  currentProfile: selectedId ? { id: selectedId, name: 'Investor update' } : null, activeTheme: SAVED.find(t => t.id === selectedId), standardTheme: SAVED[0],
  onPreset() {}, onSaved() {}, hex: '#1e40af', onHex() {}, locked, lockReason: locked ? 'Build theme selection is locked for this deck.' : null, readBusy: false, readFailed: false,
  readEmpty: false, onRefresh() {}, name: '', onName() {}, asStandard: false, onAsStandard() {}, mutation, onSave() {}, onSetStandard() {}, onClearStandard() {}, onDelete() {},
  ...(dropdowns ? { dropdowns: true } : {}),
})
async function offHashes(root, env, mutate = {}, closedOnly = false) {
  const out = {}
  if (closedOnly) { out.composer = sha(ser((await makeWorld({ root, env, mutate }).mount()).tree)); return out }
  { // the menu in a grid of states (flag-off path hooks nothing, so a bare host renders it)
    const hashes = []
    for (const dropdowns of [false, true]) for (const state of MENU_STATES) {
      const host = createHost()
      const loader = createLoader({ root, env, mutate, stubs: { react: host.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }), '@/lib/utils': { cn: (...v) => v.filter(Boolean).join(' ') } } })
      const { StudioThemeMenu } = loader.load(MENU)
      hashes.push(sha(ser(host.mount(StudioThemeMenu, menuProps(state, dropdowns)))))
    }
    out.menu = sha(hashes.join('\n'))
  }
  { // the composer with the popover closed and open, and the whole Delete trace
    const closed = await makeWorld({ root, env, mutate }).mount()
    out.composer = sha(ser(closed.tree))
    const w = await makeWorld({ root, env, mutate }).mount()
    const trace = []
    await w.openManage(); trace.push(['manage', sha(ser(w.tree)), w.options()])
    await w.clickDelete(); trace.push(['clicked', w.calls.deleteTheme.slice(), w.toasts.length, w.options(), sha(ser(w.tree)), w.notices()])
    await w.advance(60000); trace.push(['later', w.calls.deleteTheme.slice(), w.toasts.length, w.options(), sha(ser(w.tree)), w.notices(), w.log])
    out.trace = sha(ser(trace))
    out.traceShape = { immediateWrites: trace[1][1].length, toasts: trace[2][2], timersLeft: w.clock.pending }
  }
  return out
}
// recorded from the base sources (origin/studio-v4-dev-preparation-code at 82c22f7): DELETE_UNDO_BASE_ROOT=<base> PRINT_GOLDEN=1
const GOLDEN = {
  menu: 'bfa9c7695d669a7a41b8b0b285a35e8e6f86c8a56517e492333fc2b76e1a0d50',
  composer: 'de6712809623ad834b5d4795edd34cb2b2f1f14dc97fdb185071552eb4c80e23',
  trace: 'f3b114866a77aad9d98f9d388f63ad06b750f3112c3bb40371cd7a639f63bd4f',
}
async function proveOff({ mutate = {}, expected }) {
  const variants = OFF_VARIANTS.map(variant => ({ name: JSON.stringify(variant), env: withShell(variant) }))
  variants.push({ name: 'flag on, no Studio shell', env: { [FLAG]: 'true' } })
  for (const { name, env } of variants) {
    if (name === 'flag on, no Studio shell') { eq((await offHashes(repoRoot, env, mutate, true)).composer, (await offHashes(repoRoot, { [FLAG]: 'false' }, mutate, true)).composer, 'the classic composer renders no Studio menu, so the flag does nothing there'); continue }
    const mine = await offHashes(repoRoot, env, mutate)
    eq(mine.menu, expected.menu, `flag off ${name}: the menu's element tree equals the base's`)
    eq(mine.composer, expected.composer, `flag off ${name}: the composer equals the base's`)
    eq(mine.trace, expected.trace, `flag off ${name}: the whole Delete trace equals the base's`)
  }
  const shape = (await offHashes(repoRoot, withShell({}), mutate)).traceShape
  eq(shape, { immediateWrites: 1, toasts: 0, timersLeft: shape.timersLeft }, 'flag off: Delete writes at once and shows no toast')
  { // a real click hands its event to onDelete: flag off that is still ChatInput's own delete of the SELECTED theme (the event is never read as an id)
    const w = await makeWorld({ root: repoRoot, env: withShell({}), mutate }).mount()
    await w.openManage()
    byAction(w.tree, 'delete').props.onClick({ type: 'click', target: {}, nativeEvent: {} }); await w.settle()
    eq(w.calls.deleteTheme, ['th-2'], 'flag off, real click event: one immediate delete of the selected theme'); eq(w.toasts.length, 0)
    eq(w.notices(), ['delete:success:Saved theme deleted.']); eq(w.log.filter(entry => entry[0] === 'onActiveBuildThemeProfileChange'), [['onActiveBuildThemeProfileChange', null]])
  }
}

// ---- main --------------------------------------------------------------------------------------------------------------------------------------
async function proveAll(mutate = {}, { off = true, expected } = {}) {
  await proveLib({ mutate })
  await proveOn({ mutate })
  if (off) await proveOff({ mutate, expected })
}
let expected = GOLDEN
if (baseRoot) {
  expected = {}
  const base = await offHashes(baseRoot, withShell({}))
  Object.assign(expected, base)
  if (process.env.PRINT_GOLDEN) { console.log(JSON.stringify({ menu: base.menu, composer: base.composer, trace: base.trace }, null, 2)); process.exit(0) }
}
const tests = []
const test = (name, fn) => tests.push({ name, fn })
test('lib: the undo window, undo, expiry, flush, selection guard, late toast, settle fallback', () => proveLib())
test('flag on, real composer: hidden + toast + no write; undo; expiry; popover closed; page left; selection moved; refused; in flight; busy', () => proveOn())
test('flag off (unset, false, other spellings, no Studio shell) is the base: menu grid, composer, whole Delete trace', () => proveOff({ expected }))
test('wiring: .env.example, package.json, flag on the exact "true"', () => {
  const env = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8')
  ok(/^NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO="false"$/m.test(env), '.env.example documents the flag, default "false"')
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  eq(pkg.scripts['test:studio-theme-delete-undo'], 'node scripts/test-studio-theme-delete-undo.mjs')
  const lib = fs.readFileSync(path.join(repoRoot, LIB), 'utf8')
  ok(lib.includes("process.env.NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO === 'true'"), 'the flag is read as a literal process.env reference (Next inlines it)')
  const menu = fs.readFileSync(path.join(repoRoot, MENU), 'utf8')
  ok(menu.includes('if (STUDIO_THEME_DELETE_UNDO_ENABLED) return <StudioThemeMenuWithDeleteUndo {...p} />'), 'the menu routes on the flag')
  ok(!menu.includes("from '@/hooks/use-toast'") && !menu.includes("from '@/components/ui/toast'"), 'the toast modules are imported on use only (other tests load the menu with fixed import maps)')
})

// ---- mutants: each must be caught ----------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['lib: the window is 0 s (writes before Undo is possible)', { [LIB]: [['entry.timer = deps.setTimeout(() => { commit(entry) }, windowMs)', 'entry.timer = deps.setTimeout(() => { commit(entry) }, 0)']] }],
  ['lib: begin writes at once', { [LIB]: [['    publish()\n      if (notify) {', '    publish(); attached?.onDelete()\n      if (notify) {']] }],
  ['lib: undo leaves the delete pending', { [LIB]: [['    if (current === entry) current = null\n  }\n  const hold', '  }\n  const hold']] }],
  ['lib: the selection guard is gone (a moved selection deletes the other theme)', { [LIB]: [['if (attached && attached.selectedId !== entry.id) { publish(); return false }', '']] }],
  ['lib: a committed delete is not held hidden', { [LIB]: [['    hold(entry.id)\n    publish()', '    publish()']] }],
  ['lib: the toast is left open', { [LIB]: [['    entry.closeToast?.()\n    entry.closeToast = null', '']] }],
  ['lib: the settle fallback never fires', { [LIB]: [['settling.set(id, deps.setTimeout(() => release(id), settleMs))', 'settling.set(id, 0)']] }],
  ['lib: a second begin does not commit the first', { [LIB]: [['    flush()\n      const entry', '    const entry']] }],
  ['lib: the flag is on unless "false"', { [LIB]: [["process.env.NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO !== 'false'"]] }],
  ['menu: the flag branch is always taken (flag off is no longer the base)', { [MENU]: [['if (STUDIO_THEME_DELETE_UNDO_ENABLED) return', 'if (true) return']] }],
  ['menu: the theme is not hidden', { [MENU]: [['const themes = hidden.length ? p.themes.filter(theme => !hidden.includes(theme.id)) : p.themes', 'const themes = p.themes']] }],
  ['menu: a selection change does not commit the waiting delete', { [MENU]: [['themeDeleteUndo.flush(); change(...args)', 'change(...args)']] }],
  ['menu: a failed or finished delete is never released', { [MENU]: [['themeDeleteUndo.release(id)', '(void 0)']] }],
  ['menu: Delete is not refused while another change is in flight', { [MENU]: [['if (!theme || p.locked || busy || p.selectedId !== theme.id) return', 'if (!theme || p.locked || p.selectedId !== theme.id) return']] }],
  ['menu: Delete is not refused when locked', { [MENU]: [['if (!theme || p.locked || busy || p.selectedId !== theme.id) return', 'if (!theme || busy || p.selectedId !== theme.id) return']] }],
  ['menu: the popover forgets the selection on every render (guard sees a stale id)', { [MENU]: [['themeDeleteUndo.attach({ onDelete: p.onDelete, selectedId: p.selectedId })', 'themeDeleteUndo.attach({ onDelete: p.onDelete, selectedId: null })']] }],
  ['menu: Undo does not take focus', { [MENU]: [['aria-label={`Undo deleting ${p.deleteUndo.name}`} autoFocus onClick', 'aria-label={`Undo deleting ${p.deleteUndo.name}`} onClick']] }],
  ['menu: no live region text', { [MENU]: [['`Theme deleted: ${p.deleteUndo.name}. Undo is available for ${STUDIO_THEME_DELETE_UNDO_MS / 1000} seconds.`', "''"]] }],
  ['menu: the live region is not polite', { [MENU]: [['<span role="status" aria-live="polite">', '<span role="status">']] }],
  ['menu: the toast has no Undo action', { [MENU]: [['    action: <ToastAction altText={`Undo deleting the theme ${name}`} onClick={onUndo}>Undo</ToastAction>,\n', '']] }],
  ['menu: the toast Undo has no alt text', { [MENU]: [['altText={`Undo deleting the theme ${name}`} ', '']] }],
  ['menu: the toast lasts 60 s', { [MENU]: [['duration: STUDIO_THEME_DELETE_UNDO_MS,', 'duration: 60000,']] }],
  ['menu: the inline Undo does nothing', { [MENU]: [['onUndo: () => { themeDeleteUndo.undo() }', 'onUndo: () => {}']] }],
  ['lib: the delete is not handed the captured id (a bare call deletes the selection)', { [LIB]: [['onDelete(entry.id) // the only place', 'onDelete() // the only place']] }],
  ['chat-input: the id is ignored (the currently selected theme is deleted)', { [CHAT_INPUT]: [['studioThemeCacheThemes.current.find((theme) => theme.id === (targetThemeId ?? profileId))', 'studioThemeCacheThemes.current.find((theme) => theme.id === profileId)']] }],
  ['chat-input: a gone captured theme falls back to the selection', { [CHAT_INPUT]: [['studioThemeCacheThemes.current.find((theme) => theme.id === (targetThemeId ?? profileId))', '(studioThemeCacheThemes.current.find((theme) => theme.id === targetThemeId) ?? studioThemeCacheThemes.current.find((theme) => theme.id === profileId))']] }],
  ['chat-input: deleting another theme than the selected one clears the selection', { [CHAT_INPUT]: [[' && profile!.id === profileId) {', ') {']] }],
  ['chat-input: a click event is read as an id (flag off no longer deletes the selection)', { [CHAT_INPUT]: [["typeof id === 'string' ? runStudioThemeMutation('delete', id)", "id !== undefined ? runStudioThemeMutation('delete', id as string)"]] }],
  ['menu: the menu keeps the old onDelete (writes at once)', { [MENU]: [['      themeDeleteUndo.begin(theme.id, theme.name, showUndoToast)', '      p.onDelete()']] }],
]
for (const [name, mutate] of MUTANTS) {
  test(`mutant caught: ${name}`, async () => {
    await assert.rejects(async () => {
      try { await proveAll(mutate, { expected }) } catch (error) { if (error instanceof MutationTargetMissing) throw new Error(`BROKEN MUTANT: ${error.message}`); throw error }
    }, error => { assert.ok(!String(error?.message).startsWith('BROKEN MUTANT'), error?.message); if (process.env.MUTANT_VERBOSE) console.log(`     ${name} :: caught by: ${String(error?.message).split('\n')[0].slice(0, 140)}`); return true })
  })
}

let failed = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok   ${name}`) } catch (error) { failed++; console.log(`FAIL ${name}\n${error?.stack ?? error}`) }
}
console.log(`${tests.length - failed}/${tests.length} test groups passed, ${checks} checks`)
process.exit(failed ? 1 : 0)
