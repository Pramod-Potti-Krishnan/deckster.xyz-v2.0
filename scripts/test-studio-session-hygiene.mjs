// PASS2 #8: error / loading / session hygiene (flag NEXT_PUBLIC_STUDIO_SESSION_HYGIENE, default off).
// Offline and self-contained: no network, no browser, no database. The repo root is found from this file.
//  1. The policy module (lib/studio-session-hygiene.ts): flag reading, status -> outcome, local-origin proofs, the
//     decision table for a session id the history has no usable row for.
//  2. The REAL useBuilderSession hook (hooks/use-builder-session.ts) on a tiny hook runtime with a scripted history API:
//     bare /builder, a reload of an unsaved id, an unknown id, a deleted id, a failed lookup, a staged hand-off, a found
//     session. Flag off, every scenario does what uat does (a row is created for the URL id); flag on, none writes a row
//     except the staged hand-off, and the unknown/deleted/failed ones surface a problem and never connect.
//     When the pre-change hook is reachable in git (the base commit), the same scenarios also run on it and the flag-off
//     traces must be identical to it.
//  3. The views, server-rendered: the skeleton, the problem views, the 404 page. The flag-off 404 must render exactly what
//     the installed Next's own built-in 404 renders; the route loader must be the original element tree with the flag off.
//  4. Wiring pins on the page and the docs (.env.example, package.json), then every suite again against deliberately broken
//     copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_SESSION_HYGIENE'
const FILES = {
  lib: 'lib/studio-session-hygiene.ts',
  chat: 'hooks/use-chat-sessions.ts',
  hook: 'hooks/use-builder-session.ts',
  views: 'components/builder/studio-session-hygiene.tsx',
  card: 'components/builder/studio-problem-card.tsx',
  notFoundViews: 'components/studio-not-found.tsx',
  frameworkNotFound: 'components/framework-default-not-found.tsx',
  notFoundPage: 'app/not-found.tsx',
  css: 'components/builder/studio-session-hygiene-styles.ts',
  styleTag: 'components/builder/studio-session-hygiene-style-tag.tsx',
  page: 'app/builder/page.tsx',
}
const BASE_REF = '68e3396' // origin/studio-v4-dev-preparation-code when this change was made
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(error) })

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text; `stubs`: import specifier as written -> module object; `globals`: extra free names. */
function createWorld({ env = {}, overrides = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const names = Object.keys(globals)
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
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
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', ...names, compile(rel, source))(
      module, module.exports, require, { env }, ...names.map(name => globals[name]))
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- 1. the policy module
function policySuite(overrides = {}) {
  const on = createWorld({ env: { [FLAG]: 'true' }, overrides }).load(FILES.lib)
  const off = createWorld({ env: {}, overrides }).load(FILES.lib)

  // the flag: exact "true" only, default off
  check(assert.equal, off.STUDIO_SESSION_HYGIENE_ENABLED, false, 'flag unset -> off')
  check(assert.equal, on.STUDIO_SESSION_HYGIENE_ENABLED, true, 'flag "true" -> on')
  for (const value of ['false', 'TRUE', '1', 'yes', ' true', 'true ', '']) {
    check(assert.equal, createWorld({ env: { [FLAG]: value }, overrides }).load(FILES.lib).STUDIO_SESSION_HYGIENE_ENABLED, false, `flag ${JSON.stringify(value)} stays off`)
  }

  // status -> outcome
  const lib = on
  check(assert.deepEqual, [404, 403, 410, 401, 500, 502, 503, 0, 422].map(lib.sessionLoadKindForStatus),
    ['not_found', 'forbidden', 'gone', 'error', 'error', 'error', 'error', 'error', 'error'], 'status table')

  // local-origin proofs
  const store = (entries = {}, throws = false) => ({ getItem: key => { if (throws) throw new Error('blocked'); return key in entries ? entries[key] : null } })
  const unsaved = (owner, id) => `deckster_unsaved_v2_${encodeURIComponent(owner)}_${id}`
  check(assert.deepEqual, lib.readSessionOrigin(store({ [unsaved('u1', 's1')]: 'true' }), 'u1', 's1'), { unsavedMarker: true, stagedHandoff: false }, 'own unsaved marker')
  check(assert.deepEqual, lib.readSessionOrigin(store({ [unsaved('u1', 's1')]: 'true' }), 'u2', 's1'), { unsavedMarker: false, stagedHandoff: false }, 'another account\'s marker is no proof')
  check(assert.deepEqual, lib.readSessionOrigin(store({ [unsaved('u1', 's1')]: 'true' }), 'u1', 's2'), { unsavedMarker: false, stagedHandoff: false }, 'another id\'s marker is no proof')
  check(assert.deepEqual, lib.readSessionOrigin(store({ [unsaved('u1', 's1')]: 'false' }), 'u1', 's1'), { unsavedMarker: false, stagedHandoff: false }, 'only "true" is a marker')
  check(assert.deepEqual, lib.readSessionOrigin(store({ [unsaved('u/1 é', 's1')]: 'true' }), 'u/1 é', 's1').unsavedMarker, true, 'the owner is URI-encoded exactly like the writer')
  for (const prefix of ['deckster_composer_ready_', 'deckster_ingest_intent_', 'deckster_ingest_job_', 'deckster_pending_handoff_']) {
    check(assert.equal, lib.readSessionOrigin(store({ [`${prefix}s1`]: '{}' }), 'u1', 's1').stagedHandoff, true, `${prefix} proves a staged hand-off`)
    check(assert.equal, lib.readSessionOrigin(store({ [`${prefix}s9`]: '{}' }), 'u1', 's1').stagedHandoff, false, `${prefix} of another id is no proof`)
  }
  check(assert.deepEqual, lib.readSessionOrigin(store({}, true), 'u1', 's1'), { unsavedMarker: false, stagedHandoff: false }, 'a throwing storage is no proof')
  check(assert.deepEqual, lib.readSessionOrigin(null, 'u1', 's1'), { unsavedMarker: false, stagedHandoff: false }, 'no storage is no proof')
  check(assert.equal, lib.readSessionOrigin(store({ [unsaved('', 's1')]: 'true' }), '', 's1').unsavedMarker, false, 'no owner is no proof')

  // the decision table
  const none = { unsavedMarker: false, stagedHandoff: false }
  const local = { unsavedMarker: true, stagedHandoff: false }
  const staged = { unsavedMarker: false, stagedHandoff: true }
  const both = { unsavedMarker: true, stagedHandoff: true }
  const d = lib.decideMissingSession
  check(assert.equal, d({ kind: 'not_found' }, none), 'not_found', '404, no proof -> not found (never a new empty session)')
  check(assert.equal, d({ kind: 'not_found' }, local), 'keep_unsaved', '404 + own unsaved id -> keep it unsaved, write nothing')
  check(assert.equal, d({ kind: 'not_found' }, staged), 'adopt', '404 + staged hand-off -> adopt as before')
  check(assert.equal, d({ kind: 'not_found' }, both), 'keep_unsaved', 'the unsaved marker wins over a hand-off')
  check(assert.equal, d({ kind: 'forbidden' }, none), 'not_found', '403 reads exactly like a missing id')
  check(assert.equal, d({ kind: 'forbidden' }, local), 'not_found', '403 is never excused by a local marker')
  check(assert.equal, d({ kind: 'forbidden' }, staged), 'not_found', '403 is never excused by a hand-off')
  check(assert.equal, d({ kind: 'gone' }, none), 'deleted', '410 -> deleted')
  check(assert.equal, d({ kind: 'gone' }, both), 'deleted', '410 is never excused by local proof')
  check(assert.equal, d({ kind: 'error', status: 500 }, none), 'load_error', 'a failed lookup is never turned into a new session')
  check(assert.equal, d({ kind: 'error' }, both), 'load_error', 'a failed lookup is never excused by local proof')

  // last-session shortcut
  check(assert.equal, lib.shouldRememberLastSession(false, true), true, 'flag off: an unsaved id is remembered, as before')
  check(assert.equal, lib.shouldRememberLastSession(false, false), true)
  check(assert.equal, lib.shouldRememberLastSession(true, true), false, 'flag on: an unsaved id has no row to open, so it is not remembered')
  check(assert.equal, lib.shouldRememberLastSession(true, false), true)

  // copy and links
  for (const kind of ['not_found', 'deleted', 'load_error']) {
    const copy = lib.STUDIO_SESSION_PROBLEM_COPY[kind]
    check(assert.ok, copy.eyebrow && copy.title && copy.body, `${kind} has copy`)
    check(assert.match, copy.body, /Nothing was created or changed/, `${kind} says nothing was written`)
  }
  check(assert.deepEqual, { ...lib.STUDIO_SESSION_PROBLEM_LINKS }, { newPresentation: '/builder?session_id=new', decks: '/dashboard' })
}
policySuite()

// ---------------------------------------------------------------- 2. the real hook on a tiny hook runtime
function hookRuntime() {
  let current = null
  const impl = {
    useState: (...a) => current.useState(...a),
    useRef: (...a) => current.useRef(...a),
    useCallback: (...a) => current.useCallback(...a),
    useMemo: (...a) => current.useMemo(...a),
    useEffect: (...a) => current.useEffect(...a),
  }
  function instance(call, onDirty) {
    let cursor = 0
    const slots = []
    let pending = []
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((dep, n) => Object.is(dep, b[n]))
    const hooks = {
      useState(initial) {
        const i = cursor++
        if (!slots[i]) {
          const slot = { value: typeof initial === 'function' ? initial() : initial }
          slot.set = next => {
            const value = typeof next === 'function' ? next(slot.value) : next
            if (!Object.is(value, slot.value)) { slot.value = value; onDirty() }
          }
          slots[i] = slot
        }
        return [slots[i].value, slots[i].set]
      },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
      useCallback(fn, deps) {
        const i = cursor++, old = slots[i]
        if (old && sameDeps(deps, old.deps)) return old.fn
        slots[i] = { fn, deps }
        return fn
      },
      useMemo(fn, deps) {
        const i = cursor++, old = slots[i]
        if (old && sameDeps(deps, old.deps)) return old.value
        slots[i] = { value: fn(), deps }
        return slots[i].value
      },
      useEffect(callback, deps) {
        const i = cursor++, old = slots[i]
        if (!old || !deps || !sameDeps(deps, old.deps)) {
          const next = { deps, cleanup: old?.cleanup }
          slots[i] = next
          pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
        }
      },
    }
    return {
      render(props) {
        current = hooks; cursor = 0; pending = []
        let result
        try { result = call(props) } finally { current = null }
        for (const effect of pending) effect()
        return result
      },
      unmount() { for (const slot of slots) if (slot && typeof slot.cleanup === 'function') slot.cleanup() },
    }
  }
  return { impl, instance }
}

class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}

const OWNER = 'owner-1'
const UNKNOWN = '99999999-9999-4999-8999-999999999999'
const KNOWN = '11111111-1111-4111-8111-111111111111'
const unsavedKey = id => `deckster_unsaved_v2_${encodeURIComponent(OWNER)}_${id}`
const tick = async (n = 12) => { for (let i = 0; i < n; i++) await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)) }

/** One Builder page: it owns what page.tsx owns (the URL, currentSessionId, isUnsavedSession) and calls the real hook. */
async function runScenario(args) {
  const { log, warn, error } = console
  console.log = console.warn = console.error = () => {}
  try { return await runScenarioQuietly(args) } finally { console.log = log; console.warn = warn; console.error = error }
}
async function runScenarioQuietly({ hookSource, hygiene, url, history, storage = new MemStorage(), seed }) {
  const runtime = hookRuntime()
  const trace = { createSession: [], loadSession: [], loadSessionResult: [], replace: [], push: [], connect: 0, toast: [], restore: [], clear: 0, fetch: [] }
  const page = { url, currentSessionId: null, isUnsavedSession: false, dirty: false }
  const routeSession = () => new URLSearchParams(page.url.split('?')[1] ?? '').get('session_id')
  const initialRoute = routeSession()
  // exactly page.tsx's initial state
  page.currentSessionId = initialRoute && initialRoute !== 'new' ? initialRoute : null
  page.isUnsavedSession = Boolean(initialRoute && initialRoute !== 'new' && storage.getItem(unsavedKey(initialRoute)) === 'true')
  seed?.(storage, page)

  const win = { location: { get search() { return '?' + (page.url.split('?')[1] ?? '') } }, sessionStorage: storage }
  const env = hygiene ? { [FLAG]: 'true' } : {}
  const world = createWorld({
    env, overrides: hookSource ? { [FILES.hook]: hookSource } : {},
    globals: { window: win, sessionStorage: storage, fetch: async url => { trace.fetch.push(url); return { ok: true, status: 200, json: async () => ({}) } } },
    stubs: {
      react: runtime.impl,
      'next/navigation': { useRouter: () => ({
        replace: next => { trace.replace.push(next); page.url = next; page.dirty = true },
        push: next => { trace.push.push(next); page.url = next; page.dirty = true },
      }) },
      '@/lib/config': { features: { immediateConnection: true } },
      '@/lib/layout-service-client': { getLayoutServiceUrl: () => 'https://layout.invalid', LAYOUT_URL_CONFIG_ERROR: null,
        LAYOUT_VIEWER_URL_POLICY: { configuredOrigin: null, allowedOrigins: [] } },
    },
  })
  const hookModule = world.load(FILES.hook)
  const answer = history
  const props = () => ({
    user: { id: OWNER, email: 'owner@example.invalid' }, isAuthLoading: false,
    searchParams: new URLSearchParams(page.url.split('?')[1] ?? ''),
    loadSession: async id => { trace.loadSession.push(id); const r = answer(id); return r.kind === 'found' ? r.session : null },
    ...(hygiene ? { loadSessionResult: async id => { trace.loadSessionResult.push(id); return answer(id) } } : {}),
    createSession: async id => { trace.createSession.push(id); return { id } },
    persistence: null, connected: false, connecting: false, reconnectStatus: 'idle',
    ensureConnected: () => { trace.connect++; return true }, disconnect() {}, clearMessages() { trace.clear++ },
    restoreMessages: (...args) => trace.restore.push(args), updateCacheUserMessages() {}, messages: [],
    toast: t => trace.toast.push(t),
    isUnsavedSession: page.isUnsavedSession, setIsUnsavedSession: v => { if (v !== page.isUnsavedSession) { page.isUnsavedSession = v; page.dirty = true } },
    currentSessionId: page.currentSessionId, setCurrentSessionId: v => { if (v !== page.currentSessionId) { page.currentSessionId = v; page.dirty = true } },
    setSessionStoreName() {},
  })
  let latest
  let hookDirty = false
  const instance = runtime.instance(p => hookModule.useBuilderSession(p), () => { hookDirty = true })
  const render = () => { page.dirty = false; hookDirty = false; latest = instance.render(props()) }
  render()
  for (let i = 0; i < 40; i++) {
    await tick()
    if (page.dirty || hookDirty) render(); else if (i > 3) break
  }
  const out = {
    trace, page, storage,
    problem: latest.sessionProblem ?? null,
    isLoadingSession: latest.isLoadingSession,
    resumed: latest.isResumedSession,
    rendered: instance.render(props()),
  }
  instance.unmount()
  return out
}

const notFound = () => ({ kind: 'not_found' })
const found = (id, extra = {}) => ({ kind: 'found', session: { id, status: 'active', title: 'A deck', messages: [], currentStage: 0, slideCount: 0,
  blankPresentationUrl: null, strawmanPreviewUrl: null, finalPresentationUrl: null, blankPresentationId: null,
  strawmanPresentationId: null, finalPresentationId: null, geminiStoreName: null, ...extra } })

const SCENARIOS = {
  bare: { url: '/builder', history: notFound },
  explicitNew: { url: '/builder?session_id=new', history: notFound },
  unknown: { url: `/builder?session_id=${UNKNOWN}`, history: notFound },
  forbidden: { url: `/builder?session_id=${UNKNOWN}`, history: () => ({ kind: 'forbidden' }) },
  gone: { url: `/builder?session_id=${UNKNOWN}`, history: () => ({ kind: 'gone' }) },
  failed: { url: `/builder?session_id=${UNKNOWN}`, history: () => ({ kind: 'error', status: 500 }) },
  reloadUnsaved: { url: `/builder?session_id=${UNKNOWN}`, history: notFound, seed: storage => storage.setItem(unsavedKey(UNKNOWN), 'true') },
  staged: { url: `/builder?session_id=${UNKNOWN}`, history: notFound, seed: storage => storage.setItem(`deckster_composer_ready_${UNKNOWN}`, '{}') },
  existing: { url: `/builder?session_id=${KNOWN}`, history: id => found(id) },
}

async function scenarioSuite(overrides = {}) {
  const hookSource = overrides[FILES.hook]
  const run = (name, hygiene) => runScenario({ hookSource, hygiene, ...SCENARIOS[name] })

  // ---- flag off: exactly what uat does. A bare /builder is adopted into a row; so is an unknown id.
  {
    const bare = await run('bare', false)
    const uuid = bare.page.currentSessionId
    check(assert.match, uuid, /^[0-9a-f-]{36}$/, 'flag off: bare /builder gets a local id')
    check(assert.deepEqual, bare.trace.createSession, [uuid], 'flag off: bare /builder ends with a history row created for its own id (uat behaviour)')
    check(assert.equal, bare.page.isUnsavedSession, false, 'flag off: and the session is no longer unsaved')
    check(assert.equal, bare.problem, null, 'flag off: never a problem state')
    check(assert.deepEqual, bare.trace.loadSessionResult, [], 'flag off: the new lookup is never used')

    const unknown = await run('unknown', false)
    check(assert.deepEqual, unknown.trace.createSession, [UNKNOWN], 'flag off: an unknown id silently creates its row (uat behaviour)')
    check(assert.equal, unknown.page.currentSessionId, UNKNOWN)
    check(assert.equal, unknown.problem, null)
    check(assert.ok, unknown.trace.connect >= 1, 'flag off: and the Builder connects Director for it')
    for (const name of ['forbidden', 'gone', 'failed']) {
      const r = await run(name, false)
      check(assert.deepEqual, r.trace.createSession, [UNKNOWN], `flag off: ${name} is adopted as before`)
      check(assert.equal, r.problem, null)
    }
    const reload = await run('reloadUnsaved', false)
    check(assert.deepEqual, reload.trace.createSession, [UNKNOWN], 'flag off: a reload of an unsaved id creates its row (uat behaviour)')
    const existing = await run('existing', false)
    check(assert.deepEqual, existing.trace.createSession, [], 'flag off: an existing session is just loaded')
    check(assert.equal, existing.page.currentSessionId, KNOWN)
  }

  // ---- flag on
  {
    const bare = await run('bare', true)
    const uuid = bare.page.currentSessionId
    check(assert.match, uuid, /^[0-9a-f-]{36}$/, 'flag on: bare /builder still gets a local id (Director needs one)')
    check(assert.deepEqual, bare.trace.createSession, [], 'flag on: bare /builder writes NO history row')
    check(assert.equal, bare.page.isUnsavedSession, true, 'flag on: it stays an unsaved session until a first real action')
    check(assert.equal, bare.storage.getItem(unsavedKey(uuid)), 'true', 'flag on: and it keeps its unsaved marker')
    check(assert.equal, bare.problem, null)
    check(assert.deepEqual, bare.trace.loadSessionResult, [uuid], 'flag on: the id is still looked up once (a row that exists is resumed)')
    check(assert.deepEqual, bare.trace.replace.length, 1, 'flag on: the URL is still rewritten to the local id once')
    check(assert.ok, bare.trace.connect >= 1, 'flag on: and Director still connects for it')
    check(assert.equal, bare.isLoadingSession, false)

    const explicit = await run('explicitNew', true)
    check(assert.deepEqual, explicit.trace.createSession, [], 'flag on: ?session_id=new writes no row either')
    check(assert.equal, explicit.page.isUnsavedSession, true)

    const reload = await run('reloadUnsaved', true)
    check(assert.deepEqual, reload.trace.createSession, [], 'flag on: a reload of an unsaved id writes no row')
    check(assert.equal, reload.page.currentSessionId, UNKNOWN)
    check(assert.equal, reload.page.isUnsavedSession, true)
    check(assert.equal, reload.problem, null)

    for (const [name, kind] of [['unknown', 'not_found'], ['forbidden', 'not_found'], ['gone', 'deleted'], ['failed', 'load_error']]) {
      const r = await run(name, true)
      check(assert.deepEqual, r.trace.createSession, [], `flag on: ${name} writes no row`)
      check(assert.deepEqual, r.problem, { kind, sessionId: UNKNOWN }, `flag on: ${name} -> ${kind}`)
      check(assert.equal, r.page.currentSessionId, null, `flag on: ${name} adopts no session id`)
      check(assert.equal, r.trace.connect, 0, `flag on: ${name} never connects Director`)
      check(assert.equal, r.isLoadingSession, false, `flag on: ${name} stops loading`)
      check(assert.deepEqual, r.trace.push, [], `flag on: ${name} navigates nowhere on its own`)
    }

    const staged = await run('staged', true)
    check(assert.deepEqual, staged.trace.createSession, [UNKNOWN], 'flag on: a staged hand-off still gets its row, as before')
    check(assert.equal, staged.problem, null)

    const existing = await run('existing', true)
    check(assert.deepEqual, existing.trace.createSession, [], 'flag on: an existing session is just loaded')
    check(assert.equal, existing.page.currentSessionId, KNOWN)
    check(assert.equal, existing.problem, null)
    check(assert.equal, existing.resumed, false, 'flag on: no messages -> not "resumed", like flag off')
  }
}
await scenarioSuite()

// recover from a problem state: the URL moves to ?session_id=new and the page is a fresh unsaved session
{
  const quiet = console.warn; console.warn = () => {}
  const runtime = hookRuntime()
  const storage = new MemStorage()
  const page = { url: `/builder?session_id=${UNKNOWN}`, currentSessionId: UNKNOWN, isUnsavedSession: false, dirty: false }
  const calls = { createSession: [] }
  const win = { location: { get search() { return '?' + (page.url.split('?')[1] ?? '') } }, sessionStorage: storage }
  const world = createWorld({ env: { [FLAG]: 'true' }, globals: { window: win, sessionStorage: storage, fetch: async () => ({ ok: true, json: async () => ({}) }) },
    stubs: { react: runtime.impl, '@/lib/config': { features: { immediateConnection: true } },
      'next/navigation': { useRouter: () => ({ replace: next => { page.url = next; page.dirty = true }, push: next => { page.url = next; page.dirty = true } }) },
      '@/lib/layout-service-client': { getLayoutServiceUrl: () => 'x', LAYOUT_URL_CONFIG_ERROR: null, LAYOUT_VIEWER_URL_POLICY: { configuredOrigin: null, allowedOrigins: [] } } } })
  const hookModule = world.load(FILES.hook)
  let hookDirty = false
  const instance = runtime.instance(p => hookModule.useBuilderSession(p), () => { hookDirty = true })
  const props = () => ({ user: { id: OWNER }, isAuthLoading: false, searchParams: new URLSearchParams(page.url.split('?')[1] ?? ''),
    loadSession: async () => null, loadSessionResult: async () => ({ kind: 'not_found' }), createSession: async id => { calls.createSession.push(id); return { id } },
    persistence: null, connected: false, connecting: false, reconnectStatus: 'idle', ensureConnected: () => true, disconnect() {}, clearMessages() {},
    restoreMessages() {}, updateCacheUserMessages() {}, messages: [], toast() {},
    isUnsavedSession: page.isUnsavedSession, setIsUnsavedSession: v => { page.isUnsavedSession = v; page.dirty = true },
    currentSessionId: page.currentSessionId, setCurrentSessionId: v => { page.currentSessionId = v; page.dirty = true }, setSessionStoreName() {} })
  let latest
  const render = () => { page.dirty = false; hookDirty = false; latest = instance.render(props()) }
  const settle = async () => { for (let i = 0; i < 40; i++) { await tick(); if (page.dirty || hookDirty) render(); else if (i > 3) break } }
  render(); await settle()
  check(assert.equal, latest.sessionProblem?.kind, 'not_found', 'problem shown')
  page.url = '/builder?session_id=new'; page.dirty = true
  await settle()
  check(assert.equal, latest.sessionProblem, null, 'moving to ?session_id=new clears the problem')
  check(assert.equal, page.isUnsavedSession, true, 'and starts a fresh unsaved session')
  check(assert.deepEqual, calls.createSession, [], 'with no row written')
  instance.unmount()
  console.warn = quiet
}

// flag off, the SAME scenarios on the pre-change hook (when the base commit is reachable): identical traces
{
  var baseCompared = 0
  let baseSource = null
  try { baseSource = execFileSync('git', ['show', `${BASE_REF}:${FILES.hook}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* base not reachable: parity is pinned by the explicit flag-off expectations above */ }
  if (baseSource) {
    check(assert.equal, baseSource.includes('STUDIO_SESSION_HYGIENE'), false, 'the base hook is the pre-change one')
    for (const name of Object.keys(SCENARIOS)) {
      const strip = r => ({
        createSession: r.trace.createSession.map(id => id === UNKNOWN || id === KNOWN ? id : '<local>'),
        loadSession: r.trace.loadSession.map(id => id === UNKNOWN || id === KNOWN ? id : '<local>'),
        replace: r.trace.replace.length, push: r.trace.push, connect: r.trace.connect > 0, clear: r.trace.clear,
        unsaved: r.page.isUnsavedSession, loading: r.isLoadingSession, restore: r.trace.restore.length,
        current: r.page.currentSessionId === UNKNOWN || r.page.currentSessionId === KNOWN ? r.page.currentSessionId : '<local>',
        marker: [...r.storage.map.keys()].map(k => k.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (m) => m === UNKNOWN || m === KNOWN ? m : '<local>')).sort(),
      })
      const before = await runScenario({ hookSource: baseSource, hygiene: false, ...SCENARIOS[name] })
      const after = await runScenario({ hookSource: undefined, hygiene: false, ...SCENARIOS[name] })
      check(assert.deepEqual, strip(after), strip(before), `flag off: ${name} behaves exactly as the pre-change hook`)
      baseCompared++
    }
  }
}

// ---------------------------------------------------------------- 3. the views
const noop = () => null
const viewWorld = (env, overrides = {}) => createWorld({
  env, overrides,
  stubs: {
    '@/components/layout/studio-rail': { StudioRail: ({ studioEntry }) => React.createElement('aside', { 'data-rail-stub': 'true' }, studioEntry) },
    '@/components/layout/studio-navigation-hint': { StudioNavigationHint: ({ children }) => children },
  },
})
const html = element => renderToStaticMarkup(element)

async function viewSuite(overrides = {}) {
  const views = viewWorld({ [FLAG]: 'true' }, overrides).load(FILES.views)
  const nf = viewWorld({ [FLAG]: 'true' }, overrides).load(FILES.notFoundViews)

  // skeleton: the shell, the message, accessible status, no empty page
  const skeleton = html(React.createElement(views.StudioBuilderSkeleton, {}))
  check(assert.match, skeleton, /data-studio-skeleton="true"/)
  check(assert.match, skeleton, /<style data-studio-session-hygiene="true">/, 'the skeleton carries its own css')
  check(assert.match, skeleton, /role="status"/)
  check(assert.match, skeleton, /aria-live="polite"/)
  check(assert.match, skeleton, /Loading builder\.\.\./, 'the loader keeps its words')
  check(assert.equal, (skeleton.match(/<span data-studio-skel-nav-item="/g) || []).length, 7, 'the rail shows all seven destinations (an attribute that is undefined is not rendered, so the css would miss it)')
  for (const part of ['rail', 'header', 'chat', 'canvas', 'slides', 'composer', 'toolbar']) {
    check(assert.match, skeleton, new RegExp(`data-studio-skel-${part}="true"`), `skeleton has the ${part}`)
  }
  check(assert.match, html(React.createElement(views.StudioBuilderSkeleton, { message: 'Redirecting to sign in...' })), /Redirecting to sign in\.\.\./, 'the message is the caller\'s')
  check(assert.doesNotMatch, skeleton, /<a |<button|href=/, 'the skeleton has no links or buttons to click before the app is ready')

  // problem views
  for (const [kind, title] of [['not_found', 'We couldn’t find this session.'], ['deleted', 'This session was deleted.'], ['load_error', 'We couldn’t open this session just now.']]) {
    const view = html(React.createElement(views.StudioSessionProblemView, { problem: kind, studioShell: true }))
    check(assert.match, view, new RegExp(`data-studio-session-problem="${kind}"`))
    check(assert.match, view, /<style data-studio-session-hygiene="true">/, `${kind} carries its own css`)
    check(assert.ok, view.includes(title), `${kind} headline`)
    check(assert.match, view, /role="alert"/)
    check(assert.match, view, /href="\/builder\?session_id=new"[^>]*>Start a new presentation</, `${kind}: a way to start fresh`)
    check(assert.match, view, /href="\/dashboard"[^>]*>Go to Decks</, `${kind}: a way to the decks`)
    check(assert.match, view, /data-rail-stub/, `${kind}: inside the studio shell`)
    check(assert.equal, /Try again/.test(view), kind === 'load_error', `${kind}: Try again only for a failed lookup`)
  }
  check(assert.doesNotMatch, html(React.createElement(views.StudioSessionProblemView, { problem: 'not_found', studioShell: false })), /data-rail-stub/, 'no rail when the shell is off')

  // 404 page
  const notFoundHtml = html(React.createElement(nf.StudioNotFound, {}))
  check(assert.match, notFoundHtml, /<style data-studio-session-hygiene="true">/, 'the 404 page carries its own css')
  check(assert.match, notFoundHtml, /Error 404/)
  check(assert.match, notFoundHtml, /href="\/builder"[^>]*>Back to Studio</)
  check(assert.match, notFoundHtml, /href="\/dashboard"[^>]*>Go to Decks</)
  check(assert.match, notFoundHtml, /<h1 style="text-wrap:balance">We couldn’t find that page\.<\/h1>/)
  check(assert.match, notFoundHtml, /<title>Page not found \| Deckster<\/title>/, 'the tab says what happened')

  // 404 with the flag off = the installed Next's own built-in 404, character for character
  {
    const builtin = nodeRequire('next/dist/client/components/http-access-fallback/error-fallback')
    const expected = html(React.createElement(builtin.HTTPAccessErrorFallback, { status: 404, message: 'This page could not be found.' }))
    const offPage = createWorld({ env: {}, overrides }).load(FILES.notFoundPage).default
    check(assert.equal, html(await offPage()), expected, 'flag off: app/not-found.tsx renders exactly what Next renders without it')
    // and it never reaches the Studio view (or its stylesheets) with the flag off
    const touched = []
    const offWorld = createWorld({ env: {}, overrides, stubs: { '@/components/studio-not-found': new Proxy({}, { get() { touched.push('studio-not-found'); return () => null } }) } })
    await offWorld.load(FILES.notFoundPage).default()
    check(assert.deepEqual, touched, [], 'flag off: the Studio 404 module is not even loaded')
    const onPage = createWorld({ env: { [FLAG]: 'true' }, overrides, stubs: {} }).load(FILES.notFoundPage).default
    const onHtml = html(await onPage())
    check(assert.notEqual, onHtml, expected, 'flag on: the Studio page')
    check(assert.match, onHtml, /data-studio-not-found="true"/)
  }

  // the route loader: flag off it is the original element tree for both shells; flag on + Studio shell it is the skeleton
  {
    const pageSource = overrides[FILES.page] ?? SRC.page
    const fnSource = pageSource.slice(pageSource.indexOf('function BuilderLoadingState('), pageSource.indexOf('function BuilderAuthBoundary('))
    check(assert.ok, fnSource.includes('NEXT_PUBLIC_STUDIO_SESSION_HYGIENE') || fnSource.includes('STUDIO_SESSION_HYGIENE_ENABLED'), 'the loader is where the flag is read')
    const ORIGINAL = `function BuilderLoadingState({ message = 'Loading builder...' }: { message?: string }) {
    if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true') return <StudioWaitingState scope="screen" message={message} />
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    )
  }
  `
    const build = (source, env) => {
      const code = ts.transpileModule(`${source}\nmodule.exports = { BuilderLoadingState }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText
      const mod = { exports: {} }
      const waiting = ({ scope, message }) => React.createElement('div', { 'data-waiting-stub': scope }, message)
      const skeleton = ({ message }) => React.createElement('div', { 'data-skeleton-stub': 'true' }, message)
      new Function('module', 'exports', 'React', 'process', 'StudioWaitingState', 'StudioBuilderSkeleton', 'STUDIO_SESSION_HYGIENE_ENABLED', code)(
        mod, mod.exports, React, { env }, waiting, skeleton, env[FLAG] === 'true')
      return mod.exports.BuilderLoadingState
    }
    for (const shell of ['true', 'false', undefined]) {
      for (const message of [undefined, 'Redirecting to sign in...']) {
        const env = shell === undefined ? {} : { NEXT_PUBLIC_STUDIO_V4_SHELL: shell }
        const original = html(React.createElement(build(ORIGINAL, env), { message }))
        const current = html(React.createElement(build(fnSource, env), { message }))
        check(assert.equal, current, original, `flag off, shell ${shell}: the route loader is byte-identical to uat`)
      }
    }
    const onShell = html(React.createElement(build(fnSource, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }), {}))
    check(assert.match, onShell, /data-skeleton-stub/, 'flag on + Studio shell: the skeleton')
    const onLegacy = html(React.createElement(build(fnSource, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }), {}))
    check(assert.equal, onLegacy, html(React.createElement(build(ORIGINAL, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' }), {})), 'flag on without the Studio shell: the legacy loader is untouched')
  }
}
await viewSuite()

// ---------------------------------------------------------------- 4. wiring pins and docs
function wiringSuite(sources = SRC, envex = ENVEX, pkg = PKG) {
  check(assert.match, envex, /^NEXT_PUBLIC_STUDIO_SESSION_HYGIENE="false"$/m, '.env.example documents the flag, default "false"')
  check(assert.equal, pkg.scripts['test:studio-session-hygiene'], 'node scripts/test-studio-session-hygiene.mjs', 'package.json runs this suite')
  check(assert.match, sources.lib, /process\.env\.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true'/, 'the flag is read as the literal env name so the build inlines it, exact "true"')
  // page: loader, problem view, last-session shortcut
  check(assert.match, sources.page, /import \{ STUDIO_SESSION_HYGIENE_ENABLED, shouldRememberLastSession \} from '@\/lib\/studio-session-hygiene'/)
  check(assert.match, sources.page, /if \(STUDIO_SESSION_HYGIENE_ENABLED && session\.sessionProblem\) \{\s*return <StudioSessionProblemView problem=\{session\.sessionProblem\.kind\} studioShell=\{studioShell\} \/>\s*\}/, 'the page shows the problem view instead of the workspace')
  check(assert.match, sources.page, /if \(STUDIO_SESSION_HYGIENE_ENABLED && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\) return <StudioBuilderSkeleton message=\{message\} \/>/, 'the loader is the skeleton')
  check(assert.match, sources.page, /shouldRememberLastSession\(STUDIO_SESSION_HYGIENE_ENABLED, isUnsavedSession\)/, 'the last-session shortcut skips an unsaved session')
  check(assert.match, sources.page, /const \{ loadSession, loadSessionResult, createSession \} = useChatSessions\(\)/)
  check(assert.match, sources.page, /loadSession,\s*loadSessionResult,\s*createSession,\s*persistence,/, 'the hook gets the new lookup')
  // the problem return sits after every hook of the component: it is the last thing before the main JSX return
  const problemAt = sources.page.indexOf('if (STUDIO_SESSION_HYGIENE_ENABLED && session.sessionProblem)')
  const mainReturnAt = sources.page.indexOf('<StudioIntroductionProvider enabled={studioShell}')
  check(assert.ok, problemAt > 0 && mainReturnAt > problemAt && mainReturnAt - problemAt < 600, 'the problem return is right before the main return')
  const afterProblem = sources.page.slice(problemAt)
  check(assert.doesNotMatch, afterProblem.slice(0, afterProblem.indexOf('<StudioIntroductionProvider')), /\buse(State|Effect|Ref|Memo|Callback)\(/, 'no hook sits between the early return and the main return')
  // hook: the lookup is only used behind the flag; the old path is untouched
  check(assert.match, sources.hook, /STUDIO_SESSION_HYGIENE_ENABLED && loadSessionResult \? await loadSessionResult\(sessionParam\) : null/)
  check(assert.match, sources.hook, /: await loadSession\(sessionParam\)/, 'the original lookup is still the flag-off path')
  check(assert.match, sources.hook, /console\.warn\('⚠️ Session not found in frontend DB, adopting URL session:', sessionParam\)\s*\n\s*const adopted = await createSession\(sessionParam\)/, 'the original adoption branch is intact')
  check(assert.match, sources.hook, /if \(STUDIO_SESSION_HYGIENE_ENABLED\) setSessionProblem\(null\)/)
  // chat sessions: the new lookup never writes
  const loadResultSource = sources.chat.slice(sources.chat.indexOf('const loadSessionResult'), sources.chat.indexOf('const createSession'))
  check(assert.doesNotMatch, loadResultSource, /method:|POST|PATCH|DELETE|createSession/, 'loadSessionResult is read-only')
  // not-found page
  check(assert.match, sources.notFoundPage, /if \(process\.env\.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true'\) \{\s*\n\s*const \{ StudioNotFound \} = await import\('@\/components\/studio-not-found'\)\s*\n\s*return <StudioNotFound \/>\s*\n\s*\}\s*\n\s*return <FrameworkDefaultNotFound \/>/, 'the 404 page tests the flag inline, around the lazy import, so the build drops the Studio view with the flag off')
  check(assert.doesNotMatch, sources.notFoundPage, /^import .*\.css'/m, 'the 404 page imports no stylesheet itself')
  check(assert.doesNotMatch, sources.frameworkNotFound, /\.css'/, 'the framework-default 404 imports no stylesheet')
  check(assert.match, sources.frameworkNotFound, /const STATUS = 404 \/\/ a number[\s\S]*<h1 className="next-error-h1" style=\{defaultStyles\.h1\}>\{STATUS\}<\/h1>/, 'the status is a number, like the built-in, so the flight payload matches')
  // css: an inline string (a stylesheet import would be linked from the Builder and the 404 document even with the flag off)
  for (const rel of [FILES.views, FILES.card, FILES.notFoundViews, FILES.frameworkNotFound, FILES.notFoundPage, FILES.styleTag, FILES.css]) {
    const source = Object.entries(FILES).find(([, v]) => v === rel)[0]
    check(assert.doesNotMatch, sources[source], /^import\s+['"][^'"]+\.css['"]/m, `${rel} imports no stylesheet`)
  }
  check(assert.match, sources.styleTag, /<style data-studio-session-hygiene="true" dangerouslySetInnerHTML=\{\{ __html: STUDIO_SESSION_HYGIENE_CSS \}\} \/>/)
  for (const key of ['views', 'notFoundViews']) check(assert.match, sources[key], /<StudioSessionHygieneStyles \/>/, `${key} renders its stylesheet inline`)
  const cssText = sources.css.slice(sources.css.indexOf('`') + 1, sources.css.lastIndexOf('`'))
  // Tailwind scans every source file (comments included) for class-like words; one that is not used anywhere else in the app
  // adds a utility rule to the GLOBAL stylesheet, which is then no longer identical to uat's with the flag off. This design
  // once did exactly that with the CSS property text-wrap. Keep these files free of it (React's textWrap style prop is fine).
  for (const key of ['css', 'card', 'views', 'notFoundViews', 'frameworkNotFound', 'styleTag', 'notFoundPage']) {
    check(assert.doesNotMatch, sources[key], /text-wrap/, `${key}: no Tailwind-visible text-wrap`)
  }
  check(assert.doesNotMatch, cssText, /`|\$\{|\\/, 'the css string needs no escaping')
  const selectors = cssText.replace(/\/\*[\s\S]*?\*\//g, '').split('{').map(chunk => chunk.split('}').pop().trim()).filter(Boolean)
    .filter(sel => !/^(from|to|\d+%)$/.test(sel) && !sel.startsWith('@'))
  for (const group of selectors) {
    for (const sel of group.split(',').map(x => x.trim()).filter(Boolean)) {
      check(assert.match, sel, /\[data-studio-(skeleton|session-problem|not-found|skel-|problem-)|\.studio-skel-block/, `css selector is scoped: ${sel}`)
    }
  }
}
wiringSuite()

// ---------------------------------------------------------------- 5. mutants: broken copies must be caught
async function mutantSuite() {
  const mutants = []
  const mutate = (name, rel, from, to, suites = ['policy', 'scenario', 'view', 'wiring']) => {
    const source = SRC[Object.keys(FILES).find(k => FILES[k] === rel)] ?? read(rel)
    assert.ok(source.includes(from), `mutant ${name}: anchor not found in ${rel}`)
    mutants.push({ name, rel, source: source.replace(from, to), suites })
  }
  const L = FILES.lib, H = FILES.hook
  mutate('flag reads loosely', L, "=== 'true'", "!== 'false'")
  mutate('404 with no proof is adopted', L, "      return 'not_found'\n    case 'forbidden'", "      return 'adopt'\n    case 'forbidden'")
  mutate('unsaved marker ignored', L, "if (origin.unsavedMarker) return 'keep_unsaved'", '')
  mutate('staged hand-off ignored', L, "if (origin.stagedHandoff) return 'adopt'", '')
  mutate('403 treated as missing-but-adoptable', L, "case 'forbidden': return 'not_found'", "case 'forbidden': return 'adopt'")
  mutate('410 not deleted', L, "case 'gone': return 'deleted'", "case 'gone': return 'not_found'")
  mutate('failed lookup adopted', L, "case 'error': return 'load_error'", "case 'error': return 'adopt'")
  mutate('wrong owner marker accepted', L, "unsavedBuilderSessionKey(ownerId, sessionId)", "unsavedBuilderSessionKey('x', sessionId)")
  mutate('status table 403', L, "if (status === 403) return 'forbidden'", "if (status === 403) return 'error'")
  mutate('last session remembered when unsaved', L, 'return !(hygiene && isUnsavedSession)', 'return true')
  mutate('hook ignores the decision', H, "} else if (missingDecision === 'keep_unsaved') {", "} else if (false) {", ['scenario', 'wiring'])
  mutate('hook writes a row for unsaved ids', H, "setIsUnsavedSession(true)\n            setIsResumedSession(false)\n            debugLog('🆕 [SESSION-HYGIENE]", "setIsUnsavedSession(true)\n            await createSession(sessionParam)\n            setIsResumedSession(false)\n            debugLog('🆕 [SESSION-HYGIENE]", ['scenario'])
  mutate('hook keeps a bad id as current', H, "setCurrentSessionId(null)\n            setSessionStoreName(null)\n            setIsUnsavedSession(false)\n            setIsResumedSession(false)\n            setSessionProblem", "setSessionStoreName(null)\n            setIsUnsavedSession(false)\n            setIsResumedSession(false)\n            setSessionProblem", ['scenario'])
  mutate('hook does not clear a problem', H, 'if (STUDIO_SESSION_HYGIENE_ENABLED) setSessionProblem(null)', '', ['scenario', 'wiring'])
  mutate('hook uses the lookup with the flag off', H, 'STUDIO_SESSION_HYGIENE_ENABLED && loadSessionResult ?', 'loadSessionResult ?', ['scenario', 'wiring'])
  mutate('hook adopts the failure path', H, "} else if (missingDecision && missingDecision !== 'adopt') {", "} else if (false) {", ['scenario'])
  mutate('chat lookup writes', FILES.chat, "return { kind: 'error' };\n    } finally {", "await createSession(sessionId); return { kind: 'error' };\n    } finally {", ['wiring'])
  mutate('page loses the problem view', FILES.page, 'if (STUDIO_SESSION_HYGIENE_ENABLED && session.sessionProblem) {', 'if (false) {', ['wiring'])
  mutate('page loader ignores the flag', FILES.page, "if (STUDIO_SESSION_HYGIENE_ENABLED && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true') return <StudioBuilderSkeleton", "if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true') return <StudioBuilderSkeleton", ['wiring', 'view'])
  mutate('page last-session ignores unsaved', FILES.page, 'shouldRememberLastSession(STUDIO_SESSION_HYGIENE_ENABLED, isUnsavedSession)', 'true', ['wiring'])
  mutate('404 default drifts', FILES.frameworkNotFound, "margin: '0 20px 0 0'", "margin: '0 24px 0 0'", ['view'])
  mutate('404 default status as text', FILES.frameworkNotFound, 'const STATUS = 404', "const STATUS = '404'", ['wiring'])
  mutate('404 page ignores the flag', FILES.notFoundPage, "if (process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true') {", 'if (true) {', ['view', 'wiring'])
  mutate('404 default imports a stylesheet', FILES.frameworkNotFound, 'const defaultStyles', "import '@/components/builder/studio-session-hygiene.css'\nconst defaultStyles", ['wiring'])
  mutate('skeleton loses its status role', FILES.views, 'role="status" aria-live="polite" aria-busy="true"', '', ['view'])
  mutate('problem view loses its way out', FILES.views, '<a data-studio-problem-action="secondary" href={STUDIO_SESSION_PROBLEM_LINKS.decks}>Go to Decks</a>', '', ['view'])
  mutate('css leaks to the page', FILES.css, '[data-studio-skel-header="true"] { flex: 0 0 48px;', 'header { flex: 0 0 48px;', ['wiring'])
  mutate('css gets a Tailwind-visible word', FILES.css, 'letter-spacing: -.02em; color: var(--sk-text); }', 'letter-spacing: -.02em; color: var(--sk-text); text-wrap: balance; }', ['wiring'])
  mutate('a view imports a stylesheet again', FILES.views, "import { Layers } from 'lucide-react'", "import './x.css'\nimport { Layers } from 'lucide-react'", ['wiring'])
  mutate('404 view loses its inline css', FILES.notFoundViews, '      <StudioSessionHygieneStyles />\n', '', ['view', 'wiring'])
  mutate('skeleton loses its inline css', FILES.views, '      <StudioSessionHygieneStyles />\n      <aside data-studio-skel-rail', '      <aside data-studio-skel-rail', ['view', 'wiring'])

  let caught = 0
  for (const mutant of mutants) {
    const overrides = { [mutant.rel]: mutant.source }
    let failed = false
    for (const suite of mutant.suites) {
      try {
        if (suite === 'policy') policySuite(overrides)
        else if (suite === 'scenario') await scenarioSuite(overrides)
        else if (suite === 'view') await viewSuite(overrides)
        else if (suite === 'wiring') {
          const key = Object.keys(FILES).find(k => FILES[k] === mutant.rel)
          wiringSuite({ ...SRC, [key]: mutant.source })
        }
      } catch { failed = true; break }
    }
    assert.ok(failed, `MUTANT SURVIVED: ${mutant.name}`)
    caught++
  }
  return { mutants: mutants.length, caught }
}
// package.json / .env.example mutants (docs pins)
assert.throws(() => wiringSuite(SRC, ENVEX.replace('NEXT_PUBLIC_STUDIO_SESSION_HYGIENE="false"', 'NEXT_PUBLIC_STUDIO_SESSION_HYGIENE="true"')), 'a documented default of true is caught')
assert.throws(() => wiringSuite(SRC, ENVEX, { ...PKG, scripts: { ...PKG.scripts, 'test:studio-session-hygiene': undefined } }), 'an unregistered suite is caught')
checks += 2
const { mutants, caught } = await mutantSuite()

await tick()
assert.deepEqual(unhandled, [], 'no unhandled rejection')
console.log(`studio session hygiene: ${checks} checks passed; ${caught}/${mutants} mutants caught; flag-off traces compared with the pre-change hook (${BASE_REF}): ${baseCompared === 0 ? 'base not reachable in git, skipped' : `${baseCompared} scenarios identical`}`)
