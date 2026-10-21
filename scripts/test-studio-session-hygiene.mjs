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
//  2b. (fix-forward) The REAL useChatSessions + useSessionPersistence + useBuilderSession wired as the page wires them, against a
//     history API that 404s unknown ids like the real one: a bare /builder plus Director's blank-deck frames and idle writes
//     NOTHING with the flag on (no PATCH, no POST), the first real action creates exactly one row and metadata flows after it,
//     a saved session is never mistaken for an unsaved one, the pre-fix hook reproduces the live trace, and with the flag off
//     the request logs are hash-identical to the pre-fix hooks.
//  2c. (fix-forward 2, FRONTEND-2 J4 S6) The first state-changing click on a blank canvas saves the row, so a second tab opens the
//     session. The REAL hooks/use-save-session-on-first-action.ts wrapping the REAL handleRequestSession, plus the persistence
//     hook's held blank-deck metadata: a theme/template pick, a manual Add Slide/Element save exactly one row (one POST 201, one
//     metadata PATCH, never a 409 or a second POST, picking twice or at once changes nothing), Director's presentation_init plus
//     idle still write nothing, an upload / first message after it makes no second row, a failed save retries on the next click,
//     the second tab finds the row, flag off is hash-identical to the base, and the page's four trigger handlers (extracted and
//     run) call it only when the selection is not locked.
//  3. The views, server-rendered: the skeleton, the problem views, the 404 page. The flag-off 404 must render exactly what
//     the installed Next's own built-in 404 renders; the route loader must be the original element tree with the flag off.
//  4. Wiring pins on the page and the docs (.env.example, package.json), then every suite again against deliberately broken
//     copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_SESSION_HYGIENE'
const FILES = {
  lib: 'lib/studio-session-hygiene.ts',
  chat: 'hooks/use-chat-sessions.ts',
  persist: 'hooks/use-session-persistence.ts',
  hook: 'hooks/use-builder-session.ts',
  views: 'components/builder/studio-session-hygiene.tsx',
  card: 'components/builder/studio-problem-card.tsx',
  notFoundViews: 'components/studio-not-found.tsx',
  frameworkNotFound: 'components/framework-default-not-found.tsx',
  notFoundPage: 'app/not-found.tsx',
  css: 'components/builder/studio-session-hygiene-styles.ts',
  styleTag: 'components/builder/studio-session-hygiene-style-tag.tsx',
  page: 'app/builder/page.tsx',
  saveOnAction: 'hooks/use-save-session-on-first-action.ts',
  viewer: 'components/presentation-viewer.tsx',
  area: 'components/builder/presentation-area.tsx',
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

  // first-action save (fix-forward 2): when a click saves the row, and what is held back until then
  const save = lib.shouldSaveSessionOnFirstAction
  const fresh = { sessionId: 's1', isUnsavedSession: true, savedHereId: null }
  check(assert.equal, save(true, fresh), true, 'flag on, an unsaved session: the click saves it')
  check(assert.equal, save(false, fresh), false, 'flag off: never')
  for (const sessionId of [null, undefined, '', 'new']) check(assert.equal, save(true, { ...fresh, sessionId }), false, `no usable session id (${JSON.stringify(sessionId)}): nothing to save`)
  check(assert.equal, save(true, { ...fresh, isUnsavedSession: false }), false, 'a saved session: nothing to do')
  check(assert.equal, save(true, { ...fresh, savedHereId: 's1' }), false, 'this tab already saved it (React has not re-rendered yet): once only')
  check(assert.equal, save(true, { ...fresh, savedHereId: 's0' }), true, 'this tab saved ANOTHER session earlier: this one still needs its row')
  const hold = lib.deferMetadata, take = lib.takeDeferredMetadata
  const first = hold(null, 's1', { slideCount: 1, blankPresentationId: 'b1' })
  check(assert.deepEqual, first, { sessionId: 's1', updates: { slideCount: 1, blankPresentationId: 'b1' } }, 'metadata is held per session')
  const merged = hold(first, 's1', { blankPresentationId: 'b2', currentStage: 0 })
  check(assert.deepEqual, merged, { sessionId: 's1', updates: { slideCount: 1, blankPresentationId: 'b2', currentStage: 0 } }, 'newer fields win, older ones stay')
  check(assert.deepEqual, first.updates, { slideCount: 1, blankPresentationId: 'b1' }, 'holding never mutates what was held')
  check(assert.deepEqual, hold(merged, 's2', { slideCount: 4 }), { sessionId: 's2', updates: { slideCount: 4 } }, 'a different session replaces the old hold, nothing leaks across')
  check(assert.deepEqual, take(merged, 's1'), merged.updates, 'taking returns what was held for that session')
  check(assert.equal, take(merged, 's2'), null, 'and nothing for another session')
  check(assert.equal, take(null, 's1'), null, 'and nothing when nothing is held')

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

// ---------------------------------------------------------------- 2b. the real persistence wiring (fix-forward for PR #361)
// The scenarios above hand the hook `persistence: null` and answer every fetch with 200, so they could not see the second
// writer. A bare /builder is an unsaved local id with no history row; Director then sends its blank-deck frame
// (presentation_init), the page's onSessionStateChange calls persistence.updateMetadata, and that PATCHed a row that does not
// exist: 404, four attempts, then updateSession's recovery POSTed the row. This section drives the REAL useChatSessions,
// useSessionPersistence and useBuilderSession together, wired as app/builder/page.tsx wires them (enabled: !!currentSessionId &&
// !isUnsavedSession, the ref-based onSessionStateChange guard), against a history API that behaves like the real one:
// unknown id -> 404 on GET/PATCH/messages, POST creates (201) or 409s.
const PERSIST_BASE_REF = '5cc455d' // origin/studio-v4-dev-preparation-code (after #360/#365): the base of the session-hygiene-b fix-forward
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

function historyApi(knownIds = []) {
  const rows = new Map(knownIds.map(id => [id, { id, status: 'active', title: 'A deck', messages: [], currentStage: 0, slideCount: 0,
    blankPresentationUrl: null, strawmanPreviewUrl: null, finalPresentationUrl: null, blankPresentationId: null,
    strawmanPresentationId: null, finalPresentationId: null, geminiStoreName: null }]))
  const calls = []
  const faults = { posts: 0 } // the next N row-creating POSTs answer 500
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body, text: async () => JSON.stringify(body) })
  async function fetch(url, init = {}) {
    await new Promise(resolve => setImmediate(resolve)) // network latency: the request is handled a turn after it is sent, so two in flight at once overlap as they do for real
    const method = String(init.method || 'GET').toUpperCase()
    const body = init.body ? JSON.parse(init.body) : null
    const m = /^\/api\/sessions(?:\/([^/?]+))?(?:\/(messages|files))?(?:\?.*)?$/.exec(url)
    let status = 200, out = {}
    if (!m) { out = {} }
    else if (!m[1]) {
      if (method === 'POST' && faults.posts > 0) { faults.posts--; status = 500; out = { error: 'boom' } }
      else if (method === 'POST') {
        if (rows.has(body.sessionId)) { status = 409; out = { session: rows.get(body.sessionId) } }
        else { const row = { id: body.sessionId, status: 'active', title: body.title || 'Untitled Session', messages: [] }; rows.set(row.id, row); status = 201; out = { session: row } }
      } else out = { sessions: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }
    } else if (!rows.has(m[1])) { status = 404; out = { error: 'Session not found' } }
    else if (m[2] === 'messages') { const n = (body?.messages ?? []).length; rows.get(m[1]).messages.push(...(body?.messages ?? [])); out = { saved: n, failed: 0, total: n } }
    else if (method === 'PATCH') { Object.assign(rows.get(m[1]), body); out = { session: rows.get(m[1]) } }
    else out = { session: rows.get(m[1]) }
    calls.push({ method, url, body, status })
    return reply(status, out)
  }
  const isWrite = c => /^\/api\/sessions/.test(c.url) && (c.method === 'POST' || c.method === 'PATCH' || c.method === 'PUT' || c.method === 'DELETE')
  return {
    fetch, rows, calls, faults,
    writes: () => calls.filter(isWrite),
    sessionWrites: () => calls.filter(c => isWrite(c) && !/\/messages$/.test(c.url)), // row creations and metadata PATCHes, the "Untitled Session" makers
    rowCreations: () => calls.filter(c => c.method === 'POST' && c.url === '/api/sessions' && c.status === 201),
    count: (method, status) => calls.filter(c => c.method === method && c.status === status).length,
  }
}

/** A trace that survives random ids and clocks: for comparing two runs of the same scenario. */
const normaliseCalls = calls => calls.map(c => ({
  method: c.method, status: c.status,
  url: c.url.replace(UUID_RE, id => id === UNKNOWN || id === KNOWN ? id : '<local>'),
  body: c.body && JSON.parse(JSON.stringify(c.body, (k, v) => (k === 'lastMessageAt' || k === 'timestamp' || k === 'id') && typeof v === 'string' ? '<x>' : v)
    .replace(UUID_RE, id => id === UNKNOWN || id === KNOWN ? id : '<local>')),
}))
const hashCalls = calls => createHash('sha256').update(JSON.stringify(normaliseCalls(calls))).digest('hex')

/**
 * One Builder page: it owns what page.tsx owns (url, currentSessionId, isUnsavedSession, the director's messages) and runs the
 * real hooks the way the page does. `steps(h)` plays the user and Director.
 */
async function runPersisted({ hygiene, persistSource, hookSource, overrides: extraOverrides = {}, api: sharedApi, failPosts = 0, url = '/builder', known = [], seed, storage = new MemStorage() }, steps) {
  const { log, warn, error } = console
  console.log = console.warn = console.error = () => {}
  try {
    const runtime = hookRuntime()
    const api = sharedApi ?? historyApi(known)
    api.faults.posts = failPosts
    const page = { url, currentSessionId: null, isUnsavedSession: false, dirty: false, messages: [] }
    const routeSession = () => new URLSearchParams(page.url.split('?')[1] ?? '').get('session_id')
    const initialRoute = routeSession()
    page.currentSessionId = initialRoute && initialRoute !== 'new' ? initialRoute : null
    page.isUnsavedSession = Boolean(initialRoute && initialRoute !== 'new' && storage.getItem(unsavedKey(initialRoute)) === 'true')
    seed?.(storage, page)
    page.isUnsavedSession = Boolean(page.currentSessionId && storage.getItem(unsavedKey(page.currentSessionId)) === 'true')

    const win = { location: { get search() { return '?' + (page.url.split('?')[1] ?? '') } }, sessionStorage: storage,
      addEventListener() {}, removeEventListener() {} }
    // timers: every delay (the 400 ms retry back-off, the 500 ms save debounce) becomes "next turn", so a long idle is cheap and ordered
    const world = createWorld({
      env: hygiene ? { [FLAG]: 'true' } : {},
      overrides: { ...extraOverrides, ...(hookSource ? { [FILES.hook]: hookSource } : {}), ...(persistSource ? { [FILES.persist]: persistSource } : {}) },
      globals: { window: win, sessionStorage: storage, fetch: api.fetch, navigator: { sendBeacon() { return true } },
        setTimeout: fn => setImmediate(fn), clearTimeout: handle => clearImmediate(handle) },
      stubs: {
        react: runtime.impl,
        'next/navigation': { useRouter: () => ({
          replace: next => { page.url = next; page.dirty = true },
          push: next => { page.url = next; page.dirty = true },
        }) },
        '@/lib/config': { features: { immediateConnection: true } },
        '@/lib/layout-service-client': { getLayoutServiceUrl: () => 'https://layout.invalid', LAYOUT_URL_CONFIG_ERROR: null,
          LAYOUT_VIEWER_URL_POLICY: { configuredOrigin: null, allowedOrigins: [] } },
      },
    })
    const hookModule = world.load(FILES.hook)
    const chatModule = world.load(FILES.chat)
    const persistModule = world.load(FILES.persist)
    const saveModule = world.load(FILES.saveOnAction)
    let latest = null
    let hookDirty = false
    const connects = { count: 0 }
    const pageCall = () => {
      const chat = chatModule.useChatSessions()
      const persistence = persistModule.useSessionPersistence({
        sessionId: page.currentSessionId || '', userId: OWNER,
        enabled: !!page.currentSessionId && !page.isUnsavedSession, // app/builder/page.tsx
        debounceMs: 500, onError() {},
      })
      // the page's refs, kept current by effects exactly as the page does
      const persistenceRef = runtime.impl.useRef(persistence)
      runtime.impl.useEffect(() => { persistenceRef.current = persistence }, [persistence])
      const currentSessionIdRef = runtime.impl.useRef(page.currentSessionId)
      runtime.impl.useEffect(() => { currentSessionIdRef.current = page.currentSessionId }, [page.currentSessionId])
      const session = hookModule.useBuilderSession({
        user: { id: OWNER, email: 'owner@example.invalid' }, isAuthLoading: false,
        searchParams: new URLSearchParams(page.url.split('?')[1] ?? ''),
        loadSession: chat.loadSession, loadSessionResult: chat.loadSessionResult, createSession: chat.createSession, persistence,
        connected: false, connecting: false, reconnectStatus: 'idle',
        ensureConnected: () => { connects.count++; return true }, disconnect() {}, clearMessages() { page.messages = [] },
        restoreMessages() {}, updateCacheUserMessages() {}, messages: page.messages, toast() {},
        isUnsavedSession: page.isUnsavedSession, setIsUnsavedSession: v => { if (v !== page.isUnsavedSession) { page.isUnsavedSession = v; page.dirty = true } },
        currentSessionId: page.currentSessionId, setCurrentSessionId: v => { if (v !== page.currentSessionId) { page.currentSessionId = v; page.dirty = true } },
        setSessionStoreName() {},
      })
      // app/builder/page.tsx: saveSessionOnFirstActionRef.current = useSaveSessionOnFirstAction({...}); the click handlers call the ref
      const saveSessionOnFirstActionRef = runtime.impl.useRef(null)
      saveSessionOnFirstActionRef.current = saveModule.useSaveSessionOnFirstAction({
        currentSessionId: page.currentSessionId, isUnsavedSession: page.isUnsavedSession,
        requestSession: session.handleRequestSession, sendDeferredMetadata: persistence.sendDeferredMetadata,
      })
      return { chat, persistence, persistenceRef, currentSessionIdRef, session, saveSessionOnFirstActionRef }
    }
    const instance = runtime.instance(pageCall, () => { hookDirty = true })
    const render = () => { page.dirty = false; hookDirty = false; latest = instance.render() }
    const settle = async (rounds = 400) => {
      let stable = 0, last = -1
      for (let i = 0; i < rounds; i++) {
        await tick(4)
        if (page.dirty || hookDirty) render()
        const now = api.calls.length
        if (now === last && !page.dirty && !hookDirty) { if (++stable >= 10) break } else stable = 0
        last = now
      }
    }
    const h = {
      api, page, storage, connects, get latest() { return latest }, settle,
      /** Director's blank-deck frame -> the page's onSessionStateChange (app/builder/page.tsx), mirrored: guarded by refs only. */
      blank(times = 2, which = 'blank-1') {
        for (let i = 0; i < times; i++) {
          const state = { presentationUrl: `https://layout.invalid/p/${which}`, presentationId: which, slideCount: 1, currentStage: 0 }
          if (latest.currentSessionIdRef.current && latest.persistenceRef.current) {
            latest.persistenceRef.current.updateMetadata({
              currentStage: state.currentStage, slideCount: state.slideCount, lastMessageAt: new Date(),
              stateCache: { activeVersion: state.activeVersion, slideStructure: state.slideStructure },
              blankPresentationUrl: state.presentationUrl, blankPresentationId: state.presentationId,
            })
          }
        }
        return settle()
      },
      /** Director's greeting, as the WebSocket hook hands it to the session hook. */
      greet() {
        page.messages = [{ type: 'chat_message', message_id: 'greeting-1', session_id: page.currentSessionId, timestamp: '2026-10-12T19:00:00.000Z', payload: { text: 'Hello!' } }]
        page.dirty = true
        return settle()
      },
      /** The page's handleSendMessage branch for an unsaved session (app/builder/page.tsx): create the row, mark saved, save the first message. */
      async firstMessage(text = 'A short pitch') {
        const id = page.currentSessionId
        const dbSession = await latest.chat.createSession(id)
        latest.session.justCreatedSessionRef.current = dbSession.id
        page.isUnsavedSession = false; page.dirty = true
        try { storage.removeItem(unsavedKey(dbSession.id)) } catch {}
        await api.fetch(`/api/sessions/${dbSession.id}/messages`, { method: 'POST', body: JSON.stringify({ messages: [{ id: 'first-1', messageType: 'chat_message', payload: { text }, userText: text }] }) })
        await api.fetch(`/api/sessions/${dbSession.id}`, { method: 'PATCH', body: JSON.stringify({ title: text }) })
        return settle()
      },
      async upload() { await latest.session.handleRequestSession(); return settle() },
      /** The page's handleSendMessage once more, faithfully: the row is created only `if (isUnsavedSession)` (the render's value). */
      async firstMessageLikePage(text = 'A short pitch') {
        const id = page.currentSessionId
        if (page.isUnsavedSession) {
          const dbSession = await latest.chat.createSession(id)
          latest.session.justCreatedSessionRef.current = dbSession.id
          page.isUnsavedSession = false; page.dirty = true
          try { storage.removeItem(unsavedKey(dbSession.id)) } catch {}
        }
        await api.fetch(`/api/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ messages: [{ id: 'first-1', messageType: 'chat_message', payload: { text }, userText: text }] }) })
        await api.fetch(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title: text }) })
        return settle()
      },
      /** A click on a trigger (theme / template / saved theme / Add Element / a manual slide edit): the page's handlers call the ref. Resolves when the save is done. */
      async userAction({ settleAfter = true } = {}) {
        const result = await latest.saveSessionOnFirstActionRef.current?.()
        if (settleAfter) await settle()
        return result
      },
      /** `n` clicks before any of them has finished (a double-click, a theme pick then a template pick). */
      async userActionsAtOnce(n = 3) {
        const results = await Promise.all(Array.from({ length: n }, () => latest.saveSessionOnFirstActionRef.current?.()))
        await settle()
        return results
      },
      newChat() { latest.session.handleNewChat(); return settle() },
      navigate(next) { page.url = next; page.dirty = true; return settle() },
    }
    render()
    await settle()
    await steps(h)
    instance.unmount()
    return h
  } finally { console.log = log; console.warn = warn; console.error = error }
}

const PERSIST_SCENARIOS = {
  // name: [options, steps]
  bareVisit: [{ url: '/builder' }, async h => { await h.greet(); await h.blank(2); await h.settle(); await h.settle() }],
  explicitNew: [{ url: '/builder?session_id=new' }, async h => { await h.blank(2) }],
  reloadUnsaved: [{ url: `/builder?session_id=${UNKNOWN}`, seed: s => s.setItem(unsavedKey(UNKNOWN), 'true') }, async h => { await h.blank(2) }],
  savedBlank: [{ url: `/builder?session_id=${KNOWN}`, known: [KNOWN] }, async h => { await h.blank(2) }],
  newChat: [{ url: `/builder?session_id=${KNOWN}`, known: [KNOWN] }, async h => { await h.blank(1); await h.newChat(); await h.blank(2) }],
  firstMessage: [{ url: '/builder' }, async h => { await h.blank(2); await h.firstMessage(); await h.blank(2) }],
  upload: [{ url: '/builder' }, async h => { await h.blank(2); await h.upload(); await h.blank(2) }],
  sidebarToSaved: [{ url: '/builder', known: [KNOWN] }, async h => { await h.blank(2); await h.navigate(`/builder?session_id=${KNOWN}`); await h.blank(2) }],
  staleMarker: [{ url: `/builder?session_id=${KNOWN}`, known: [KNOWN], seed: s => s.setItem(unsavedKey(KNOWN), 'true') }, async h => { await h.blank(2) }],
  staged: [{ url: `/builder?session_id=${UNKNOWN}`, seed: s => s.setItem(`deckster_composer_ready_${UNKNOWN}`, '{}') }, async h => { await h.blank(2) }],
}

const stripGate = source => {
  const anchor = 'if (STUDIO_SESSION_HYGIENE_ENABLED && !enabledRef.current) {'
  assert.ok(source.includes(anchor), 'the updateMetadata gate is present')
  return source.replace(anchor, 'if (false) {')
}

async function persistenceSuite(overrides = {}) {
  const hookSource = overrides[FILES.hook]
  const persistSource = overrides[FILES.persist]
  const run = (name, hygiene, extra = {}) => runPersisted({ hygiene, hookSource, persistSource, ...PERSIST_SCENARIOS[name][0], ...extra }, PERSIST_SCENARIOS[name][1])
  const patches404 = h => h.api.calls.filter(c => c.method === 'PATCH' && c.status === 404).length

  // ---- flag on: an unsaved session writes nothing, whatever Director sends
  for (const name of ['bareVisit', 'explicitNew', 'reloadUnsaved']) {
    const h = await run(name, true)
    check(assert.deepEqual, h.api.sessionWrites(), [], `flag on, ${name}: ZERO session writes (no PATCH, no POST) through Director's blank frames and idle`)
    check(assert.deepEqual, h.api.writes(), [], `flag on, ${name}: and no message writes either`)
    check(assert.equal, h.api.rows.size, 0, `flag on, ${name}: no history row exists`)
    check(assert.equal, h.page.isUnsavedSession, true, `flag on, ${name}: it stays an unsaved session`)
    check(assert.ok, h.connects.count >= 1, `flag on, ${name}: Director still connects`)
    check(assert.equal, h.api.calls.filter(c => c.method === 'GET').length, 1, `flag on, ${name}: the id is looked up exactly once`)
  }
  {
    const h = await run('newChat', true)
    const local = h.page.currentSessionId
    check(assert.notEqual, local, KNOWN, 'flag on, new chat from a saved session: a fresh local id')
    check(assert.deepEqual, h.api.calls.filter(c => c.url.includes(KNOWN) && c.method === 'PATCH').map(c => c.status), [200], 'flag on: the saved session before it still gets its metadata (PATCH 200 once)')
    check(assert.deepEqual, h.api.sessionWrites().filter(c => !c.url.includes(KNOWN)), [], 'flag on, new chat: nothing is written for the new local id')
    check(assert.equal, h.api.rows.size, 1, 'flag on, new chat: still just the one pre-existing row')
  }

  // ---- flag on: the first real action creates exactly one row, after which metadata flows again with no 404
  {
    const h = await run('firstMessage', true)
    const id = h.page.currentSessionId
    check(assert.equal, h.api.rowCreations().length, 1, 'flag on, first message: exactly one row is created')
    check(assert.deepEqual, h.api.calls.filter(c => c.method === 'POST' && c.url === '/api/sessions').map(c => c.body.sessionId), [id], 'flag on: for the local id')
    check(assert.equal, patches404(h), 0, 'flag on, first message: no PATCH ever 404s')
    const firstWrite = h.api.calls.findIndex(c => /^(POST|PATCH)$/.test(c.method) && c.url.startsWith('/api/sessions'))
    check(assert.deepEqual, [h.api.calls[firstWrite].method, h.api.calls[firstWrite].url], ['POST', '/api/sessions'], 'flag on: and the very first write is that row creation (the two blank frames before it wrote nothing)')
    check(assert.equal, h.api.count('PATCH', 200), 3, 'flag on: the title PATCH plus the two blank frames sent after the row exists all land')
    check(assert.equal, h.page.isUnsavedSession, false)
    check(assert.equal, h.api.rows.get(id).blankPresentationId, 'blank-1', 'flag on: metadata is saved once the session is saved')
  }
  {
    const h = await run('upload', true)
    check(assert.equal, h.api.rowCreations().length, 1, 'flag on, upload: exactly one row is created')
    check(assert.equal, patches404(h), 0, 'flag on, upload: no PATCH 404s')
    check(assert.equal, h.api.count('PATCH', 200), 2, 'flag on, upload: the two blank frames sent after the row exists land')
    const firstWrite = h.api.calls.find(c => /^(POST|PATCH)$/.test(c.method) && c.url.startsWith('/api/sessions'))
    check(assert.deepEqual, [firstWrite.method, firstWrite.url], ['POST', '/api/sessions'], 'flag on, upload: the first write is the row creation')
  }
  {
    const h = await run('staged', true)
    check(assert.equal, h.api.rowCreations().length, 1, 'flag on, staged hand-off: adopted as before, one row')
    check(assert.equal, patches404(h), 0, 'flag on, staged hand-off: no PATCH 404s')
    check(assert.equal, h.api.count('PATCH', 200), 2, 'flag on, staged hand-off: metadata lands once the row exists')
  }

  // ---- flag on: a saved session is never mistaken for an unsaved one
  {
    const h = await run('savedBlank', true)
    check(assert.deepEqual, h.api.calls.filter(c => c.method === 'PATCH').map(c => c.status), [200, 200], 'flag on, saved session: blank frames are written (PATCH 200 x2)')
    check(assert.equal, h.api.rowCreations().length, 0)
    const stale = await run('staleMarker', true)
    check(assert.equal, stale.page.isUnsavedSession, false, 'flag on: a stale unsaved marker does not make a row that exists unsaved')
    check(assert.equal, stale.storage.getItem(unsavedKey(KNOWN)), null, 'flag on: and the stale marker is removed')
    check(assert.deepEqual, stale.api.calls.filter(c => c.method === 'PATCH').map(c => c.status), [200, 200], 'flag on, stale marker: its metadata is still written')
    const side = await run('sidebarToSaved', true)
    check(assert.deepEqual, side.api.sessionWrites().filter(c => !c.url.includes(KNOWN)), [], 'flag on, bare visit then a saved session: the bare id wrote nothing')
    check(assert.equal, side.page.currentSessionId, KNOWN)
    check(assert.equal, side.page.isUnsavedSession, false, 'flag on: opening a saved session from the sidebar leaves the unsaved state behind')
    check(assert.deepEqual, side.api.calls.filter(c => c.method === 'PATCH').map(c => [c.url, c.status]), [[`/api/sessions/${KNOWN}`, 200], [`/api/sessions/${KNOWN}`, 200]], 'flag on: and the saved session gets its metadata')
    check(assert.equal, side.api.rowCreations().length, 0)
  }

  // ---- the bug itself, reproduced on the pre-fix persistence hook with the flag on (this is what #361's harness could not see)
  {
    const bug = await runPersisted({ hygiene: true, hookSource, persistSource: stripGate(persistSource ?? SRC.persist), ...PERSIST_SCENARIOS.bareVisit[0] }, PERSIST_SCENARIOS.bareVisit[1])
    check(assert.equal, bug.api.rowCreations().length, 1, 'pre-fix, flag on: a bare visit creates the empty row (the live "Untitled Session")')
    check(assert.equal, patches404(bug), 8, 'pre-fix, flag on: after eight PATCH 404s (two updates x four attempts), as in the live trace')
    check(assert.equal, bug.api.count('POST', 409), 1, 'pre-fix, flag on: with the second update\'s recovery POST answering 409')
    check(assert.equal, bug.api.count('PATCH', 200), 2, 'pre-fix, flag on: then both PATCHes land')
    check(assert.equal, bug.api.calls[0].method + ' ' + bug.api.calls[0].status, 'GET 404', 'pre-fix, flag on: after the one lookup that 404ed')
  }

  // ---- flag off: exactly uat (pinned here, and compared with the pre-fix hooks below)
  {
    const bare = await run('bareVisit', false)
    check(assert.equal, bare.api.rowCreations().length, 1, 'flag off, bare visit: the row is created at load (uat behaviour)')
    check(assert.equal, patches404(bare), 0)
    check(assert.equal, bare.api.count('PATCH', 200), 2, 'flag off, bare visit: and the two blank frames PATCH it')
    const stale = await run('staleMarker', false)
    check(assert.equal, stale.page.isUnsavedSession, true, 'flag off: a stale marker still leaves a saved session "unsaved" (uat behaviour, untouched)')
    check(assert.deepEqual, stale.api.calls.filter(c => c.method === 'PATCH').map(c => c.status), [200, 200], 'flag off: and its metadata is still written (uat ignores `enabled` there)')
    check(assert.equal, stale.storage.getItem(unsavedKey(KNOWN)), 'true', 'flag off: the marker is left alone')
    const side = await run('sidebarToSaved', false)
    check(assert.equal, side.page.isUnsavedSession, false, 'flag off: bare visit adopted a row, so it is saved by then')
  }
}
await persistenceSuite()

// flag off, the SAME scenarios on the pre-fix hooks (the base commit, when it is reachable in git): identical write traces, by hash
{
  var persistCompared = 0
  var persistHashes = null
  const gitShow = rel => { try { return execFileSync('git', ['show', `${PERSIST_BASE_REF}:${rel}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }
  const basePersist = gitShow(FILES.persist), baseHook = gitShow(FILES.hook)
  if (basePersist && baseHook) {
    check(assert.equal, basePersist.includes('STUDIO_SESSION_HYGIENE'), false, 'the base persistence hook is the pre-fix one')
    check(assert.equal, baseHook.includes('[SESSION-HYGIENE] Local unsaved session kept'), true, 'the base session hook is #361\'s')
    const base = {}, branch = {}
    for (const name of Object.keys(PERSIST_SCENARIOS)) {
      const [options, steps] = PERSIST_SCENARIOS[name]
      const before = await runPersisted({ hygiene: false, hookSource: baseHook, persistSource: basePersist, ...options }, steps)
      const after = await runPersisted({ hygiene: false, ...options }, steps)
      check(assert.deepEqual, normaliseCalls(after.api.calls), normaliseCalls(before.api.calls), `flag off: ${name} sends exactly the requests the pre-fix hooks send`)
      check(assert.equal, hashCalls(after.api.calls), hashCalls(before.api.calls), `flag off: ${name} request-log hash is identical`)
      check(assert.deepEqual, [after.page.isUnsavedSession, after.storage.getItem(unsavedKey(KNOWN)), after.storage.getItem(unsavedKey(UNKNOWN))],
        [before.page.isUnsavedSession, before.storage.getItem(unsavedKey(KNOWN)), before.storage.getItem(unsavedKey(UNKNOWN))], `flag off: ${name} leaves the same state`)
      base[name] = hashCalls(before.api.calls).slice(0, 12); branch[name] = hashCalls(after.api.calls).slice(0, 12)
      persistCompared++
    }
    persistHashes = { base, branch }
  }
}

// ---------------------------------------------------------------- 2c. the first state-changing click saves the row (fix-forward 2, FRONTEND-2 J4 S6)
// J4 S6: with the flag on, a blank-canvas session with a theme but no message had no row, so a second tab got "We couldn't find
// this session". The row is now saved by the user's first state-changing action (a theme / saved-theme / template pick, a manual
// Add Slide / Duplicate / Delete / Reorder, a manual Add Element), through the REAL hooks/use-save-session-on-first-action.ts
// wrapping the REAL handleRequestSession, then the blank-deck metadata Director sent before it is written once. Director's own
// presentation_init, a bare visit and idle still write nothing (#368 stays). Every click handler on the page calls the same
// callback, so these scenarios press it directly (`h.userAction()`); the page's four handlers are run for real further down.
const FIRST_ACTION_BASE_REF = '37d6fd7' // origin/studio-v4-dev-preparation-code when this change was made
const FIRST_ACTION_SCENARIOS = {
  // name: [options, steps]
  themePick: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction() }],
  themeThenTemplateThenSlide: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction(); await h.userAction(); await h.userAction() }],
  twiceBeforeRerender: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction({ settleAfter: false }); await h.userAction({ settleAfter: false }); await h.settle() }],
  atOnce: [{ url: '/builder' }, async h => { await h.blank(2); await h.userActionsAtOnce(3) }],
  noBlankFrameYet: [{ url: '/builder' }, async h => { await h.userAction() }],
  uploadAfterPick: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction(); await h.upload() }],
  messageAfterPick: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction(); await h.firstMessageLikePage() }],
  pickAfterMessage: [{ url: '/builder' }, async h => { await h.blank(2); await h.firstMessageLikePage(); await h.userAction() }],
  blankAfterPick: [{ url: '/builder' }, async h => { await h.blank(2); await h.userAction(); await h.blank(1, 'blank-2') }],
  savedSession: [{ url: `/builder?session_id=${KNOWN}`, known: [KNOWN] }, async h => { await h.blank(2); await h.userAction(); await h.userAction() }],
  staleMarker: [{ url: `/builder?session_id=${KNOWN}`, known: [KNOWN], seed: s => s.setItem(unsavedKey(KNOWN), 'true') }, async h => { await h.userAction() }],
  reloadUnsaved: [{ url: `/builder?session_id=${UNKNOWN}`, seed: s => s.setItem(unsavedKey(UNKNOWN), 'true') }, async h => { await h.blank(2); await h.userAction() }],
  newChatBetween: [{ url: '/builder' }, async h => { await h.blank(2, 'blank-old'); await h.newChat(); await h.blank(1, 'blank-new'); await h.userAction() }],
  newChatNoFrame: [{ url: '/builder' }, async h => { await h.blank(2, 'blank-old'); await h.newChat(); await h.userAction() }],
}

async function firstActionSuite(overrides = {}) {
  const run = (name, hygiene, extra = {}) => runPersisted({ hygiene, overrides, ...FIRST_ACTION_SCENARIOS[name][0], ...extra }, FIRST_ACTION_SCENARIOS[name][1])
  const posts = h => h.api.calls.filter(c => c.method === 'POST' && c.url === '/api/sessions')
  const patches = h => h.api.calls.filter(c => c.method === 'PATCH' && !c.url.endsWith('/messages'))
  const metadataPatches = h => patches(h).filter(c => c.body && 'blankPresentationId' in c.body)

  // ---- Director's blank-deck frame + a long idle writes NOTHING (the #368 guard stays)
  {
    const h = await runPersisted({ hygiene: true, overrides, url: '/builder' }, async h => {
      await h.greet(); await h.blank(2)
      for (let i = 0; i < 30; i++) await h.settle() // 30 rounds: every timer (the 400 ms retry, the 500 ms save debounce) fires each round
    })
    check(assert.deepEqual, h.api.writes(), [], 'flag on: presentation_init (two blank frames) + a long idle: ZERO writes of any kind')
    check(assert.equal, h.api.rows.size, 0, 'flag on: and no history row')
    check(assert.equal, h.page.isUnsavedSession, true, 'flag on: and the session stays unsaved')
    check(assert.equal, h.storage.getItem(unsavedKey(h.page.currentSessionId)), 'true', 'flag on: with its per-tab unsaved marker')
  }

  // ---- a theme (or template, or manual slide / element) click on a blank canvas: exactly one row, one POST, one metadata PATCH
  for (const name of ['themePick', 'themeThenTemplateThenSlide', 'twiceBeforeRerender', 'atOnce', 'reloadUnsaved']) {
    const h = await run(name, true)
    const id = h.page.currentSessionId
    check(assert.equal, posts(h).length, 1, `flag on, ${name}: exactly ONE POST /api/sessions (no second POST, so no 409 either)`)
    check(assert.equal, h.api.rowCreations().length, 1, `flag on, ${name}: and it is the 201 that creates the row`)
    check(assert.deepEqual, posts(h).map(c => c.body.sessionId), [id], `flag on, ${name}: for the session's own local id`)
    check(assert.equal, h.api.count('POST', 409), 0, `flag on, ${name}: never a 409`)
    check(assert.equal, h.api.rows.size, 1, `flag on, ${name}: one row`)
    check(assert.equal, patches(h).length, 1, `flag on, ${name}: exactly ONE metadata PATCH (the two blank frames Director sent are merged and written once)`)
    check(assert.deepEqual, [patches(h)[0].url, patches(h)[0].status], [`/api/sessions/${id}`, 200], `flag on, ${name}: it lands (200)`)
    check(assert.equal, patches(h)[0].body.blankPresentationUrl, 'https://layout.invalid/p/blank-1', `flag on, ${name}: carrying the blank deck's URL`)
    check(assert.equal, patches(h)[0].body.blankPresentationId, 'blank-1', `flag on, ${name}: and id`)
    check(assert.equal, h.api.rows.get(id).blankPresentationId, 'blank-1', `flag on, ${name}: so the row can open the deck`)
    check(assert.equal, h.api.calls.filter(c => c.status === 404 && c.method !== 'GET').length, 0, `flag on, ${name}: no write 404s (the one lookup of the not-yet-saved local id is the only 404)`)
    const firstWrite = h.api.calls.find(c => /^(POST|PATCH)$/.test(c.method))
    check(assert.deepEqual, [firstWrite.method, firstWrite.url], ['POST', '/api/sessions'], `flag on, ${name}: the very first write is the row creation`)
    check(assert.equal, h.page.isUnsavedSession, false, `flag on, ${name}: the session is saved`)
    check(assert.equal, h.storage.getItem(unsavedKey(id)), null, `flag on, ${name}: and this tab's unsaved marker is cleared`)
  }
  {
    const h = await run('noBlankFrameYet', true)
    check(assert.equal, posts(h).length, 1, 'flag on, a click before Director sent any blank frame: one POST')
    check(assert.deepEqual, patches(h), [], 'flag on: and no metadata PATCH, because none was held')
  }

  // ---- afterwards the session behaves like any saved one
  {
    const h = await run('blankAfterPick', true)
    check(assert.equal, posts(h).length, 1)
    check(assert.deepEqual, patches(h).map(c => [c.status, c.body.blankPresentationId]), [[200, 'blank-1'], [200, 'blank-2']], 'flag on: a blank frame after the row exists is written straight away')
  }
  {
    const h = await run('uploadAfterPick', true)
    check(assert.equal, posts(h).length, 1, 'flag on: an upload after the click makes no second row')
    check(assert.equal, h.api.count('POST', 409), 0)
  }
  {
    const h = await run('messageAfterPick', true)
    check(assert.equal, posts(h).length, 1, 'flag on: the first message after a theme pick makes no second POST')
    check(assert.equal, h.api.count('POST', 409), 0, 'flag on: and no 409')
    check(assert.equal, h.api.rows.size, 1)
    check(assert.equal, h.api.rows.get(h.page.currentSessionId).messages.length, 1, 'flag on: the message is saved to that row')
    check(assert.equal, h.api.calls.filter(c => c.status === 404 && c.method !== 'GET').length, 0)
    const m = await run('pickAfterMessage', true)
    check(assert.equal, posts(m).length, 1, 'flag on: a click after the first message is a no-op (the row exists)')
    check(assert.equal, m.api.count('POST', 409), 0)
  }
  {
    // a session that already has a row is never touched
    for (const name of ['savedSession', 'staleMarker']) {
      const h = await run(name, true)
      check(assert.deepEqual, posts(h), [], `flag on, ${name}: a saved session sends no POST`)
      check(assert.equal, h.api.rows.size, 1, `flag on, ${name}: and still one row`)
    }
    const h = await run('savedSession', true)
    check(assert.deepEqual, patches(h).map(c => c.status), [200, 200], 'flag on, saved session: only Director\'s own two blank frames PATCH, as before')
  }

  // ---- another chat: its own row, and nothing carried over from the one before
  {
    const h = await run('newChatBetween', true)
    const id = h.page.currentSessionId
    check(assert.equal, posts(h).length, 1, 'flag on, new chat then a click: one row, for the new local id')
    check(assert.deepEqual, posts(h).map(c => c.body.sessionId), [id])
    check(assert.deepEqual, patches(h).map(c => [c.url, c.body.blankPresentationId]), [[`/api/sessions/${id}`, 'blank-new']], 'flag on: its metadata is the new chat\'s own, none of the old chat\'s blank deck')
    const n = await run('newChatNoFrame', true)
    check(assert.equal, posts(n).length, 1)
    check(assert.deepEqual, patches(n), [], 'flag on: held metadata of the old chat is never written into the new chat\'s row')
  }

  // ---- a failed save: the click still works, the next click tries again, and nothing held is lost
  {
    const h = await runPersisted({ hygiene: true, overrides, failPosts: 1, url: '/builder' }, async h => {
      await h.blank(2)
      const first = await h.userAction()
      check(assert.equal, first, false, 'flag on, the POST fails (500): the callback reports it, never throws')
      check(assert.equal, h.page.isUnsavedSession, true, 'flag on: the session is still unsaved')
      check(assert.equal, metadataPatches(h).length, 0, 'flag on: and the held metadata was not written to a row that is not there')
      const second = await h.userAction()
      check(assert.equal, second, true, 'flag on: the next click saves it')
    })
    check(assert.deepEqual, posts(h).map(c => c.status), [500, 201], 'flag on: POST 500 then POST 201')
    check(assert.equal, metadataPatches(h).length, 1, 'flag on: the held blank-deck metadata is written once, after the retry')
    check(assert.equal, h.api.rows.size, 1)
  }

  // ---- the held metadata goes out once
  {
    const h = await runPersisted({ hygiene: true, overrides, url: '/builder' }, async h => {
      await h.blank(2); await h.userAction()
      await h.latest.persistence.sendDeferredMetadata(h.page.currentSessionId)
      await h.settle()
    })
    check(assert.equal, metadataPatches(h).length, 1, 'flag on: sendDeferredMetadata twice still writes once')
    const other = await runPersisted({ hygiene: true, overrides, url: '/builder' }, async h => {
      await h.blank(2); await h.latest.persistence.sendDeferredMetadata(UNKNOWN); await h.settle()
    })
    check(assert.deepEqual, other.api.writes(), [], 'flag on: metadata held for one session is not written for another')
  }

  // ---- the second tab: the row the click saved opens; without the click it still reads "not found" (the #361/#368 design)
  {
    const tab1 = await run('themePick', true)
    const id = tab1.page.currentSessionId
    const tab2 = await runPersisted({ hygiene: true, overrides, api: tab1.api, url: `/builder?session_id=${id}`, storage: new MemStorage() }, async h => {
      await h.blank(1)
    })
    check(assert.equal, tab2.latest.session.sessionProblem ?? null, null, 'flag on, second tab (fresh sessionStorage) after a theme pick: NO "session not found"')
    check(assert.equal, tab2.page.currentSessionId, id, 'flag on: it opens the same session')
    check(assert.equal, tab2.page.isUnsavedSession, false, 'flag on: as a saved one')
    check(assert.ok, tab2.connects.count >= 1, 'flag on: and connects to Director')
    check(assert.deepEqual, tab2.api.calls.filter(c => c.method === 'GET').map(c => c.status).slice(-1), [200], 'flag on: its lookup is a 200')
    check(assert.equal, posts(tab2).length, 1, 'flag on: the second tab creates nothing')
    const bare = await runPersisted({ hygiene: true, overrides, url: '/builder' }, async h => { await h.blank(2) })
    const lonely = await runPersisted({ hygiene: true, overrides, api: bare.api, url: `/builder?session_id=${bare.page.currentSessionId}`, storage: new MemStorage() }, async () => {})
    check(assert.equal, lonely.latest.session.sessionProblem?.kind, 'not_found', 'flag on, control: a bare visit that never clicked still has no row, so a second tab says not found')
    check(assert.deepEqual, lonely.api.writes(), [], 'flag on, control: and that read wrote nothing')
  }

  // ---- flag off: the callback does nothing at all
  for (const name of Object.keys(FIRST_ACTION_SCENARIOS)) {
    const a = await run(name, false)
    const b = await runPersisted({ hygiene: false, overrides, ...FIRST_ACTION_SCENARIOS[name][0] }, async h => {
      // the same scenario with every click removed: the callback must change nothing, request for request
      const noClicks = { ...h, userAction: async () => h.settle(), userActionsAtOnce: async () => h.settle() }
      await FIRST_ACTION_SCENARIOS[name][1](noClicks)
    })
    check(assert.equal, hashCalls(a.api.calls), hashCalls(b.api.calls), `flag off, ${name}: clicking changes no request (hash-identical to never clicking)`)
  }
}
await firstActionSuite()

// flag off (and the old flag-on flows), the SAME scenarios on the base commit's hooks: identical request logs, by hash
{
  var firstActionCompared = 0
  var firstActionHashes = null
  const gitShow = rel => { try { return execFileSync('git', ['show', `${FIRST_ACTION_BASE_REF}:${rel}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }
  const basePersist = gitShow(FILES.persist), baseHook = gitShow(FILES.hook)
  if (basePersist && baseHook) {
    check(assert.equal, basePersist.includes('sendDeferredMetadata'), false, 'the base persistence hook is the one before this change')
    check(assert.equal, basePersist.includes('[SESSION-HYGIENE] updateMetadata skipped'), true, 'and it has #368\'s guard')
    const base = {}, branch = {}
    const all = { ...PERSIST_SCENARIOS, ...FIRST_ACTION_SCENARIOS }
    for (const name of Object.keys(all)) {
      const [options, steps] = all[name]
      for (const hygiene of [false, true]) {
        // flag on, only the flows that make no click may be compared: a click is the one thing this change adds
        if (hygiene && Object.prototype.hasOwnProperty.call(FIRST_ACTION_SCENARIOS, name) && !PERSIST_SCENARIOS[name]) continue
        const noClicks = async h => steps({ ...h, userAction: async () => h.settle(), userActionsAtOnce: async () => h.settle() })
        const before = await runPersisted({ hygiene, hookSource: baseHook, persistSource: basePersist, ...options }, noClicks)
        const after = await runPersisted({ hygiene, ...options }, noClicks)
        check(assert.deepEqual, normaliseCalls(after.api.calls), normaliseCalls(before.api.calls), `${hygiene ? 'flag on' : 'flag off'}: ${name} sends exactly the requests the base hooks send`)
        check(assert.equal, hashCalls(after.api.calls), hashCalls(before.api.calls), `${hygiene ? 'flag on' : 'flag off'}: ${name} request-log hash is identical to the base`)
        check(assert.deepEqual, [after.page.isUnsavedSession, after.storage.getItem(unsavedKey(KNOWN)), after.storage.getItem(unsavedKey(UNKNOWN))],
          [before.page.isUnsavedSession, before.storage.getItem(unsavedKey(KNOWN)), before.storage.getItem(unsavedKey(UNKNOWN))], `${hygiene ? 'flag on' : 'flag off'}: ${name} leaves the same state`)
        ;(hygiene ? base : branch)[name + (hygiene ? ':on' : ':off')] = hashCalls(before.api.calls).slice(0, 12)
        firstActionCompared++
      }
    }
    // flag off with real clicks, against the base hooks (which have no such callback): the clicks are no-ops
    for (const name of Object.keys(FIRST_ACTION_SCENARIOS)) {
      const [options, steps] = FIRST_ACTION_SCENARIOS[name]
      const noClicks = async h => steps({ ...h, userAction: async () => h.settle(), userActionsAtOnce: async () => h.settle() })
      const before = await runPersisted({ hygiene: false, hookSource: baseHook, persistSource: basePersist, ...options }, noClicks)
      const after = await runPersisted({ hygiene: false, ...options }, steps)
      check(assert.equal, hashCalls(after.api.calls), hashCalls(before.api.calls), `flag off: ${name} WITH its clicks is hash-identical to the base hooks with none`)
      firstActionCompared++
    }
    firstActionHashes = { base, branch }
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
  // the persistence wiring the fix-forward rests on (section 2b mirrors the page here, so the page may not drift from it unnoticed)
  check(assert.match, sources.page, /const persistence = useSessionPersistence\(\{\s*sessionId: currentSessionId \|\| '',\s*userId: authScopeUserId,\s*enabled: !!currentSessionId && !isUnsavedSession,/, 'persistence is enabled only for a saved session')
  check(assert.match, sources.page, /onSessionStateChange: \(state\) => \{[\s\S]{0,400}?if \(currentSessionIdRef\.current && persistenceRef\.current\) \{[\s\S]*?persistenceRef\.current\.updateMetadata\(updates\)/, 'Director state changes reach persistence.updateMetadata guarded by refs only: the gate lives in the persistence hook')
  check(assert.match, sources.persist, /import \{ STUDIO_SESSION_HYGIENE_ENABLED, deferMetadata, takeDeferredMetadata, type DeferredMetadata \} from '@\/lib\/studio-session-hygiene'/)
  check(assert.equal, (sources.persist.match(/STUDIO_SESSION_HYGIENE_ENABLED && !enabledRef\.current/g) || []).length, 1, 'updateMetadata has the one gate, on the ref (current at call time)')
  {
    const update = sources.persist.slice(sources.persist.indexOf('const updateMetadata'), sources.persist.indexOf('const generateTitle'))
    const gateAt = update.indexOf('STUDIO_SESSION_HYGIENE_ENABLED && !enabledRef.current')
    check(assert.ok, gateAt > 0 && gateAt < update.indexOf('await updateSession('), 'the gate comes before the write')
    check(assert.match, update.slice(gateAt, update.indexOf('await updateSession(')), /\n\s*return;\n\s*\}/, 'and it returns before it')
  }
  check(assert.match, sources.hook, /setSessionStoreName\(session\.geminiStoreName \|\| null\)\s*\n\s*if \(STUDIO_SESSION_HYGIENE_ENABLED\) \{[\s\S]{0,600}?setIsUnsavedSession\(false\)[\s\S]{0,200}?sessionStorage\.removeItem\(unsavedBuilderSessionKey\(builderCacheOwner, session\.id\)\)/, 'a row the history returns is a saved session')
  // fix-forward 2: the first state-changing click saves the row
  check(assert.match, sources.page, /import \{ useSaveSessionOnFirstAction \} from '@\/hooks\/use-save-session-on-first-action'/)
  check(assert.match, sources.page, /saveSessionOnFirstActionRef\.current = useSaveSessionOnFirstAction\(\{\s*currentSessionId,\s*isUnsavedSession,\s*requestSession: session\.handleRequestSession,\s*sendDeferredMetadata: persistence\.sendDeferredMetadata,\s*\}\)/, 'the page wraps the session hook\'s own draft-session creator and the persistence hook\'s held metadata')
  check(assert.match, sources.page, /const saveSessionOnFirstAction = useCallback\(\(\) => \{ void saveSessionOnFirstActionRef\.current\?\.\(\) \}, \[\]\)/, 'one stable trigger for every handler')
  {
    const stateChange = sources.page.slice(sources.page.indexOf('onSessionStateChange: (state) => {'), sources.page.indexOf('onMessage: (message) => {'))
    check(assert.ok, stateChange.length > 300 && /persistenceRef\.current\.updateMetadata\(updates(?:, \{ passive: true \})?\)/.test(stateChange), 'found Director\'s state-change callback') // PASS2D R6 marks this call { passive: true } (flag NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY)
    check(assert.doesNotMatch, stateChange, /saveSessionOnFirstAction/, 'Director\'s automatic frames (presentation_init) never save the row')
  }
  check(assert.match, sources.page, /onUserDeckEdit=\{STUDIO_SESSION_HYGIENE_ENABLED \? saveSessionOnFirstAction : undefined\}/, 'manual slide edits reach the trigger, only with the flag on')
  check(assert.match, sources.area, /onUserDeckEdit\?: \(\) => void[\s\S]*?onUserDeckEdit,\s*\n[\s\S]*?onUserDeckEdit=\{onUserDeckEdit\}/, 'the presentation area forwards it to the viewer unchanged')
  check(assert.match, sources.viewer, /onUserDeckEdit\?: \(\) => void/, 'the viewer takes an optional callback')
  check(assert.match, sources.viewer, /const onUserDeckEditRef = useRef\(onUserDeckEdit\)\s*\n\s*useEffect\(\(\) => \{ onUserDeckEditRef\.current = onUserDeckEdit \}, \[onUserDeckEdit\]\)\s*\n\s*useEffect\(\(\) => \{ if \(slidesModifiedByCrud\) onUserDeckEditRef\.current\?\.\(\) \}, \[slidesModifiedByCrud\]\)/, 'and calls it on the edge of the slides-modified flag')
  check(assert.equal, (sources.viewer.match(/commit<boolean>\(setSlidesModifiedByCrud, true\)/g) || []).length, 4, 'Add, Duplicate, Delete and Reorder each raise that flag')
  check(assert.match, sources.persist, /deferredMetadataRef\.current = deferMetadata\(deferredMetadataRef\.current, currentSessionId, updates\);\s*\n\s*return;\s*\n\s*\}/, 'the persistence hook holds what the guard skips')
  check(assert.match, sources.persist, /if \(!STUDIO_SESSION_HYGIENE_ENABLED\) return;\s*\n\s*const held = takeDeferredMetadata\(deferredMetadataRef\.current, forSessionId\);/, 'and sends it only with the flag on, only for its own session')
  check(assert.match, sources.saveOnAction, /if \(!STUDIO_SESSION_HYGIENE_ENABLED\) return Promise\.resolve\(false\)/, 'the hook is inert with the flag off')
  check(assert.doesNotMatch, sources.saveOnAction.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /\b(updateMetadata|queueMessage|createSession|fetch)\b/, 'the hook writes only through the session hook\'s creator (comments aside)')
  check(assert.match, envex, /first state-changing click on the blank canvas/, '.env.example documents the new trigger')
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

// ---------------------------------------------------------------- 4b. the page's trigger handlers, extracted from the page source and run
// (a regex cannot tell "after the lock check" from "before it", or "for a saved theme" from "for clearing one"; running the code can)
function pageHandler(pageSource, name, scope) {
  const head = `const ${name} = useCallback(`
  const start = pageSource.indexOf(head)
  assert.ok(start >= 0, `${name} is in the page`)
  const end = pageSource.indexOf('\n  }, [', start)
  assert.ok(end > start, `${name} ends in a dependency list`)
  const fnSource = pageSource.slice(start + head.length, end + '\n  }'.length)
  const js = ts.transpileModule(`const f = ${fnSource}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const setters = [...new Set(fnSource.match(/\bset[A-Z]\w*/g) ?? [])].filter(n => !(n in scope))
  const full = { ...Object.fromEntries(setters.map(n => [n, () => {}])), ...scope }
  const names = Object.keys(full)
  return new Function(...names, `${js}\nreturn f`)(...names.map(n => full[n]))
}

async function handlerSuite(sources = SRC) {
  const page = sources.page
  const make = (locked) => {
    const log = []
    return { log, locked: { current: locked }, saves: () => log.filter(e => e === 'save').length,
      common: { toast: () => log.push('toast'), saveSessionOnFirstAction: () => log.push('save'), templateSelectionLockedRef: { current: locked } } }
  }
  // a theme pick (canvas panel, composer, workflow panel all call handleBuildThemeChange)
  for (const locked of [false, true]) {
    const t = make(locked)
    const fn = pageHandler(page, 'handleBuildThemeChange', { ...t.common, buildThemeProfileMatchesSelection: () => true,
      themeSelectionChangedLocallyRef: { current: false }, setBuildThemeSelection: () => t.log.push('apply'),
      carryPaletteMode: next => next, buildThemeSelectionRef: { current: { mode: 'auto' } } }) // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST: flag off, the pick as it is
    fn({ mode: 'preset', preset_id: 'gilded_noir' })
    check(assert.deepEqual, t.log, locked ? ['toast'] : ['save', 'apply'], locked ? 'a locked selection: only the notice, no row saved' : 'a theme pick saves the row, then applies the theme')
  }
  // a saved theme (the composer sends the profile, then the selection)
  for (const [locked, profile, expected] of [[false, { id: 't1' }, ['save', 'profile']], [false, null, ['profile']], [true, { id: 't1' }, ['toast']]]) {
    const t = make(locked)
    const fn = pageHandler(page, 'handleActiveBuildThemeProfileChange', { ...t.common, setActiveBuildThemeProfile: () => t.log.push('profile') })
    fn(profile)
    check(assert.deepEqual, t.log, expected, `saved theme ${profile ? 'chosen' : 'cleared'}${locked ? ' while locked' : ''}: ${expected.join(' -> ')} (clearing, which the brand-colour field also sends per keystroke, never saves)`)
  }
  // a template pick
  for (const locked of [false, true]) {
    const t = make(locked)
    const fn = pageHandler(page, 'handleSelectTemplate', { ...t.common, retireStudioVoiceOwner: () => t.log.push('retire'), currentSlideIndex: 0,
      isTemplateGenerationReady: () => true, templateGenerationUnavailableReason: () => '', setActiveTemplate: () => t.log.push('apply') })
    fn({ id: 'tpl-1' })
    check(assert.deepEqual, t.log, locked ? ['toast'] : ['save', 'retire', 'apply'], locked ? 'a locked template pick: only the notice' : 'a template pick saves the row, then applies it')
  }
  // a manual Add Element (the generation panel's Generate)
  for (const viewer of [true, false]) {
    const t = make(false)
    const fn = pageHandler(page, 'handleApprovedTextLabsGenerate', { ...t.common, layoutServiceApis: viewer ? { sendElementCommand() {} } : null,
      generationPanel: { setError: () => t.log.push('error') }, effectivePresentationId: 'p1', studioShell: false, studioPartialLocalWorkRef: { current: new Set() },
      studioPartialMountedRef: { current: false }, handleTextLabsGenerate: async () => { t.log.push('generate'); return { status: 'ok' } } })
    await fn({ slideIndex: 0 }, {})
    check(assert.deepEqual, t.log, viewer ? ['save', 'generate'] : ['error', 'toast'], viewer ? 'Add Element saves the row, then generates' : 'no viewer: the error, no row saved')
  }
}
await handlerSuite()

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

  // fix-forward: the persistence gate and the "a returned row is saved" reset
  const P = FILES.persist
  const GATE = 'if (STUDIO_SESSION_HYGIENE_ENABLED && !enabledRef.current) {'
  mutate('updateMetadata gate removed', P, GATE, 'if (false) {', ['persist', 'wiring'])
  mutate('updateMetadata gate inverted', P, GATE, 'if (STUDIO_SESSION_HYGIENE_ENABLED && enabledRef.current) {', ['persist', 'wiring'])
  mutate('updateMetadata gate ignores the flag', P, GATE, 'if (!enabledRef.current) {', ['persist', 'wiring'])
  mutate('updateMetadata gate blocks saved sessions too', P, GATE, 'if (STUDIO_SESSION_HYGIENE_ENABLED) {', ['persist', 'wiring'])
  mutate('updateMetadata gate does not return', P, "updates);\n      return;\n    }", "updates);\n    }", ['persist', 'wiring'])
  mutate('a returned row is not marked saved', H, "if (STUDIO_SESSION_HYGIENE_ENABLED) {\n              // The history has a row for this id, so it is saved", "if (false) {\n              // The history has a row for this id, so it is saved", ['persist', 'wiring'])
  mutate('a returned row is marked saved with the flag off too', H, "if (STUDIO_SESSION_HYGIENE_ENABLED) {\n              // The history has a row for this id, so it is saved", "if (true) {\n              // The history has a row for this id, so it is saved", ['persist'])
  mutate('a stale marker is left in storage', H, "                if (builderCacheOwner) sessionStorage.removeItem(unsavedBuilderSessionKey(builderCacheOwner, session.id))\n              } catch {}\n            }\n            debugLog('✅ Session loaded successfully')", "              } catch {}\n            }\n            debugLog('✅ Session loaded successfully')", ['persist', 'wiring'])
  mutate('a returned row stays unsaved', H, "              setIsUnsavedSession(false)\n              try {\n                if (builderCacheOwner) sessionStorage.removeItem(unsavedBuilderSessionKey(builderCacheOwner, session.id))", "              try {\n                if (builderCacheOwner) sessionStorage.removeItem(unsavedBuilderSessionKey(builderCacheOwner, session.id))", ['persist', 'wiring'])

  // fix-forward 2: the first state-changing click saves the row
  const S = FILES.saveOnAction, PG = FILES.page, V = FILES.viewer
  mutate('the click never saves', S, 'await requestSession()', 'await Promise.resolve()', ['first'])
  mutate('the click saves with the flag off', S, 'if (!STUDIO_SESSION_HYGIENE_ENABLED) return Promise.resolve(false)', '', ['first', 'wiring'])
  mutate('the click ignores the policy', S, 'if (!shouldSaveSessionOnFirstAction(STUDIO_SESSION_HYGIENE_ENABLED, {', 'if (false && !shouldSaveSessionOnFirstAction(STUDIO_SESSION_HYGIENE_ENABLED, {', ['first'])
  mutate('clicks at once each save', S, 'if (inFlight && inFlight.sessionId === currentSessionId) return inFlight.promise', '', ['first'])
  mutate('the saved id is not remembered', S, 'savedHereRef.current = currentSessionId', '', ['first'])
  mutate('the held metadata is never sent', S, 'await sendDeferredMetadata?.(currentSessionId)', '', ['first'])
  mutate('a failure is rethrown', S, "return false\n      }\n    })().finally", "throw error\n      }\n    })().finally", ['first'])
  mutate('a failed save is remembered as saved', S, 'await requestSession()\n        savedHereRef.current = currentSessionId', 'savedHereRef.current = currentSessionId\n        await requestSession()', ['first'])
  mutate('the policy saves a saved session', L, 'if (!state.isUnsavedSession) return false', '', ['policy', 'first'])
  mutate('the policy saves twice', L, 'return state.savedHereId !== state.sessionId', 'return true', ['policy', 'first'])
  mutate('the policy saves with the flag off', L, 'if (!hygiene) return false\n  if (!state.sessionId', 'if (!state.sessionId', ['policy', 'first'])
  mutate('the policy saves the "new" placeholder', L, "state.sessionId === 'new'", 'false', ['policy'])
  mutate('held metadata leaks across sessions', L, 'held && held.sessionId === sessionId ? { ...held.updates, ...updates } : { ...updates }', '{ ...(held?.updates ?? {}), ...updates }', ['policy', 'first'])
  mutate('taken metadata ignores the session', L, 'return held && held.sessionId === sessionId ? held.updates : null', 'return held ? held.updates : null', ['policy', 'first'])
  mutate('older metadata wins', L, '{ ...held.updates, ...updates }', '{ ...updates, ...held.updates }', ['policy', 'first'])
  mutate('metadata is not held while unsaved', P, "deferredMetadataRef.current = deferMetadata(deferredMetadataRef.current, currentSessionId, updates);\n      return;", "return;", ['first', 'wiring'])
  mutate('held metadata is sent again', P, "    deferredMetadataRef.current = null;\n    try {", "    try {", ['first'])
  mutate('held metadata is sent with the flag off', P, 'if (!STUDIO_SESSION_HYGIENE_ENABLED) return;\n    const held', 'const held', ['wiring'])
  mutate('director\'s frame saves the row', PG, "persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame\n      } else {\n        console.error('PERSISTENCE BLOCKED:'", "persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame\n        saveSessionOnFirstAction()\n      } else {\n        console.error('PERSISTENCE BLOCKED:'", ['wiring']) // PASS2D R6: the anchor carries the passive mark
  mutate('theme pick does not save', PG, "    saveSessionOnFirstAction()\n    // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST:", "    // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST:", ['handlers', 'wiring'])
  mutate('locked theme pick saves', PG, "const handleBuildThemeChange = useCallback((next: BuildThemeSelection) => {\n    if (templateSelectionLockedRef.current) {", "const handleBuildThemeChange = useCallback((next: BuildThemeSelection) => {\n    saveSessionOnFirstAction()\n    if (templateSelectionLockedRef.current) {", ['handlers'])
  mutate('locked template pick saves', PG, "const handleSelectTemplate = useCallback((template: BuilderTemplateSelection) => {\n    if (templateSelectionLockedRef.current) {", "const handleSelectTemplate = useCallback((template: BuilderTemplateSelection) => {\n    saveSessionOnFirstAction()\n    if (templateSelectionLockedRef.current) {", ['handlers'])
  mutate('saved theme does not save', PG, 'if (profile) saveSessionOnFirstAction()', '', ['handlers'])
  mutate('clearing a saved theme saves', PG, 'if (profile) saveSessionOnFirstAction()', 'saveSessionOnFirstAction()', ['handlers'])
  mutate('template pick does not save', PG, "    saveSessionOnFirstAction()\n    retireStudioVoiceOwner()\n    setActiveTemplate(template)", "    retireStudioVoiceOwner()\n    setActiveTemplate(template)", ['handlers'])
  mutate('Add Element does not save', PG, "    saveSessionOnFirstAction()\n    const partialWork = {}", "    const partialWork = {}", ['handlers'])
  mutate('a manual slide edit does not save', PG, 'onUserDeckEdit={STUDIO_SESSION_HYGIENE_ENABLED ? saveSessionOnFirstAction : undefined}', '', ['wiring'])
  mutate('manual slide edits save with the flag off', PG, 'onUserDeckEdit={STUDIO_SESSION_HYGIENE_ENABLED ? saveSessionOnFirstAction : undefined}', 'onUserDeckEdit={saveSessionOnFirstAction}', ['wiring'])
  mutate('the presentation area drops it', FILES.area, 'onUserDeckEdit={onUserDeckEdit}\n', '', ['wiring'])
  mutate('the viewer never calls it', V, 'useEffect(() => { if (slidesModifiedByCrud) onUserDeckEditRef.current?.() }, [slidesModifiedByCrud])', '', ['wiring'])
  mutate('the viewer calls it on mount', V, 'useEffect(() => { if (slidesModifiedByCrud) onUserDeckEditRef.current?.() }, [slidesModifiedByCrud])', 'useEffect(() => { onUserDeckEditRef.current?.() }, [slidesModifiedByCrud])', ['wiring'])

  let caught = 0
  for (const mutant of mutants) {
    const overrides = { [mutant.rel]: mutant.source }
    let failed = false
    for (const suite of mutant.suites) {
      try {
        if (suite === 'policy') policySuite(overrides)
        else if (suite === 'scenario') await scenarioSuite(overrides)
        else if (suite === 'persist') await persistenceSuite(overrides)
        else if (suite === 'first') await firstActionSuite(overrides)
        else if (suite === 'handlers') await handlerSuite({ ...SRC, [Object.keys(FILES).find(k => FILES[k] === mutant.rel)]: mutant.source })
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
console.log(`studio session hygiene: ${checks} checks passed; ${caught}/${mutants} mutants caught; flag-off traces compared with the pre-change hook (${BASE_REF}): ${baseCompared === 0 ? 'base not reachable in git, skipped' : `${baseCompared} scenarios identical`}; flag-off request logs compared with the pre-fix hooks (${PERSIST_BASE_REF}): ${persistCompared === 0 ? 'base not reachable in git, skipped' : `${persistCompared} scenarios hash-identical`}; first-action flows compared with the base hooks (${FIRST_ACTION_BASE_REF}): ${firstActionCompared === 0 ? 'base not reachable in git, skipped' : `${firstActionCompared} runs hash-identical`}`)
if (persistHashes && process.env.HYGIENE_PRINT_HASHES) console.log(JSON.stringify({ persistHashes, firstActionHashes }, null, 2))
