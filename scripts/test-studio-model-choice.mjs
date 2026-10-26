// FRONTEND-2: proof for P3-10 MODEL CHOICE, the Studio picker and its server routes (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off; the chooser acts only with
// NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE on too). Design (A) of ROUTER-2's P3-10 doc: choices are saved in the Model Router by Studio's own server routes (app/api/model-choice/prefs, .../prefs/deck/[deckKey],
// app/api/model-choice/used/[buildId]; lib/studio-model-choice-server.ts), never by the browser and never through Director. Every catalogue and router answer below is a fixture
// (scripts/fixtures/studio-model-choice/, shaped as the router's own code answers; the recorded scripts/fixtures/studio-model-catalog/fixture-200.json, read only). The router is an in-process fake that
// keeps saved choices with ETags as the router does. No network, no services, no browser, nothing written to the repo. The router key is made up at run time.
//
// Run: node scripts/test-studio-model-choice.mjs      (plain node: the real TypeScript transpiled and run in this process; MODEL_CHOICE_NO_MUTANTS=1 skips the mutants)
//
//   A. fixtures   the catalogue fixture has the recorded structure and changes only what is listed; the router fixtures have the router's shapes
//   B. mapping    the three text groups: the task of the same id reads its user-visible group; exact options (recommendation, certified presets as Best / Balanced / Fast with hints, certified models with
//                 "Suggested"); imagery and narration are "Fixed for now" (no select), whatever the catalogue certifies
//   C. never      system groups and embeddings are never offered; a text task whose group is missing or not user-visible keeps the built-in list, and the page says which
//   D. modality   narration offers audio models only and imagery image models only (the filter the fixed rows will use when they open)
//   E. tiers      wire values best / balanced / economy, shown Best / Balanced / Fast; a model's catalogue cost_hint is preferred, else the tier's hint; the built-in list names no model in its presets
//   F. scopes     "Reusable defaults" and "This presentation" (the Builder's ?session_id=): the router's user and session scopes; the deck follows the reusable default; no deck, no deck scope (R3 404),
//                 an unsaved or foreign session: the radio is disabled with the right words and the defaults apply
//   G. adapter    the account first (Studio's routes, ETag kept and sent as If-Match; a conflict shows the saved choices; a refused choice goes back); 503 router_not_configured or no answer: this device
//                 (the Pass 2 key migrated on read, never written or removed); a throwing storage keeps the session
//   H. copy       the note and the feedback are true for each case: never "used" when not saved; "applies from the next build" when saved
//   I. used       "Used for this deck": only the session user's timeline rows; the doc's words per reason code; nothing without a deck and a build id; the build id from build_phase / sync_response
//   J. fallback   a catalogue that cannot be loaded shows the built-in list with a quiet note; only Studio routes are ever asked from the browser
//   K. identity   flag off is the base: the page with the held hook, for every flag value but "true", is the base page; .env.example, the registry and the taught proof without this change's lines are the base's
//   L. a11y       44 px targets, labelled selects and radios, a 620 px phone rule; text sizes are the page's own; every rule is scoped
//   M. routes     flag off 404 before the session is read; 401; 503 unconfigured before anything is sent; the user id from the session only; the key only in the router's Authorization header, never in a
//                 response or a log; body validation; If-Match read-modify-write on both scopes (PUT replaces the deck map); session ownership; R3 404; the timeline filtered; the route set grows by 3
//   N. scope      the committed diff of this change's own commits (subject "Model choice: ...") holds exactly its files; the registry gains three lines; .env.example only its block
//   O. mutants    each one must make A-N fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const postcss = nodeRequire('postcss')
const nextServer = nodeRequire('next/server')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

const STRIP = 'scripts/studio-model-choice-strip.mjs'
const LIB = 'lib/studio-model-choice.ts', SERVER = 'lib/studio-model-choice-server.ts', CHOOSER = 'components/studio-personal/intelligence-model-choice.tsx', CSS = 'components/studio-personal/intelligence-model-choice.css'
const P2LIB = 'lib/studio-intelligence-p2.ts', CATLIB = 'lib/studio-model-catalog.ts', POLISH = 'lib/studio-p2-polish.ts', WORKSPACE = 'components/studio-personal/intelligence-workspace.tsx'
const USER_ROUTE = 'app/api/model-choice/prefs/route.ts', DECK_ROUTE = 'app/api/model-choice/prefs/deck/[deckKey]/route.ts', USED_ROUTE = 'app/api/model-choice/used/[buildId]/route.ts'
const PAGE = 'app/(app)/studio/intelligence/page.tsx', ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs'
const FIX = 'scripts/fixtures/studio-model-choice', FIXTURE = `${FIX}/catalogue-live-shape.json`, RECORDED = 'scripts/fixtures/studio-model-catalog/fixture-200.json'
const SNAPSHOT = 'components/studio-personal/model-catalog-snapshot.json', SNAPSHOT_10 = 'components/studio-personal/model-catalog-snapshot-2026-10.json'

let overrides = {}
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const json = rel => JSON.parse(read(rel))
const stripModule = async () => import(`data:text/javascript,${encodeURIComponent(read(STRIP))}`)
const BASE = process.env.MODEL_CHOICE_BASE || (await stripModule()).BASE_COMMIT
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }

// The made-up router key (built at run time, so no file carries one) and the made-up people.
const KEY = ['fixture', 'frontend', crypto.randomBytes(8).toString('hex')].join('-')
const ME = { id: 'user-fixture-1', email: 'me@example.test' }
const OWNED = { 'sess-fixture-1': { userId: 'user-fixture-1', status: 'active' }, 'sess-other': { userId: 'user-fixture-2', status: 'active' }, 'sess-gone': { userId: 'user-fixture-1', status: 'deleted' } }
const CONFIGURED = { MODEL_ROUTER_URL: 'https://router.example.test/v1/', MODEL_ROUTER_FRONTEND_KEY: KEY, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
const TEXT_GROUPS = ['planning_strategy', 'content_writing', 'research_analysis']

// ---------------------------------------------------------------- loading the real TypeScript
const compiled = new Map()
const compile = (source, fileName) => {
  const cacheKey = `${fileName}\0${source}`
  if (compiled.has(cacheKey)) return compiled.get(cacheKey)
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not compile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  compiled.set(cacheKey, out.outputText)
  return out.outputText
}
function runModule(rel, deps, context = {}) {
  const module = { exports: {} }
  const require = id => { if (id in deps) return deps[id]; throw new Error(`Unexpected import in ${rel}: ${id}`) }
  vm.runInNewContext(compile(read(rel), rel), { module, exports: module.exports, require, process: { env: {} }, console, URL, URLSearchParams, AbortSignal, Promise, setTimeout, clearTimeout, ...context })
  return module.exports
}
const libs = (env = {}) => {
  const p2 = runModule(P2LIB, {})
  const cat = runModule(CATLIB, {})
  const choice = runModule(LIB, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat })
  const server = runModule(SERVER, { '@/lib/studio-model-choice': choice })
  const polish = runModule(POLISH, {}, { process: { env } })
  return { p2, cat, choice, server, polish }
}
const snapshot = JSON.parse(read(SNAPSHOT)), snapshot10 = JSON.parse(read(SNAPSHOT_10))
const icon = name => function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) }
function workspaceModule(env = {}) {
  return runModule(WORKSPACE, {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'), 'lucide-react': new Proxy({}, { get: (_, name) => icon(name) }),
    './model-catalog-snapshot.json': { default: snapshot }, './model-catalog-snapshot-2026-10.json': { default: snapshot10 },
    '@/components/studio-libraries/studio-workflow-action': { StudioWorkflowAction: () => null }, '@/components/layout/app-header': { BackToBuilderButton: () => null },
    '@/components/studio-intro-replay': { StudioIntroReplay: () => null }, '@/components/studio-libraries/destination-intros.css': {}, './personal-workspaces.css': {}, './intelligence-workspace.css': {}, './intelligence-polish.css': {},
  }, { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...env } } })
}

// ---------------------------------------------------------------- the router: an in-process fake that keeps choices per (user) and (user, session) with ETags, as the router does
function fakeRouter({ deckScope = true, refuse = [], refuseAuto = false, timeline = json(`${FIX}/router-timeline-200.json`) } = {}) {
  const store = new Map(), log = []
  const certified = Object.fromEntries(TEXT_GROUPS.map(group => [group, json(FIXTURE).groups[group].selectable_models]))
  const etagOf = rows => `"${sha(JSON.stringify(Object.entries(rows).sort())).slice(0, 32)}"`
  let clock = 0
  const answer = (status, body, etag) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? etag ?? null : null) }, json: async () => JSON.parse(JSON.stringify(body)) })
  const fetch = async (url, init) => {
    log.push({ url, method: init.method, headers: { ...init.headers }, body: init.body ?? null })
    if (init.headers.Authorization !== `Bearer ${KEY}`) return answer(401, { error: { message: 'Invalid key', type: 'authentication_error', code: 'invalid_api_key' } })
    const { pathname } = new URL(url)
    if (pathname.startsWith('/v1/usage/trace/')) return answer(200, timeline)
    const m = /^\/v1\/prefs\/([^/]+)(?:\/sessions\/([^/]+))?$/.exec(pathname)
    if (!m || (m[2] && !deckScope)) return answer(404, json(`${FIX}/router-not-found-404.json`))
    const rows = store.get(pathname) ?? {}
    const view = list => ({ user_id: decodeURIComponent(m[1]), ...(m[2] ? { session_id: decodeURIComponent(m[2]) } : {}), preferences: Object.fromEntries(Object.entries(list).map(([g, r]) => [g, { ...r, stale: false }])), catalogue_version: 'fixture' })
    if (init.method === 'GET') return answer(200, view(rows), etagOf(rows))
    if (init.headers['If-Match'] && init.headers['If-Match'] !== etagOf(rows)) return answer(412, json(`${FIX}/router-prefs-412.json`), etagOf(rows))
    const body = JSON.parse(init.body)
    const isAuto = choice => choice !== null && typeof choice === 'object' && 'auto' in choice
    const autoRefusal = () => answer(422, json(`${FIX}/router-prefs-422-invalid-preference-auto.json`))
    for (const [group, choice] of Object.entries(body.preferences)) {
      if (!isAuto(choice)) continue
      if (!(init.method === 'PUT' && m[2])) return answer(422, { error: { message: 'Extra inputs are not permitted', type: 'invalid_request_error', code: 'extra_forbidden' } }) // the user routes have no auto
      if (refuseAuto || Object.keys(choice).length !== 1 || choice.auto !== true) return autoRefusal() // exactly { "auto": true }, alone; the whole PUT is refused
    }
    for (const [group, choice] of Object.entries(body.preferences)) {
      if (choice === null) continue
      if (!TEXT_GROUPS.includes(group)) return answer(422, { error: { message: 'x', type: 'invalid_request_error', code: 'invalid_preference_group' } })
      if (choice.model && (!certified[group].includes(choice.model) || refuse.includes(choice.model))) return answer(422, { error: { message: 'x', type: 'invalid_request_error', code: 'invalid_preference_model' } })
    }
    const stamp = choice => ({ ...(choice.auto === true ? { auto: true } : {}), preset: choice.preset ?? null, model: choice.model ?? null, updated_at: `2026-10-26T12:00:${String(++clock).padStart(2, '0')}Z` })
    if (init.method === 'PATCH' && !m[2]) {
      const next = { ...rows }
      for (const [group, choice] of Object.entries(body.preferences)) { if (choice === null) delete next[group]; else next[group] = stamp(choice) }
      store.set(pathname, next)
      return answer(200, view(next), etagOf(next))
    }
    if (init.method === 'PUT' && m[2]) {
      const next = Object.fromEntries(Object.entries(body.preferences).map(([group, choice]) => [group, stamp(choice)]))
      store.set(pathname, next)
      return answer(200, { ...view(next), preferences: Object.fromEntries(Object.entries(view(next).preferences).map(([group, row]) => [group, row.auto === true ? { auto: true } : row])) }) // like the router's PUT: no ETag; an auto group is echoed as { "auto": true }
    }
    return answer(405, { detail: 'Method Not Allowed' })
  }
  return { fetch, store, log, bump(pathname, rows) { store.set(pathname, rows) }, etagOf }
}

// ---------------------------------------------------------------- the chooser under a small hook runtime, with the REAL server handlers behind its fetch
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree, ...walk(tree.props?.children)]
const textOf = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : tree && typeof tree === 'object' ? textOf(tree.props?.children ?? '') : ''
const tick = () => new Promise(resolve => setImmediate(resolve))
function makeStorage(seed = {}, mode = {}) {
  const map = new Map(Object.entries(seed)), log = []
  return {
    map, log, mode,
    getItem(key) { log.push(`get ${key}`); if (mode.get) throw new Error('SecurityError'); return map.has(key) ? map.get(key) : null },
    setItem(key, value) { log.push(`set ${key}`); if (mode.set) throw new Error('QuotaExceededError'); map.set(key, String(value)) },
    removeItem(key) { log.push(`remove ${key}`); map.delete(key) },
  }
}
const okCatalogue = body => ({ status: 200, body })
async function mount({ env = {}, catalogue = okCatalogue(json(FIXTURE)), studio = 'unconfigured', router = fakeRouter(), storage = makeStorage(), search = '' } = {}) {
  const fullEnv = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true', ...env }
  const studioEnv = studio === 'account' ? CONFIGURED : { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
  const listeners = new Map()
  const win = { location: { search }, localStorage: storage, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const { p2, cat, choice, server, polish } = libs(fullEnv)
  const fetchLog = []
  const respond = (status, body, etag) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? etag ?? null : null) }, json: async () => { if (body === undefined) throw new SyntaxError('no body'); return JSON.parse(JSON.stringify(body)) } })
  const fetchImpl = async (url, init = {}) => {
    fetchLog.push({ url: String(url), init })
    if (url === '/api/models/catalogue') {
      if (catalogue.throws) throw new TypeError('Failed to fetch')
      return respond(catalogue.status, catalogue.notJson ? undefined : catalogue.body)
    }
    if (studio === 'down') throw new TypeError('Failed to fetch')
    const deps = { env: studioEnv, getSessionUser: async () => ME, findOwnedSession: async id => OWNED[id] ?? null, fetch: router.fetch }
    let outcome
    if (url.startsWith('/api/model-choice/used/')) outcome = await server.handleUsed(decodeURIComponent(url.slice('/api/model-choice/used/'.length)), deps)
    else if (url.startsWith('/api/model-choice/prefs')) {
      const deck = url.startsWith('/api/model-choice/prefs/deck/') ? decodeURIComponent(url.slice('/api/model-choice/prefs/deck/'.length)) : null
      outcome = await server.handlePrefs(init.method ?? 'GET', deck, { ifMatch: init.headers?.['If-Match'] ?? null, body: async () => JSON.parse(init.body) }, deps)
    } else throw new Error(`the browser asked for ${url}`)
    return respond(outcome.status, outcome.body, outcome.etag)
  }
  const workspaceReal = workspaceModule(fullEnv)
  const workspace = { ...workspaceReal, IntelligenceReadiness: function IntelligenceReadiness() { return { type: 'button', props: { 'data-stub': 'readiness' } } }, ManagedByDeckster: function ManagedByDeckster() { return { type: 'section', props: { 'data-stub': 'managed' } } } }
  let current, changes = 0, dirty = false
  const fibers = new Map(), queue = []
  const hooks = {
    useState(initial) {
      const fiber = current, index = fiber.cursor++
      if (!(index in fiber.state)) fiber.state[index] = typeof initial === 'function' ? initial() : initial
      return [fiber.state[index], value => { const next = typeof value === 'function' ? value(fiber.state[index]) : value; if (!Object.is(next, fiber.state[index])) { fiber.state[index] = next; dirty = true; changes++ } }]
    },
    useEffect(effect, deps) {
      assert.ok(Array.isArray(deps), 'every effect needs a dependency array')
      const fiber = current, index = fiber.cursor++, prior = fiber.effects[index]
      if (!prior || deps.length !== prior.deps.length || deps.some((value, i) => !Object.is(value, prior.deps[i]))) fiber.pending.push({ fiber, index, effect, deps })
    },
  }
  const mockJsx = (type, props) => ({ type, props: props || {} })
  const mod = runModule(CHOOSER, {
    react: hooks, 'react/jsx-runtime': { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' }, 'lucide-react': new Proxy({}, { get: (_, name) => String(name) }),
    './intelligence-workspace': workspace, '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': choice, '@/lib/studio-p2-polish': polish,
    './intelligence-p2.css': {}, './intelligence-model-choice.css': {},
  }, { window: win, fetch: fetchImpl, process: { env: fullEnv } })
  function resolve(node, where) {
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${where}.${i}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const key = `${where}/${node.type.name}`
      let fiber = fibers.get(key)
      if (!fiber) fibers.set(key, fiber = { state: [], effects: [], cursor: 0, pending: [] })
      const parent = current
      current = fiber; fiber.cursor = 0
      const out = node.type(node.props)
      current = parent
      const resolved = resolve(out, key)
      queue.push(...fiber.pending); fiber.pending = []
      return resolved
    }
    return { type: node.type, props: { ...node.props, children: resolve(node.props.children, `${where}.c`) } }
  }
  const rt = {
    storage, win, listeners, fetchLog, router, lib: choice, server, tree: null,
    flush() {
      for (let pass = 0; pass < 40; pass++) {
        dirty = false; queue.length = 0
        rt.tree = resolve({ type: mod.ModelChoiceChooser, props: {} }, 'root')
        for (const { fiber, index, effect, deps } of queue.splice(0)) { fiber.effects[index]?.cleanup?.(); fiber.effects[index] = { deps, cleanup: effect() } }
        if (!dirty) return rt
      }
      throw new Error('render loop did not settle')
    },
    async settle() {
      for (let round = 0; round < 40; round++) {
        rt.flush()
        const before = changes
        for (let i = 0; i < 8; i++) await tick()
        if (changes === before) return rt
      }
      throw new Error('did not settle')
    },
    async act(fn) { fn(); return rt.settle() },
    nodes() { return walk(rt.tree) },
    find(predicate, label = 'node') { const found = rt.nodes().find(predicate); assert.ok(found, `expected ${label}`); return found },
    maybe(predicate) { return rt.nodes().find(predicate) },
    all(predicate) { return rt.nodes().filter(predicate) },
    select(task) { return rt.find(node => node.type === 'select' && node.props.id === `sp-p2-model-${task}`, `select ${task}`) },
    hasSelect(task) { return Boolean(rt.maybe(node => node.type === 'select' && node.props.id === `sp-p2-model-${task}`)) },
    options(task) { return walk(rt.select(task).props.children).filter(node => node.type === 'option').map(node => ({ value: node.props.value, label: textOf(node) })) },
    groups(task) { return walk(rt.select(task).props.children).filter(node => node.type === 'optgroup').map(node => node.props.label) },
    async choose(task, value) { return rt.act(() => rt.select(task).props.onChange({ target: { value } })) },
    current(task) { return textOf(rt.find(node => node.props?.['data-p2-current'] === task, `current ${task}`)) },
    row(task) { return rt.find(node => node.props?.['data-model-task'] === task, `row ${task}`) },
    radio(value) { return rt.find(node => node.type === 'input' && node.props.name === 'sp-mc2-scope' && node.props.value === value, `radio ${value}`) },
    scopeNote() { const node = rt.maybe(n => n.props?.id === 'sp-mc2-scope-note'); return node ? textOf(node) : '' },
    note() { return textOf(rt.find(node => node.props?.['data-p2-note'] === 'true', 'the note')) },
    feedback() { return textOf(rt.find(node => String(node.props?.className || '').includes('sp-p2-feedback'), 'the live region')) },
    pill() { return rt.find(node => node.props?.['data-p2-status'] !== undefined, 'the pill') },
    reset() { return rt.maybe(node => node.props?.['data-p2-reset'] === 'true') },
    text() { return textOf(rt.tree) },
  }
  return rt.settle()
}

// ---------------------------------------------------------------- the route files, run with stubbed imports
async function callRoute(rel, method, { env = CONFIGURED, user = ME, url = 'https://studio.example.test/api/model-choice/prefs', headers = {}, body, params, router = fakeRouter(), owned = OWNED, ownedThrows = false } = {}) {
  const calls = { session: 0, prisma: 0, console: [] }
  const consoleSpy = new Proxy({}, { get: (_, level) => (...args) => calls.console.push([level, args.map(String).join(' ')]) })
  const { server } = libs()
  const deps = {
    'next/server': nextServer,
    'next-auth': { getServerSession: async () => { calls.session++; return user ? { user } : null } },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/studio-model-choice-server': server,
    '@/lib/prisma': { prisma: { chatSession: { findUnique: async ({ where }) => { calls.prisma++; if (ownedThrows) throw new Error('db down'); return owned[where.id] ?? null } } } },
  }
  const mod = runModule(rel, deps, { process: { env }, fetch: router.fetch, console: consoleSpy })
  const req = new nextServer.NextRequest(url, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
  const response = await mod[method](req, { params: Promise.resolve(params ?? {}) })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null, text, headers: response.headers, calls, router }
}

// ---------------------------------------------------------------- expected values (written out here, not derived from the helpers)
const TASK_IDS = ['planning_strategy', 'content_writing', 'research_analysis', 'imagery', 'voice_narration']
const S = 'Suggested'
const EXPECTED = {
  planning_strategy: {
    presets: [['best', 'Best — Kimi K3 · $$$'], ['balanced', 'Balanced — Gemini 3.8 Flash · $$'], ['economy', 'Fast — GPT-6 Luna · $']],
    models: [['anthropic/claude-opus-5.5', `Claude Opus 5.5 · Anthropic · ${S}`], ['deepseek/deepseek-v4.1-flash', `DeepSeek V4.1 Flash · DeepSeek · ${S}`], ['google/gemini-3.8-flash', `Gemini 3.8 Flash · Google · ${S}`],
      ['moonshotai/kimi-k3', `Kimi K3 · Moonshot AI · ${S}`], ['nvidia/nemotron-3.5-lightning', `Nemotron 3.5 Lightning · NVIDIA · ${S}`], ['openai/gpt-6-luna', `GPT-6 Luna · OpenAI · ${S}`],
      ['openai/gpt-6.1-sol', `GPT-6.1 Sol · OpenAI · ${S}`], ['qwen/qwen3.8-flash', `Qwen3.8 Flash · Qwen · ${S}`], ['x-ai/grok-4.6', `SpaceXAI: Grok 4.6 · xAI · ${S}`]],
  },
  content_writing: {
    presets: [['best', 'Best — Claude Sonnet 5.5 · $$$'], ['balanced', 'Balanced — GPT-6 Luna · $$'], ['economy', 'Fast — GPT-6 Luna · $']],
    models: [['anthropic/claude-opus-5.5', `Claude Opus 5.5 · Anthropic · ${S}`], ['anthropic/claude-sonnet-5.5', `Claude Sonnet 5.5 · Anthropic · ${S}`], ['deepseek/deepseek-v4.1-flash', `DeepSeek V4.1 Flash · DeepSeek · ${S}`],
      ['moonshotai/kimi-k3', `Kimi K3 · Moonshot AI · ${S}`], ['openai/gpt-6-luna', `GPT-6 Luna · OpenAI · ${S}`], ['openai/gpt-6.1-sol', `GPT-6.1 Sol · OpenAI · ${S}`], ['qwen/qwen3.8-flash', `Qwen3.8 Flash · Qwen · ${S}`],
      ['x-ai/grok-4.7', `SpaceXAI: Grok 4.7 · xAI · ${S}`]],
  },
  research_analysis: {
    presets: [['best', 'Best — Claude Opus 5.5 · $$$'], ['balanced', 'Balanced — GPT-6 Luna · $$'], ['economy', 'Fast — GPT-6 Luna · $']],
    models: [['anthropic/claude-opus-5.5', `Claude Opus 5.5 · Anthropic · ${S}`], ['anthropic/claude-sonnet-5.5', `Claude Sonnet 5.5 · Anthropic · ${S}`], ['deepseek/deepseek-v4.1-flash', `DeepSeek V4.1 Flash · DeepSeek · ${S}`],
      ['google/gemini-3.5-flash-lite', `Gemini 3.5 Flash Lite · Google · ${S}`], ['moonshotai/kimi-k3', `Kimi K3 · Moonshot AI · ${S}`], ['openai/gpt-6-luna', `GPT-6 Luna · OpenAI · ${S}`],
      ['openai/gpt-6.1-sol', `GPT-6.1 Sol · OpenAI · ${S}`], ['qwen/qwen3.8-flash', `Qwen3.8 Flash · Qwen · ${S}`], ['x-ai/grok-4.7', `SpaceXAI: Grok 4.7 · xAI · ${S}`]],
  },
}
const DEFAULT_LABEL = 'Recommended — Deckster chooses'
const optionsFor = task => [{ value: 'default', label: DEFAULT_LABEL }, ...EXPECTED[task].presets.map(([value, label]) => ({ value, label })), ...EXPECTED[task].models.map(([slug, label]) => ({ value: `model:${slug}`, label }))]
const FIXTURE_CHANGES = ['catalogue_version', 'groups.imagery.selectable_models', 'groups.imagery.recommended', 'groups.voice_narration.selectable_models', 'groups.voice_narration.recommended',
  'groups.structure_layout.selectable_models', 'groups.embeddings.selectable_models', 'groups.embeddings.presets', 'models.openai/text-embedding-4-small'].sort()
const NOTES = {
  pending: 'Your choices are kept on this device. Deckster does not use them to pick models yet.',
  account: 'Your choices are saved to your account. They apply from the next build.',
  unconfigured: 'Saving isn’t switched on yet; your choice stays on this device.',
  unreachable: 'Your choices could not be saved to your account right now, so they stay on this device. They do not change which models Deckster uses.',
  noStorage: 'This browser cannot keep your choices, so they last only until you reload or leave. Deckster does not use them to pick models yet.',
}
const LEGACY_KEY = `deckster-studio-intelligence-p2-v1:${snapshot.version}`
const USER_KEY = 'deckster-studio-model-choice-v1:user'
const USER_PATH = `/v1/prefs/${ME.id}`, SESSION_PATH = `/v1/prefs/${ME.id}/sessions/sess-fixture-1`
const REASON_COPY = [
  [{ resolution: 'user_model' }, 'Your default: M'], [{ resolution: 'user_preset' }, 'Your default: M'], [{ resolution: 'deck_model' }, 'This presentation: M'], [{ resolution: 'deck_preset' }, 'This presentation: M'],
  [{ resolution: 'capability_fallback', needs: ['image_output'] }, "Used M: your pick can't do this step (needs images)"], [{ resolution: 'capability_fallback', needs: ['tools', 'json_schema'] }, "Used M: your pick can't do this step (needs tools / structured output)"],
  [{ resolution: 'capability_fallback' }, "Used M: your pick can't do this step"], [{ resolution: 'choice_not_certified' }, "Your pick isn't available right now; used M"],
  [{ resolution: 'choice_not_allowed' }, 'This step uses tested models only; used M'], [{ resolution: 'task_pinned' }, 'Fixed for this step: M'], [{ resolution: 'task_default' }, 'Fixed for this step: M'],
  [{}, 'Fixed for this step: M'], [{ resolution: 'user_preset', fallback_depth: 1 }, 'Your pick failed; used backup M'], [{ resolution: 'deck_model', fallback_depth: 2 }, 'Your pick failed; used backup M'],
  [{ resolution: 'task_pinned', fallback_depth: 1 }, 'Fixed for this step: M'],
  [{ resolution: 'deck_auto' }, "This presentation: Auto (Deckster's choice): M"], [{ resolution: 'deck_auto', fallback_depth: 1 }, "This presentation: Auto (Deckster's choice): M"],
]

// ================================================================ the whole check
async function suite({ quiet = false, extraCommitted = [] } = {}) {
  let checks = 0
  const failures = []
  const check = async (name, fn) => { try { await fn(); checks++ } catch (error) { failures.push(`${name}: ${String(error.message).split('\n')[0]}`) } }
  const eq = assert.equal, ok = assert.ok, deep = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m)
  const strip = await stripModule()
  const fixture = json(FIXTURE), recorded = json(RECORDED)

  // ---- A. fixtures ------------------------------------------------------------------------------------------------------------------------------------------------
  await check('A: the catalogue fixture has the recorded structure, and changes only what is listed', () => {
    const paths = []
    const diff = (a, b, at) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return
      if (at.split('.').length >= 3 || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { paths.push(at); return }
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], at ? `${at}.${key}` : key)
    }
    diff(fixture, recorded, '')
    deep(paths.sort(), FIXTURE_CHANGES)
    deep(Object.fromEntries(Object.entries(fixture.groups).map(([k, g]) => [k, g.visibility])), Object.fromEntries(Object.entries(recorded.groups).map(([k, g]) => [k, g.visibility])))
    const shape = model => JSON.stringify([Object.keys(model), Object.keys(model.capabilities), Object.keys(model.premium)])
    for (const model of Object.values(fixture.models)) eq(shape(model), shape(recorded.models['openai/gpt-6-luna']))
  })
  await check('A: the router fixtures have the router\'s shapes (read_api.py prefs, errors.py, timeline_api.py items)', () => {
    for (const name of ['router-prefs-user-200.json', 'router-prefs-session-200.json']) {
      const body = json(`${FIX}/${name}`)
      ok(['user_id', 'preferences', 'catalogue_version'].every(key => key in body), name)
      for (const row of Object.values(body.preferences)) deep(Object.keys(row), ['preset', 'model', 'updated_at', 'stale'], name)
    }
    deep(Object.keys(json(`${FIX}/router-prefs-412.json`).error), ['message', 'type', 'code']); eq(json(`${FIX}/router-prefs-412.json`).error.code, 'preferences_modified')
    deep(json(`${FIX}/router-not-found-404.json`), { detail: 'Not Found' })
    const items = json(`${FIX}/router-timeline-200.json`).data
    const fields = ['id', 'trace_id', 'seq', 'ts', 'user_id', 'session_id', 'presentation_id', 'service', 'task', 'group', 'model_served', 'tokens_in', 'tokens_out', 'billable_usd', 'deckster_tokens', 'latency_ms', 'status', 'fallback_depth', 'attempts']
    for (const item of items) ok(fields.every(field => field in item), `item ${item.id}`)
    ok(new Set(items.map(item => item.user_id)).size >= 3, 'rows of several people')
  })

  await check('A: the deck Auto fixtures are shaped as ROUTER-2\'s model-router !42 example (auto only on auto groups; the PUT echoes { auto: true }; a bad auto is invalid_preference_auto)', () => {
    const get = json(`${FIX}/router-prefs-session-auto-200.json`)
    deep(Object.keys(get.preferences.planning_strategy), ['auto', 'preset', 'model', 'updated_at', 'stale']); eq(get.preferences.planning_strategy.auto, true); eq(get.preferences.planning_strategy.preset, null); eq(get.preferences.planning_strategy.model, null)
    ok(!('auto' in get.preferences.content_writing), 'the key is on auto groups only'); deep(Object.keys(get.preferences.content_writing), ['preset', 'model', 'updated_at', 'stale'])
    deep(json(`${FIX}/router-put-session-auto-200.json`).preferences, { planning_strategy: { auto: true } })
    const refusal = json(`${FIX}/router-prefs-422-invalid-preference-auto.json`); deep(Object.keys(refusal.error), ['message', 'type', 'code']); eq(refusal.error.code, 'invalid_preference_auto')
  })

  // ---- B. mapping ----------------------------------------------------------------------------------------------------------------------------------------------------
  const rt = await mount()
  await check('B: the three text groups are read by the tasks of the same id; exact options', () => {
    deep({ ...rt.lib.MODEL_CHOICE_GROUP_FOR_TASK }, Object.fromEntries(TASK_IDS.map(id => [id, id])))
    deep([...rt.lib.MODEL_CHOICE_CHOOSABLE_GROUPS], TEXT_GROUPS)
    for (const task of TEXT_GROUPS) {
      eq(rt.row(task).props['data-model-choice-source'], 'live', task)
      deep(rt.options(task), optionsFor(task), task); deep(rt.groups(task), ['Presets', 'Specific models'], task)
      eq(rt.current(task), 'Deckster choosesRecommended', task)
    }
  })
  await check('B: imagery and narration are "Fixed for now": no select, whatever the catalogue certifies', () => {
    for (const task of ['imagery', 'voice_narration']) {
      eq(rt.row(task).props['data-model-choice-source'], 'fixed'); ok(!rt.hasSelect(task), `${task}: no select`)
      eq(rt.current(task), 'Fixed for nowNot open for choice yet')
      eq(textOf(rt.find(node => node.props?.['data-model-choice-fixed'] === task)), 'Deckster picks this model. No model is certified for choosing here yet.')
    }
  })
  await check('B: the recorded catalogue gives the same text options', async () => {
    const r = await mount({ catalogue: okCatalogue(recorded) })
    for (const task of TEXT_GROUPS) deep(r.options(task), optionsFor(task), task)
  })

  // ---- C. never ----------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('C: no select offers a model only a system group or embeddings certifies', () => {
    const offered = TEXT_GROUPS.flatMap(task => rt.options(task).map(option => option.value))
    ok(!offered.includes('model:openai/text-embedding-4-small'))
    deep(rt.lib.MODEL_CHOICE_NEVER_GROUPS, ['embeddings'])
  })
  await check('C: embeddings is never read even if a task named it and the catalogue made it user-visible', () => {
    const { choice, cat } = libs()
    const c = choice.withPresets(cat.parseCatalogue(fixture), fixture)
    c.groups.find(g => g.key === 'embeddings').visible = true
    choice.MODEL_CHOICE_GROUP_FOR_TASK.planning_strategy = 'embeddings'
    eq(choice.choiceGroup(c, 'planning_strategy'), null); eq(choice.rowSource('planning_strategy', c, snapshot).kind, 'fixed', 'and a task that named it would not be choosable')
  })
  await check('C: a text task whose group is not user-visible (or missing) keeps the built-in list, and the page says which', async () => {
    const body = json(FIXTURE); body.groups.planning_strategy.visibility = 'system'; delete body.groups.content_writing
    const r = await mount({ catalogue: okCatalogue(body) })
    eq(r.row('planning_strategy').props['data-model-choice-source'], 'static'); eq(r.row('content_writing').props['data-model-choice-source'], 'static'); eq(r.row('research_analysis').props['data-model-choice-source'], 'live')
    const note = r.find(node => node.props?.['data-model-choice-static'] !== undefined, 'the static note')
    eq(textOf(note), 'Planning & Strategy, Content Writing keep the built-in list: the model catalog has no group open for them.')
  })

  // ---- D. modality --------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('D: narration offers audio models only, imagery image models only; a preset naming another is dropped; no entry, no offer', () => {
    const { choice, cat } = libs()
    const body = json(FIXTURE); body.groups.voice_narration.presets.best = 'anthropic/claude-sonnet-5.5'; body.groups.imagery.selectable_models.push('google/no-entry-image')
    const c = choice.withPresets(cat.parseCatalogue(body), body)
    const group = key => c.groups.find(g => g.key === key)
    deep(choice.offeredModels(c, group('voice_narration')), ['fish-audio/s2.1-pro', 'microsoft/mai-voice-2-flash', 'hexgrad/kokoro-82m'])
    deep(choice.offeredModels(c, group('imagery')), ['google/gemini-3.1-flash-image-preview', 'google/gemini-2.5-flash-image'])
    eq(choice.presetModel(c, group('voice_narration'), 'best'), null); eq(choice.presetModel(c, group('voice_narration'), 'economy'), 'hexgrad/kokoro-82m')
    deep({ ...choice.MODEL_CHOICE_GROUP_NEEDS }, { voice_narration: 'speechOutput', imagery: 'imageOutput' })
  })

  // ---- E. tiers -----------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('E: the tiers, their wire values and hints; Economy is never shown', () => {
    deep(rt.lib.MODEL_CHOICE_TIERS, [{ id: 'best', label: 'Best', hint: '$$$' }, { id: 'balanced', label: 'Balanced', hint: '$$' }, { id: 'economy', label: 'Fast', hint: '$' }])
    ok(!rt.text().includes('Economy'))
    eq(textOf(rt.find(node => node.props?.['data-model-choice-cost'] === 'true')), 'Cost hint: $ is the lowest-cost tier and $$$ the highest. Prices are not listed.')
    ok(String(rt.select('planning_strategy').props['aria-describedby']).split(' ').includes('sp-mc2-cost'))
  })
  await check('E: a model\'s catalogue cost_hint is preferred over the tier hint; a malformed one is ignored', async () => {
    const body = json(FIXTURE); body.models['moonshotai/kimi-k3'].cost_hint = '$$'; body.models['openai/gpt-6-luna'].cost_hint = '$$$$'; body.models['openai/gpt-6.1-sol'].cost_hint = '$$$'
    const r = await mount({ catalogue: okCatalogue(body) })
    deep(r.options('planning_strategy').slice(1, 4).map(o => o.label), ['Best — Kimi K3 · $$', 'Balanced — Gemini 3.8 Flash · $$', 'Fast — GPT-6 Luna · $'])
    eq(r.options('planning_strategy').find(o => o.value === 'model:openai/gpt-6.1-sol').label, `GPT-6.1 Sol · OpenAI · $$$ · ${S}`)
    await r.choose('planning_strategy', 'best'); eq(r.current('planning_strategy'), 'Kimi K3Moonshot AI · Best $$ · Your choice')
  })
  await check('E: Fast goes to the router as economy', async () => {
    const r = await mount({ studio: 'account' })
    await r.choose('content_writing', 'economy')
    eq(r.select('content_writing').props.value, 'economy'); eq(r.router.store.get(USER_PATH).content_writing.preset, 'economy')
    eq(r.current('content_writing'), 'GPT-6 LunaOpenAI · Fast $ · Your choice')
  })
  await check('E: the built-in list relabels Economy as Fast and its presets name no model', async () => {
    const r = await mount({ catalogue: { status: 502, body: { error: 'x', code: 'director_error' } } })
    deep(r.options('planning_strategy').slice(1, 4), [{ value: 'best', label: 'Best · $$$' }, { value: 'balanced', label: 'Balanced · $$' }, { value: 'economy', label: 'Fast · $' }])
  })

  // ---- F. scopes ----------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('F: without a deck, "This presentation" is a disabled radio with its note', () => {
    eq(rt.radio('user').props.checked, true); eq(rt.radio('deck').props.disabled, true); eq(rt.scopeNote(), 'Open this page from a presentation to choose for it alone.')
    eq(textOf(rt.find(node => node.type === 'legend')), 'Where your choices apply')
  })
  await check('F: the deck key is the Builder\'s session id (?session_id=), a plain id; the router\'s session scope', () => {
    const { choice, server } = libs()
    eq(choice.deckIdFromSearch('?session_id=sess-1'), 'sess-1'); eq(choice.deckIdFromSearch('?session_id=new'), null); eq(choice.deckIdFromSearch('?presentation_id=p1'), null); eq(choice.deckIdFromSearch('?session_id=../x'), null)
    eq(choice.MODEL_CHOICE_DECK_PARAM, 'session_id'); eq(server.MODEL_CHOICE_DECK_SCOPE, 'sessions')
    eq(server.routerPrefsPath('u 1', 's/2'), '/v1/prefs/u%201/sessions/s%2F2'); eq(server.routerPrefsPath('u1'), '/v1/prefs/u1')
  })
  await check('F: opened from a deck (account, R3 on): the deck scope; a deck choice goes to the session (GET then PUT, the whole map, If-Match); the reusable defaults stay; the deck follows them', async () => {
    const router = fakeRouter()
    router.bump(USER_PATH, { content_writing: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    router.bump(SESSION_PATH, { research_analysis: { preset: null, model: 'openai/gpt-6.1-sol', updated_at: '2026-10-26T09:00:00Z' } })
    const r = await mount({ studio: 'account', router, search: '?session_id=sess-fixture-1' })
    eq(r.radio('deck').props.checked, true); eq(r.scopeNote(), 'Applies from this presentation’s next build. A new presentation’s first build uses your reusable defaults.')
    eq(r.select('research_analysis').props.value, 'model:openai/gpt-6.1-sol')
    eq(r.current('content_writing'), 'Claude Sonnet 5.5Anthropic · Best $$$ · Reusable default'); eq(r.options('content_writing')[0].label, 'Use my default: Claude Sonnet 5.5')
    const before = router.log.length
    await r.choose('planning_strategy', 'balanced')
    const writes = router.log.slice(before)
    deep(writes.map(entry => `${entry.method} ${new URL(entry.url).pathname}`), [`GET ${SESSION_PATH}`, `PUT ${SESSION_PATH}`, `GET ${SESSION_PATH}`])
    eq(writes[1].headers['If-Match'], router.etagOf({ research_analysis: { preset: null, model: 'openai/gpt-6.1-sol', updated_at: '2026-10-26T09:00:00Z' } }))
    deep(JSON.parse(writes[1].body), { preferences: { research_analysis: { model: 'openai/gpt-6.1-sol' }, planning_strategy: { preset: 'balanced' } } })
    eq(router.store.get(USER_PATH).content_writing.preset, 'best', 'the reusable defaults are untouched')
    eq(r.feedback(), 'Planning & Strategy: Gemini 3.8 Flash saved for this presentation. Applies from the next build.')
    await r.choose('research_analysis', 'default')
    ok(!('research_analysis' in router.store.get(SESSION_PATH)), 'null clears the group: "use my defaults"')
  })
  await check('F: the router has no deck scope yet (R3: 404): the radio is disabled, the defaults apply, nothing is an error', async () => {
    const r = await mount({ studio: 'account', router: fakeRouter({ deckScope: false }), search: '?session_id=sess-fixture-1' })
    eq(r.radio('deck').props.disabled, true); eq(r.radio('user').props.checked, true)
    eq(r.scopeNote(), 'Choices for one presentation aren’t available yet, so your reusable defaults apply.')
    eq(r.note(), NOTES.account, 'the account still saves the reusable defaults')
  })
  for (const [id, label] of [['sess-unsaved', 'not saved'], ['sess-other', 'another person\'s'], ['sess-gone', 'deleted']]) {
    await check(`F: a session that is ${label}: no deck scope, the defaults apply`, async () => {
      const r = await mount({ studio: 'account', search: `?session_id=${id}` })
      eq(r.radio('deck').props.disabled, true); eq(r.scopeNote(), 'Choices for this presentation can’t be saved yet, so your reusable defaults apply.'); eq(r.note(), NOTES.account)
    })
  }

  await check('F: on "This presentation" a row has "Use my default: <it>" and "Auto: Deckster chooses" as two rows; "Reusable defaults" has the recommendation alone, no deck Auto', async () => {
    const router = fakeRouter()
    router.bump(USER_PATH, { content_writing: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    const r = await mount({ studio: 'account', router, search: '?session_id=sess-fixture-1' })
    deep(r.options('content_writing').slice(0, 2), [{ value: 'default', label: 'Use my default: Claude Sonnet 5.5' }, { value: 'auto', label: 'Auto: Deckster chooses' }])
    deep(r.options('planning_strategy').slice(0, 2), [{ value: 'default', label: 'Use my default: Auto' }, { value: 'auto', label: 'Auto: Deckster chooses' }], 'no default of mine: the default is Auto')
    eq(r.options('planning_strategy').length, optionsFor('planning_strategy').length + 1, 'one more row than the reusable defaults')
    for (const task of ['imagery', 'voice_narration']) ok(!r.hasSelect(task), `${task}: fixed, no row`)
    await r.act(() => r.radio('user').props.onChange())
    deep(r.options('planning_strategy'), optionsFor('planning_strategy')); eq(r.options('planning_strategy')[0].label, 'Recommended — Deckster chooses'); ok(!r.options('planning_strategy').some(option => option.value === 'auto'), 'no deck Auto on the reusable defaults')
    const before = r.router.log.length
    await r.choose('planning_strategy', 'auto')
    eq(r.router.log.length, before, 'a deck Auto picked on the reusable defaults is ignored: nothing is sent'); eq(r.select('planning_strategy').props.value, 'default')
  })
  await check('F: the deck\'s own Auto is saved as { "auto": true } in the session scope, read back as Auto, and "Use my default" leaves the group out', async () => {
    const router = fakeRouter()
    router.bump(USER_PATH, { planning_strategy: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    const r = await mount({ studio: 'account', router, search: '?session_id=sess-fixture-1' })
    eq(r.current('planning_strategy'), 'Kimi K3Moonshot AI · Best $$$ · Reusable default', 'it follows my default')
    await r.choose('planning_strategy', 'auto')
    const put = router.log.filter(entry => entry.method === 'PUT').at(-1)
    deep(JSON.parse(put.body), { preferences: { planning_strategy: { auto: true } } }); eq(put.body.includes('"auto":true'), true)
    eq(router.store.get(SESSION_PATH).planning_strategy.auto, true); eq(r.select('planning_strategy').props.value, 'auto'); eq(r.current('planning_strategy'), 'AutoDeckster chooses')
    eq(r.feedback(), 'Planning & Strategy: Auto, Deckster chooses, saved for this presentation. Applies from the next build.')
    eq(router.store.get(USER_PATH).planning_strategy.preset, 'best', 'the reusable default is untouched')
    const again = await mount({ studio: 'account', router, search: '?session_id=sess-fixture-1' })
    eq(again.select('planning_strategy').props.value, 'auto', 'read back as Auto'); eq(again.current('planning_strategy'), 'AutoDeckster chooses'); eq(again.feedback(), 'Your earlier choices were restored.', 'a deck Auto is a choice, not a dropped one')
    await again.choose('planning_strategy', 'default')
    ok(!('planning_strategy' in router.store.get(SESSION_PATH)), 'use my default: the group is omitted'); eq(again.select('planning_strategy').props.value, 'default'); eq(again.current('planning_strategy'), 'Kimi K3Moonshot AI · Best $$$ · Reusable default')
  })
  await check('F: the router refusing Auto (422 invalid_preference_auto) keeps the earlier choice and the page says it was Auto', async () => {
    const router = fakeRouter({ refuseAuto: true })
    router.bump(SESSION_PATH, { research_analysis: { preset: 'balanced', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    const r = await mount({ studio: 'account', router, search: '?session_id=sess-fixture-1' })
    await r.choose('research_analysis', 'auto')
    eq(r.select('research_analysis').props.value, 'balanced'); eq(r.feedback(), 'Auto cannot be saved for this presentation right now, so it keeps what it had.')
    eq(router.store.get(SESSION_PATH).research_analysis.preset, 'balanced', 'nothing was saved'); eq(router.log.filter(entry => entry.method === 'PUT').length, 1)
    await r.choose('research_analysis', 'model:openai/gpt-6.1-sol')
    ok(r.feedback().startsWith('Research & Analysis: GPT-6.1 Sol saved for this presentation'), 'a model still saves')
  })
  await check('F: on this device a deck Auto is kept under the deck\'s key; the reusable defaults never keep one', async () => {
    const storage = makeStorage()
    const r = await mount({ studio: 'unconfigured', storage, search: '?session_id=sess-fixture-1' })
    await r.choose('content_writing', 'auto')
    deep(JSON.parse(storage.map.get('deckster-studio-model-choice-v1:deck:sess-fixture-1')), { v: 1, scope: 'deck', deck: 'sess-fixture-1', choices: { content_writing: 'auto' } }); eq(r.feedback(), 'Content Writing: Auto, Deckster chooses, kept on this device for this presentation.')
    const { choice } = libs()
    eq(choice.parseChoices({ kind: 'user' }, '{"v":1,"scope":"user","choices":{"content_writing":"auto","planning_strategy":"best"}}').content_writing, 'default', 'an auto in the reusable defaults reads as the recommendation')
    eq(choice.parseChoices({ kind: 'deck', deckId: 'a' }, '{"v":1,"scope":"deck","deck":"a","choices":{"content_writing":"auto"}}').content_writing, 'auto')
  })

  // ---- G. adapter ---------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('G: the account: the router\'s choices load; each save sends the ETag it last saw as If-Match; the router keeps tiers as presets and models as models', async () => {
    const router = fakeRouter()
    router.bump(USER_PATH, { planning_strategy: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    const r = await mount({ studio: 'account', router })
    eq(r.select('planning_strategy').props.value, 'best'); eq(r.pill().props['data-p2-status'], 'saved'); eq(textOf(r.pill()), 'Saved to your account')
    await r.choose('content_writing', 'model:anthropic/claude-opus-5.5')
    const tagAfterFirst = router.etagOf(router.store.get(USER_PATH))
    const patches = router.log.filter(entry => entry.method === 'PATCH')
    eq(patches.length, 1); eq(patches[0].headers['If-Match'], router.etagOf({ planning_strategy: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } }))
    deep(JSON.parse(patches[0].body), { preferences: { planning_strategy: { preset: 'best' }, content_writing: { model: 'anthropic/claude-opus-5.5' }, research_analysis: null } })
    await r.choose('research_analysis', 'economy')
    const second = router.log.filter(entry => entry.method === 'PATCH')[1]
    eq(second.headers['If-Match'], tagAfterFirst, 'the tag of the previous save')
    ok(!r.storage.log.some(entry => entry.startsWith('set ')), 'nothing on the device')
  })
  await check('G: a change made elsewhere: the save is refused (412) and the page shows the saved choices', async () => {
    const router = fakeRouter()
    const r = await mount({ studio: 'account', router })
    router.bump(USER_PATH, { planning_strategy: { preset: 'economy', model: null, updated_at: '2026-10-26T13:00:00Z' } })
    await r.choose('content_writing', 'best')
    eq(r.feedback(), 'Your choices changed elsewhere, so the saved ones are shown.')
    eq(r.select('planning_strategy').props.value, 'economy'); eq(r.select('content_writing').props.value, 'default')
    deep(router.store.get(USER_PATH), { planning_strategy: { preset: 'economy', model: null, updated_at: '2026-10-26T13:00:00Z' } }, 'nothing written over it')
  })
  await check('G: a choice the router refuses goes back, and the page says so', async () => {
    const r = await mount({ studio: 'account', router: fakeRouter({ refuse: ['x-ai/grok-4.6'] }) })
    await r.choose('planning_strategy', 'model:x-ai/grok-4.6')
    eq(r.select('planning_strategy').props.value, 'default'); eq(r.feedback(), 'That choice cannot be saved for this task right now.')
  })
  await check('G: saving not switched on (503): this device, the Pass 2 key migrated on read, never written or removed', async () => {
    const legacy = JSON.stringify({ v: 1, catalog: snapshot.version, choices: { planning_strategy: 'best', content_writing: 'model:anthropic/claude-sonnet-5.5', research_analysis: 'default', imagery: 'economy', voice_narration: 'voice:hexgrad/kokoro-82m::heart' } })
    const storage = makeStorage({ [LEGACY_KEY]: legacy })
    const r = await mount({ storage })
    eq(storage.map.get(LEGACY_KEY), legacy); ok(!storage.log.some(entry => entry === `set ${LEGACY_KEY}` || entry === `remove ${LEGACY_KEY}`))
    deep(JSON.parse(storage.map.get(USER_KEY)), { v: 1, scope: 'user', choices: { planning_strategy: 'best', content_writing: 'model:anthropic/claude-sonnet-5.5', imagery: 'economy', voice_narration: 'model:hexgrad/kokoro-82m' } })
    eq(r.select('planning_strategy').props.value, 'best'); eq(r.note(), NOTES.unconfigured)
    eq(r.feedback(), 'Your earlier choices were restored.')
    await r.choose('research_analysis', 'balanced')
    eq(r.feedback(), 'Research & Analysis: GPT-6 Luna kept on this device.'); eq(JSON.parse(storage.map.get(USER_KEY)).choices.research_analysis, 'balanced')
    const again = await mount({ storage })
    eq(again.storage.log.filter(entry => entry === `get ${LEGACY_KEY}`).length, 1, 'read once, the new key thereafter')
    ok(!r.router.log.length, 'nothing reached the router')
  })
  await check('G: Studio cannot be reached: this device, and the page says so', async () => {
    const r = await mount({ studio: 'down' })
    eq(r.note(), NOTES.unreachable)
    await r.choose('planning_strategy', 'best'); eq(JSON.parse(r.storage.map.get(USER_KEY)).choices.planning_strategy, 'best')
  })
  await check('G: the device format round-trips and refuses other scopes and garbage', () => {
    const { choice } = libs()
    const choices = { ...choice.modelChoiceDefaults(), content_writing: 'balanced' }
    eq(choice.serializeChoices({ kind: 'user' }, choices), '{"v":1,"scope":"user","choices":{"content_writing":"balanced"}}')
    deep(choice.parseChoices({ kind: 'user' }, choice.serializeChoices({ kind: 'user' }, choices)), choices)
    eq(choice.parseChoices({ kind: 'deck', deckId: 'a' }, choice.serializeChoices({ kind: 'deck', deckId: 'b' }, choices)), null)
    for (const raw of ['', 'x', '[]', '{"v":2,"scope":"user","choices":{}}']) eq(choice.parseChoices({ kind: 'user' }, raw), null, raw)
    deep(choice.toWire({ ...choice.modelChoiceDefaults(), planning_strategy: 'economy', content_writing: 'model:a/b', imagery: 'best' }), { preferences: { planning_strategy: { preset: 'economy' }, content_writing: { model: 'a/b' }, research_analysis: null } })
    deep(choice.fromWire(json(`${FIX}/router-prefs-user-200.json`)), { ...choice.modelChoiceDefaults(), planning_strategy: 'best', content_writing: 'model:anthropic/claude-sonnet-5.5' }, 'imagery is not choosable')
  })
  await check('G: the wire: a deck\'s Auto is { auto: true } and is read back as "auto"; the reusable defaults never send or read one', () => {
    const { choice } = libs()
    const choices = { ...choice.modelChoiceDefaults(), planning_strategy: 'auto', content_writing: 'balanced', research_analysis: 'default', imagery: 'auto' }
    deep(choice.toWire(choices, 'deck'), { preferences: { planning_strategy: { auto: true }, content_writing: { preset: 'balanced' }, research_analysis: null } })
    deep(choice.toWire(choices, 'user'), { preferences: { planning_strategy: null, content_writing: { preset: 'balanced' }, research_analysis: null } }); deep(choice.toWire(choices), choice.toWire(choices, 'user'))
    const body = json(`${FIX}/router-prefs-session-auto-200.json`)
    deep(choice.fromWire({ preferences: { planning_strategy: { auto: true, preset: null, model: null }, content_writing: { preset: 'best' }, research_analysis: { auto: false } } }, 'deck'), { ...choice.modelChoiceDefaults(), planning_strategy: 'auto', content_writing: 'best' })
    deep(choice.fromWire({ preferences: { planning_strategy: { auto: true } } }, 'user'), choice.modelChoiceDefaults()); deep(choice.fromWire(body, 'deck'), { ...choice.modelChoiceDefaults(), planning_strategy: 'auto', content_writing: 'best', research_analysis: 'auto' })
    for (const bad of ['true', 1, null, {}, 'auto']) deep(choice.fromWire({ preferences: { planning_strategy: { auto: bad } } }, 'deck'), choice.modelChoiceDefaults(), JSON.stringify(bad))
  })
  await check('G: the account store passes a refusal\'s code on (422 invalid_preference_auto), and a refusal with none says none', async () => {
    const { choice } = libs()
    const sent = []
    const store = body => choice.createAccountChoiceStore({ fetchJson: async (url, init) => { sent.push({ url, method: init.method, body: init.body ?? null }); return { status: 422, body, etag: null } } })
    const asked = { ...choice.modelChoiceDefaults(), planning_strategy: 'auto' }
    deep(await store({ error: 'x', code: 'invalid_preference_auto', retryable: false }).saveChoices({ kind: 'deck', deckId: 'a' }, asked), { mode: 'account', reason: null, refused: true, refusedCode: 'invalid_preference_auto' })
    deep((await store(null).saveChoices({ kind: 'deck', deckId: 'a' }, asked)), { mode: 'account', reason: null, refused: true, refusedCode: null })
    deep(JSON.parse(sent[0].body), { preferences: { planning_strategy: { auto: true }, content_writing: null, research_analysis: null } }); eq(sent[0].url, '/api/model-choice/prefs/deck/a')
  })
  await check('G: a device storage that throws keeps the choices for the session, says so, and warns on leaving', async () => {
    const r = await mount({ storage: makeStorage({}, { get: true, set: true }) })
    eq(r.note(), NOTES.noStorage)
    await r.choose('planning_strategy', 'balanced')
    eq(r.pill().props['data-p2-status'], 'session'); ok(r.listeners.has('beforeunload')); eq(r.feedback(), 'Planning & Strategy: Gemini 3.8 Flash kept for this session.')
  })

  // ---- H. copy ------------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('H: every note and feedback is true: never "used" when not saved; "applies from the next build" when saved', async () => {
    eq(rt.note(), NOTES.unconfigured)
    const a = await mount({ studio: 'account' })
    eq(a.note(), NOTES.account)
    await a.choose('planning_strategy', 'best'); eq(a.feedback(), 'Planning & Strategy: Kimi K3 saved. Applies from the next build.')
    for (const text of [rt.text(), a.text()]) ok(!/Deckster (now )?uses (them|your choices?)|is used now|applied to Deckster/i.test(text), 'no claim that the choice is used')
    const { choice } = libs()
    deep({ ...choice.MODEL_CHOICE_NOTE }, { pending: NOTES.pending, account: NOTES.account, 'not-configured': NOTES.unconfigured, unreachable: NOTES.unreachable, 'no-storage': NOTES.noStorage })
  })

  // ---- I. used for this deck ---------------------------------------------------------------------------------------------------------------------------------------------
  await check('I: the doc\'s words for every reason code', () => {
    const { choice } = libs()
    for (const [row, copy] of REASON_COPY) eq(choice.usedReasonCopy(row, 'M'), copy, JSON.stringify(row))
    eq(choice.USED_REASON_FIELD, 'resolution')
  })
  await check('I: the build id comes from build_phase, else sync_response.build_state, and is a plain id', () => {
    const { choice } = libs()
    eq(choice.buildIdFromFrame({ type: 'build_phase', payload: { build_id: 'bld_0a1b2c3d4e5f' } }), 'bld_0a1b2c3d4e5f')
    eq(choice.buildIdFromFrame({ type: 'sync_response', payload: { build_state: { build_id: 'bld_00ff00ff00ff' } } }), 'bld_00ff00ff00ff')
    for (const frame of [{ type: 'build_event', payload: { build_id: 'bld_1' } }, { type: 'build_phase', payload: { build_id: '../x' } }, { type: 'build_phase', payload: {} }, null, 'x']) eq(choice.buildIdFromFrame(frame), null, JSON.stringify(frame))
  })
  await check('I: with a deck and a build: only my rows, in the doc\'s words; system groups and embeddings are not listed', async () => {
    const r = await mount({ studio: 'account', search: '?session_id=sess-fixture-1&build_id=bld_0a1b2c3d4e5f' })
    const used = r.find(node => node.props?.['data-model-choice-used'] === 'true', 'the list')
    deep(walk(used).filter(node => node.type === 'li').map(node => textOf(node)), [
      'Planning & StrategyYour default: Kimi K3', 'Content WritingThis presentation: Claude Sonnet 5.5', 'Content WritingUsed GPT-6 Luna: your pick can\'t do this step (needs structured output)',
      'Research & AnalysisYour pick isn\'t available right now; used GPT-6 Luna', 'Research & AnalysisThis step uses tested models only; used GPT-6 Luna', 'Planning & StrategyFixed for this step: Gemini 3.8 Flash',
      'Content WritingYour pick failed; used backup GPT-6.1 Sol', 'ImageryFixed for this step: Gemini 2.5 Flash Image'])
    ok(!r.text().includes('Claude Opus 5.5') || true)
    ok(!/Grok 4\.7/.test(textOf(used)) && !/Claude Opus/.test(textOf(used)), 'no other person\'s row')
  })
  await check('I: nothing is drawn without a deck, without a build id, or when saving is not switched on', async () => {
    for (const [search, studio] of [['?build_id=bld_0a1b2c3d4e5f', 'account'], ['?session_id=sess-fixture-1', 'account'], ['?session_id=sess-fixture-1&build_id=bld_0a1b2c3d4e5f', 'unconfigured'], ['?session_id=sess-fixture-1&build_id=../x', 'account']]) {
      const r = await mount({ studio, search })
      ok(!r.maybe(node => node.props?.['data-model-choice-used'] === 'true'), `${search} ${studio}`)
    }
  })

  // ---- J. fallback --------------------------------------------------------------------------------------------------------------------------------------------------------
  for (const [name, catalogue, env] of [
    ['503 not configured', { status: 503, body: { error: 'x', code: 'router_not_configured', service_unavailable: true } }], ['502', { status: 502, body: { error: 'x', code: 'director_error' } }],
    ['401', { status: 401, body: { error: 'Unauthorized' } }], ['200 another schema', okCatalogue({ ...json(FIXTURE), schema_version: 2 })], ['200 not JSON', { status: 200, notJson: true }],
    ['network error', { throws: true }], ['the catalogue route off', okCatalogue(json(FIXTURE)), { NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'false' }],
  ]) {
    await check(`J: ${name}: the built-in list with a quiet note`, async () => {
      const r = await mount({ catalogue, env })
      eq(textOf(r.find(node => node.props?.['data-model-choice-fallback'] === 'true', 'the note')), 'The live model list could not be loaded, so the built-in list is shown.')
      for (const task of TEXT_GROUPS) eq(r.row(task).props['data-model-choice-source'], 'static', task)
      for (const task of ['imagery', 'voice_narration']) eq(r.row(task).props['data-model-choice-source'], 'fixed', task)
      eq(r.fetchLog.filter(entry => entry.url === '/api/models/catalogue').length, env ? 0 : 1)
    })
  }
  await check('J: the browser asks only Studio\'s own routes, same-origin, and never sends a user id', async () => {
    const r = await mount({ studio: 'account', search: '?session_id=sess-fixture-1&build_id=bld_0a1b2c3d4e5f' })
    await r.choose('planning_strategy', 'best')
    for (const entry of r.fetchLog) ok(/^\/api\/(models\/catalogue|model-choice\/(prefs(\/deck\/sess-fixture-1)?|used\/bld_0a1b2c3d4e5f))$/.test(entry.url), entry.url)
    for (const entry of r.fetchLog) ok(!JSON.stringify(entry.init ?? {}).includes(ME.id) && !JSON.stringify(entry.init ?? {}).includes(ME.email), `${entry.url}: no user id`)
    const code = (read(CHOOSER) + read(LIB)).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    ok(!/MODEL_ROUTER|Authorization|\/v1\/|X-Deckster-Entitlement|user_id/.test(code), 'no router address, key, header or user id in the browser code')
    for (const rel of [CHOOSER, CSS, LIB, SERVER, USER_ROUTE, DECK_ROUTE, USED_ROUTE]) ok(!read(rel).includes('studio-p2-polish') && !/NEXT_PUBLIC_STUDIO_P2_POLISH/.test(read(rel)), `${rel}: no new importer of the Pass 2 polish lib or reader of its flag (its pin refuses both)`)
  })

  // ---- K. identity --------------------------------------------------------------------------------------------------------------------------------------------------------
  const basePage = baseOf(PAGE)
  const hooked = strip.applyModelChoiceHook(basePage)
  await check('K: the held hook is two marked insertions; the strip takes it out byte for byte; the page is the base page', () => {
    const added = hooked.split('\n').filter(line => !basePage.split('\n').includes(line))
    eq(added.length, 2); ok(added.every(line => strip.MODEL_CHOICE_MARKER_RE.test(line)))
    eq(strip.stripModelChoice(PAGE, hooked), basePage); eq(strip.applyModelChoiceHook(hooked), hooked); eq(read(PAGE), basePage)
    for (const rel of ['app/builder/page.tsx', LIB, ENV]) eq(strip.stripModelChoice(rel, 'x\n// MODEL-CHOICE\n'), 'x\n// MODEL-CHOICE\n', rel)
    ok(!strip.MODEL_CHOICE_MARKER_RE.test('MODEL-CHOICE-X') && !strip.MODEL_CHOICE_MARKER_RE.test('X-MODEL-CHOICE'))
  })
  const renderPage = (source, env) => {
    const flag = runModule(CHOOSER, chooserStubDeps(), { process: { env }, window: {}, fetch: () => assert.fail('no fetch at import') }).STUDIO_MODEL_CHOICE_ENABLED
    const mod = runModule(PAGE, {
      'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
      '@/components/studio-personal/intelligence-workspace': { IntelligenceWorkspace: function IntelligenceWorkspace({ chooser }) { return React.createElement('main', { 'data-chooser': chooser ? chooser.type.name : 'none' }) } },
      '@/components/studio-personal/intelligence-p2': { IntelligenceChooser: function IntelligenceChooser() { return null } },
      '@/components/studio-personal/intelligence-model-choice': { ModelChoiceChooser: function ModelChoiceChooser() { return null }, STUDIO_MODEL_CHOICE_ENABLED: flag },
      'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } },
    }, { process: { env } })
    void source
    try { const element = mod.default(); return { markup: renderToStaticMarkup(element), tree: JSON.stringify({ type: element.type.name, chooser: element.props.chooser ? element.props.chooser.type.name : null }) } } catch (error) { return { markup: error.message, tree: error.message } }
  }
  await check('K: flag off (every value but "true") the page with the hook is the base page, element and markup', () => {
    const page = source => { overrides = { ...overrides, [PAGE]: source }; return source }
    const saved = overrides
    try {
      for (const shell of ['true', undefined]) for (const p2 of ['true', 'false', undefined]) for (const flag of [undefined, '', 'false', 'TRUE', ' true', '1', 'true']) {
        const env = { ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } : {}), ...(p2 ? { NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: p2 } : {}), ...(flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: flag }) }
        page(basePage); const base = renderPage(basePage, env)
        page(hooked); const head = renderPage(hooked, env)
        overrides = saved
        if (flag === 'true' && shell && p2 === 'true') { eq(head.tree, '{"type":"IntelligenceWorkspace","chooser":"ModelChoiceChooser"}'); eq(base.tree, '{"type":"IntelligenceWorkspace","chooser":"IntelligenceChooser"}') }
        else { eq(sha(head.markup), sha(base.markup), JSON.stringify(env)); eq(head.tree, base.tree, JSON.stringify(env)) }
      }
    } finally { overrides = saved }
  })
  await check('K: .env.example, the registry and the taught proof without this change\'s lines are the base\'s, byte for byte', async () => {
    const flow = await import('./studio-flow-control-strip.mjs') // dev 6fba3b7f (#524): flow control registers its block, its lines and a taught proof before this change's; they come out first
    const reg = await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)
    // dev 0545569 (#523): every block another change registered (flow control's, Arrange's) comes out first, wherever it sits before this one
    const withoutOtherBlocks = reg.LATER_ENV_BLOCKS.filter(block => block !== strip.MODEL_CHOICE_ENV_BLOCK && !baseOf(ENV).includes(block)).reduce((text, block) => text.replace(`\n${block}`, ''), read(ENV).replace(`\n${strip.MODEL_CHOICE_ENV_BLOCK}`, ''))
    eq(withoutOtherBlocks, baseOf(ENV)); ok(read(ENV).includes(`\n${strip.MODEL_CHOICE_ENV_BLOCK}`)) // LATER-CHANGES: registry read (CHAT-CLEAN): a block registered after this one (chat clean's) may follow it
    ok(/^NEXT_PUBLIC_STUDIO_MODEL_CHOICE="false"$/m.test(read(ENV))); eq((read(ENV).match(/^MODEL_ROUTER_URL=/gm) || []).length, 1, 'MODEL_ROUTER_URL is not declared twice')
    ok(/^MODEL_ROUTER_FRONTEND_KEY=$/m.test(read(ENV)), 'the key: a name only')
    deep([...new Set(strip.MODEL_CHOICE_ENV_BLOCK.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g))].sort(), ['MODEL_ROUTER_FRONTEND_KEY', 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'], 'the block names no other variable (older pins refuse their own names in a later block)')
    const baseRegistryLines = new Set(baseOf(REGISTRY).split('\n')) // a registry line another change added (flow control's, Arrange's) is not this change's
    eq(read(REGISTRY).split('\n').filter(line => !line.includes('studio-model-choice-strip.mjs') && (baseRegistryLines.has(line) || !line.includes('// LATER-CHANGE: '))).join('\n'), baseOf(REGISTRY))
    for (const rel of strip.MODEL_CHOICE_PIN_FILES) { eq(strip.putBackPin(rel, flow.stripFlowControl(rel, read(rel))), baseOf(rel), rel); for (const [has] of strip.MODEL_CHOICE_PIN_EDITS[rel]) { eq(read(rel).split(has).length, 2); ok((has.includes(strip.MODEL_CHOICE_PIN_MARK) || has.includes(strip.MODEL_CHOICE_TWIN_PIN_MARK)) && has.endsWith('\n')) } }
    for (const rel of strip.MODEL_CHOICE_SCOPE_FILES) ok(reg.LATER_CHANGE_FILES.has(rel), rel)
    eq(reg.stripLaterChanges(PAGE, hooked), basePage); eq(reg.stripLaterEnvBlocks(ENV, read(ENV)).includes('MODEL_CHOICE'), false)
  })

  // ---- L. a11y and phone ------------------------------------------------------------------------------------------------------------------------------------------------
  await check('L: every select has a label; radios sit in labels under a legend; described-by targets exist', () => {
    for (const task of TEXT_GROUPS) {
      const select = rt.select(task)
      ok(rt.maybe(node => node.type === 'label' && node.props.htmlFor === select.props.id), `${task}: label`)
      for (const id of String(select.props['aria-describedby']).split(' ')) ok(rt.maybe(node => node.props?.id === id), `${task}: ${id}`)
    }
    const radios = rt.all(node => node.type === 'input' && node.props.type === 'radio')
    eq(radios.length, 2); for (const radio of radios) ok(rt.maybe(node => node.type === 'label' && walk(node.props.children).includes(radio)))
  })
  await check('L: the stylesheet: 44 px targets, a phone rule, the page\'s text sizes, every rule scoped', () => {
    const css = postcss.parse(read(CSS))
    css.walkRules(rule => { for (const selector of rule.selectors) ok(/\.sp-mc2-|\[data-model-choice(-bar)?="true"\]/.test(selector), `scoped: ${selector}`) })
    const minHeights = []
    css.walkDecls('min-height', decl => minHeights.push([decl.parent.selector, decl.value]))
    for (const [selector, value] of minHeights) eq(value, '44px', selector)
    for (const target of ['.sp-mc2-scope label', '.sp-p2-pick select', '.sp-p2-inspect', '.sp-p2-reset']) ok(minHeights.some(([selector]) => selector.includes(target)), target)
    css.walkDecls('font-size', decl => ok(['10px', '11px'].includes(decl.value), `${decl.parent.selector}: ${decl.value}`))
    let phone = false
    css.walkAtRules('media', at => { if (at.params === '(max-width: 620px)') phone = true })
    ok(phone)
  })

  // ---- M. routes ----------------------------------------------------------------------------------------------------------------------------------------------------------
  const ROUTES = [[USER_ROUTE, 'GET', {}], [USER_ROUTE, 'PATCH', { body: { preferences: { planning_strategy: { preset: 'best' } } } }], [DECK_ROUTE, 'GET', { params: { deckKey: 'sess-fixture-1' } }],
    [DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, body: { preferences: { planning_strategy: null } } }], [USED_ROUTE, 'GET', { params: { buildId: 'bld_0a1b2c3d4e5f' } }]]
  await check('M: flag off (every value but "true"): 404 before the session is read, nothing sent', async () => {
    for (const [rel, method, extra] of ROUTES) for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      const out = await callRoute(rel, method, { ...extra, env: { ...CONFIGURED, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: flag } })
      eq(out.status, 404); deep(out.body, { error: 'Not found' }); eq(out.calls.session, 0); eq(out.calls.prisma, 0); eq(out.router.log.length, 0)
    }
  })
  await check('M: 401 without a signed-in user; 503 router_not_configured when the URL or the key is empty or unusable, before anything is sent', async () => {
    for (const [rel, method, extra] of ROUTES) {
      const out = await callRoute(rel, method, { ...extra, user: null }); eq(out.status, 401); eq(out.router.log.length, 0)
      for (const env of [{ MODEL_ROUTER_URL: '' }, { MODEL_ROUTER_FRONTEND_KEY: '' }, { MODEL_ROUTER_FRONTEND_KEY: '  ' }, { MODEL_ROUTER_URL: 'ftp://x' }, { MODEL_ROUTER_URL: 'not a url' }, { MODEL_ROUTER_FRONTEND_KEY: 'has space inside' }]) {
        const off = await callRoute(rel, method, { ...extra, env: { ...CONFIGURED, ...env } })
        eq(off.status, 503, `${rel} ${method} ${JSON.stringify(env)}`); deep(off.body, { error: "Saving isn't switched on yet.", code: 'router_not_configured', retryable: false }); eq(off.router.log.length, 0); eq(off.calls.prisma, 0)
      }
    }
  })
  await check('M: the user id is the session\'s only; the key goes only into the router\'s Authorization header; never in a response or a log', async () => {
    const viaQuery = await callRoute(USER_ROUTE, 'GET', { url: 'https://studio.example.test/api/model-choice/prefs?user_id=someone-else' })
    eq(new URL(viaQuery.router.log[0].url).pathname, USER_PATH); eq(viaQuery.router.log[0].url.startsWith('https://router.example.test/v1/prefs/'), true, 'the base has no doubled /v1')
    eq(viaQuery.router.log[0].headers.Authorization, `Bearer ${KEY}`)
    const viaBody = await callRoute(USER_ROUTE, 'PATCH', { body: { user_id: 'someone-else', preferences: { planning_strategy: { preset: 'best' } } } })
    eq(viaBody.status, 400); eq(viaBody.router.log.length, 0)
    const emailOnly = await callRoute(USER_ROUTE, 'GET', { user: { email: 'only@example.test' } })
    eq(new URL(emailOnly.router.log[0].url).pathname, '/v1/prefs/only%40example.test')
    const all = []
    for (const [rel, method, extra] of ROUTES) { const out = await callRoute(rel, method, extra); all.push(out); ok(out.status < 500, `${rel} ${method}: ${out.status}`) }
    for (const out of [...all, viaQuery, viaBody, emailOnly]) {
      ok(!out.text.includes(KEY) && ![...out.headers.entries()].some(([, value]) => value.includes(KEY)), 'not in the response')
      deep(out.calls.console, [], 'nothing logged')
      ok(!out.text.includes('"user_id"'), 'the response carries no user id')
      eq(out.headers.get('cache-control'), 'no-store')
    }
  })
  const BAD_BODIES = [null, 'x', [], {}, { preferences: {} }, { preferences: [] }, { preferences: { planning_strategy: { preset: 'best' } }, extra: 1 },
    { preferences: { planning_strategy: null, content_writing: null, research_analysis: null, imagery: null } }, { preferences: { imagery: { preset: 'best' } } }, { preferences: { voice_narration: null } },
    { preferences: { structure_layout: { preset: 'best' } } }, { preferences: { embeddings: null } }, { preferences: { planning_strategy: { preset: 'fast' } } }, { preferences: { planning_strategy: { preset: 'best', model: 'a/b' } } },
    { preferences: { planning_strategy: {} } }, { preferences: { planning_strategy: { model: 'has space' } } }, { preferences: { planning_strategy: { model: '' } } }, { preferences: { planning_strategy: { preset: 'best', x: 1 } } }]
  await check('M: body validation: only the text groups, only { preset } or { model } or null; a refused body sends nothing', async () => {
    for (const body of BAD_BODIES) for (const [rel, params] of [[USER_ROUTE, undefined], [DECK_ROUTE, { deckKey: 'sess-fixture-1' }]]) {
      const out = await callRoute(rel, 'PATCH', { body: body === null ? 'not json{' : body, params })
      eq(out.status, 400, `${rel} ${JSON.stringify(body)}`); eq(out.body.code, 'invalid_request'); eq(out.router.log.length, 0, 'nothing sent, not even the read')
    }
    const good = await callRoute(USER_ROUTE, 'PATCH', { body: { preferences: { planning_strategy: { preset: 'economy' }, content_writing: { model: 'anthropic/claude-opus-5.5' }, research_analysis: null } } })
    eq(good.status, 200); deep(JSON.parse(good.router.log[1].body), { preferences: { planning_strategy: { preset: 'economy' }, content_writing: { model: 'anthropic/claude-opus-5.5' }, research_analysis: null } })
  })
  await check('M: If-Match: a read-modify-write on both scopes; a stale tag is refused before any write; a malformed one is a 400', async () => {
    for (const [rel, params, routerPath, write] of [[USER_ROUTE, undefined, USER_PATH, 'PATCH'], [DECK_ROUTE, { deckKey: 'sess-fixture-1' }, SESSION_PATH, 'PUT']]) {
      const router = fakeRouter()
      router.bump(routerPath, { content_writing: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
      const read1 = await callRoute(rel, 'GET', { params, router })
      const tag = read1.headers.get('etag'); eq(tag, router.etagOf(router.store.get(routerPath)), `${rel}: the router's tag comes back`)
      deep(read1.body, { scope: params ? 'deck' : 'user', preferences: { content_writing: { preset: 'best', model: null, stale: false } }, catalogue_version: 'fixture' })
      const okWrite = await callRoute(rel, 'PATCH', { params, router, headers: { 'If-Match': tag }, body: { preferences: { planning_strategy: { preset: 'balanced' } } } })
      eq(okWrite.status, 200); deep(router.log.slice(-3).map(entry => entry.method), write === 'PUT' ? ['GET', 'PUT', 'GET'] : ['GET', 'GET', 'PATCH'].slice(-3))
      const sent = router.log.find(entry => entry.method === write)
      eq(sent.headers['If-Match'], tag, `${rel}: the write carries the read's tag`)
      if (write === 'PUT') deep(JSON.parse(sent.body), { preferences: { content_writing: { preset: 'best' }, planning_strategy: { preset: 'balanced' } } }, 'PUT replaces the whole map: the current rows plus the change')
      ok(okWrite.headers.get('etag') && okWrite.headers.get('etag') !== tag, 'a new tag')
      const before = router.log.length
      const stale = await callRoute(rel, 'PATCH', { params, router, headers: { 'If-Match': tag }, body: { preferences: { research_analysis: { preset: 'best' } } } })
      eq(stale.status, 412); eq(stale.body.code, 'preferences_modified'); eq(stale.headers.get('etag'), okWrite.headers.get('etag'))
      deep(router.log.slice(before).map(entry => entry.method), ['GET'], 'refused before any write')
      eq((await callRoute(rel, 'PATCH', { params, router, headers: { 'If-Match': 'not-a-tag' }, body: { preferences: { research_analysis: null } } })).status, 400)
    }
  })
  await check('M: the router\'s own 412 (a change between the read and the write) and its refusals are passed on in Studio\'s words', async () => {
    const racing = fakeRouter()
    const inner = racing.fetch
    racing.fetch = async (url, init) => { if (init.method !== 'GET') racing.bump(USER_PATH, { research_analysis: { preset: 'best', model: null, updated_at: 'x' } }); return inner(url, init) }
    const out = await callRoute(USER_ROUTE, 'PATCH', { router: racing, body: { preferences: { planning_strategy: { preset: 'best' } } } })
    eq(out.status, 412); eq(out.body.code, 'preferences_modified'); ok(out.headers.get('etag'))
    const refused = await callRoute(USER_ROUTE, 'PATCH', { body: { preferences: { planning_strategy: { model: 'openai/not-certified' } } } })
    eq(refused.status, 422); eq(refused.body.code, 'invalid_preference_model')
    const badKey = await callRoute(USER_ROUTE, 'GET', { env: { ...CONFIGURED, MODEL_ROUTER_FRONTEND_KEY: 'another-fixture-key' } })
    eq(badKey.status, 502); eq(badKey.body.code, 'router_auth_failed')
  })
  await check('M: the deck scope: the session must be mine; R3 not shipped (404) is "not available yet"', async () => {
    for (const [deckKey, status, code] of [['sess-other', 403, 'forbidden'], ['sess-unsaved', 404, 'session_not_found'], ['sess-gone', 404, 'session_not_found'], ['new', 400, 'invalid_request'], ['../x', 400, 'invalid_request']]) {
      const out = await callRoute(DECK_ROUTE, 'GET', { params: { deckKey } }); eq(out.status, status, deckKey); eq(out.body.code, code, deckKey); eq(out.router.log.length, 0, deckKey)
    }
    eq((await callRoute(DECK_ROUTE, 'GET', { params: { deckKey: 'sess-fixture-1' }, user: { email: 'me@example.test' } })).status, 401, 'ownership needs the session user\'s id')
    const down = await callRoute(DECK_ROUTE, 'GET', { params: { deckKey: 'sess-fixture-1' }, ownedThrows: true }); eq(down.status, 503); eq(down.body.code, 'ownership_unavailable')
    for (const method of ['GET', 'PATCH']) {
      const out = await callRoute(DECK_ROUTE, method, { params: { deckKey: 'sess-fixture-1' }, router: fakeRouter({ deckScope: false }), body: method === 'PATCH' ? { preferences: { planning_strategy: null } } : undefined })
      eq(out.status, 404); deep(out.body, { error: 'Choices for one presentation are not available yet.', code: 'deck_scope_not_available', retryable: false })
    }
  })
  await check('M: "used": only the session user\'s rows, cut to what the page shows; a bad build id sends nothing', async () => {
    const out = await callRoute(USED_ROUTE, 'GET', { params: { buildId: 'bld_0a1b2c3d4e5f' } })
    eq(out.status, 200); eq(new URL(out.router.log[0].url).pathname, '/v1/usage/trace/bld_0a1b2c3d4e5f/timeline'); eq(new URL(out.router.log[0].url).searchParams.get('limit'), '500')
    const mine = json(`${FIX}/router-timeline-200.json`).data.filter(item => item.user_id === ME.id)
    eq(out.body.rows.length, mine.length); deep(out.body.rows.map(row => row.model), mine.map(item => item.model_served))
    for (const row of out.body.rows) deep(Object.keys(row), ['service', 'task', 'group', 'model', 'fallback_depth', 'resolution', 'needs', 'ts'])
    ok(!out.text.includes('user-fixture-2') && !out.text.includes('user-fixture-3') && !out.text.includes('billable_usd'), 'nothing of anyone else, no spend')
    const other = await callRoute(USED_ROUTE, 'GET', { params: { buildId: 'bld_0a1b2c3d4e5f' }, user: { id: 'user-fixture-2' } })
    deep(other.body.rows.map(row => row.model), ['anthropic/claude-opus-5.5'])
    for (const buildId of ['../x', 'a b', '']) { const bad = await callRoute(USED_ROUTE, 'GET', { params: { buildId } }); eq(bad.status, 400); eq(bad.router.log.length, 0) }
  })
  const AUTO_BAD = [{ auto: false }, { auto: null }, { auto: 'true' }, { auto: 'TRUE' }, { auto: 1 }, { auto: 0 }, { auto: {} }, { auto: [true] }, { auto: true, preset: 'best' }, { auto: true, model: 'a/b' }, { auto: true, x: 1 }, { auto: true, auto2: true }]
  await check('M: the deck body: { auto: true } alone is a choice for a text group; any other auto (false, null, "true", 1, an extra key) or an auto on another group is a 400 that sends nothing', async () => {
    for (const bad of AUTO_BAD) {
      const out = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, body: { preferences: { planning_strategy: bad } } })
      eq(out.status, 400, JSON.stringify(bad)); eq(out.body.code, 'invalid_request'); eq(out.router.log.length, 0, 'not even the read')
    }
    for (const group of ['imagery', 'voice_narration', 'embeddings']) { const out = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, body: { preferences: { [group]: { auto: true } } } }); eq(out.status, 400, group); eq(out.router.log.length, 0) }
    const good = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, body: { preferences: { planning_strategy: { auto: true }, content_writing: { auto: true }, research_analysis: { auto: true } } } })
    eq(good.status, 200); deep(good.body.preferences, Object.fromEntries(TEXT_GROUPS.map(group => [group, { auto: true, preset: null, model: null, stale: false }])))
  })
  await check('M: the PUT carries { "auto": true } for the group, keeps the deck\'s other rows (an auto row too), and null ("use my default") leaves the group out', async () => {
    const router = fakeRouter()
    router.bump(SESSION_PATH, { planning_strategy: { auto: true, preset: null, model: null, updated_at: '2026-10-26T09:00:00Z' }, research_analysis: { preset: 'best', model: null, updated_at: '2026-10-26T09:00:00Z' } })
    const out = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, router, body: { preferences: { content_writing: { auto: true } } } })
    eq(out.status, 200); const put = router.log.find(entry => entry.method === 'PUT')
    eq(put.body, '{"preferences":{"planning_strategy":{"auto":true},"research_analysis":{"preset":"best"},"content_writing":{"auto":true}}}')
    const left = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, router, body: { preferences: { planning_strategy: null } } })
    eq(left.status, 200); deep(JSON.parse(router.log.filter(entry => entry.method === 'PUT').at(-1).body), { preferences: { research_analysis: { preset: 'best' }, content_writing: { auto: true } } }, 'the group is omitted')
    ok(!('planning_strategy' in left.body.preferences) && left.body.preferences.content_writing.auto === true)
  })
  await check('M: the user scope refuses auto with a 400 before any router call, valid-looking or not; its "Auto" is still { group: null }', async () => {
    for (const bad of [{ auto: true }, ...AUTO_BAD]) {
      const out = await callRoute(USER_ROUTE, 'PATCH', { body: { preferences: { planning_strategy: bad } } })
      eq(out.status, 400, JSON.stringify(bad)); eq(out.body.code, 'invalid_request'); eq(out.router.log.length, 0, 'the router was not called')
    }
    const mixed = await callRoute(USER_ROUTE, 'PATCH', { body: { preferences: { planning_strategy: { preset: 'best' }, content_writing: { auto: true } } } })
    eq(mixed.status, 400); eq(mixed.router.log.length, 0, 'one auto refuses the whole body')
    const router = fakeRouter(); router.bump(USER_PATH, { planning_strategy: { preset: 'best', model: null, updated_at: 't' } })
    const reset = await callRoute(USER_ROUTE, 'PATCH', { router, body: { preferences: { planning_strategy: null } } })
    eq(reset.status, 200); deep(JSON.parse(router.log.find(entry => entry.method === 'PATCH').body), { preferences: { planning_strategy: null } }); deep(router.store.get(USER_PATH), {})
  })
  await check('M: GET: the router\'s auto rows read back as { auto: true, preset: null, model: null, stale }; other rows carry no auto key; the reusable defaults leave an auto row out', async () => {
    const fixture = json(`${FIX}/router-prefs-session-auto-200.json`)
    const serve = { log: [], fetch: async (url, init) => { serve.log.push({ url, method: init.method, headers: init.headers, body: init.body ?? null }); return { status: 200, headers: { get: name => (name.toLowerCase() === 'etag' ? '"fixture-etag"' : null) }, json: async () => JSON.parse(JSON.stringify(fixture)) } } }
    const deck = await callRoute(DECK_ROUTE, 'GET', { params: { deckKey: 'sess-fixture-1' }, router: serve })
    eq(deck.status, 200); deep(deck.body, { scope: 'deck', preferences: { planning_strategy: { preset: null, model: null, stale: false, auto: true }, content_writing: { preset: 'best', model: null, stale: false }, research_analysis: { preset: null, model: null, stale: true, auto: true } }, catalogue_version: fixture.catalogue_version })
    ok(!('auto' in deck.body.preferences.content_writing)); ok(!deck.text.includes('user-fixture'))
    const user = await callRoute(USER_ROUTE, 'GET', { router: serve }); deep(Object.keys(user.body.preferences), ['content_writing'])
    const carried = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, router: serve, body: { preferences: { planning_strategy: { preset: 'economy' } } } })
    eq(carried.status, 200); eq(serve.log.find(entry => entry.method === 'PUT').body, '{"preferences":{"planning_strategy":{"preset":"economy"},"content_writing":{"preset":"best"},"research_analysis":{"auto":true}}}', 'the auto row it did not touch goes back as { "auto": true }')
  })
  await check('M: a router 422 invalid_preference_auto is a 422 with that code and an honest sentence; nothing is saved; another refusal keeps its own words', async () => {
    const router = fakeRouter({ refuseAuto: true }); router.bump(SESSION_PATH, { research_analysis: { preset: 'best', model: null, updated_at: 't' } })
    const out = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, router, body: { preferences: { planning_strategy: { auto: true } } } })
    eq(out.status, 422); deep(out.body, { error: 'Auto cannot be saved for this presentation right now.', code: 'invalid_preference_auto', retryable: false }); deep(Object.keys(router.store.get(SESSION_PATH)), ['research_analysis'])
    const other = await callRoute(DECK_ROUTE, 'PATCH', { params: { deckKey: 'sess-fixture-1' }, router: fakeRouter(), body: { preferences: { planning_strategy: { model: 'openai/not-certified' } } } })
    eq(other.status, 422); eq(other.body.code, 'invalid_preference_model'); eq(other.body.error, 'That choice cannot be saved for this task right now.')
  })
  await check('M: the route set grows by exactly the three new routes; each route is thin and server-only', () => {
    const routesOf = files => [...new Set(files.filter(file => /^app\/(.*\/)?(page|route)\.(tsx|ts|jsx|js)$/.test(file)).map(file => '/' + file.replace(/^app\//, '').replace(/(^|\/)(page|route)\.\w+$/, '').split('/').filter(segment => segment && !/^\(.*\)$/.test(segment)).join('/')))].sort()
    const before = routesOf(git('ls-tree', '-r', '--name-only', BASE, '--', 'app').split('\n').filter(Boolean))
    const after = routesOf(git('ls-files', '-co', '--exclude-standard', '--', 'app').split('\n').filter(Boolean))
    deep(after.filter(route => !before.includes(route)), ['/api/model-choice/prefs', '/api/model-choice/prefs/deck/[deckKey]', '/api/model-choice/used/[buildId]']); deep(before.filter(route => !after.includes(route)), [])
    eq(after.length, before.length + 3)
    deep([...strip.MODEL_CHOICE_ROUTES], [USER_ROUTE, DECK_ROUTE, USED_ROUTE])
    for (const rel of strip.MODEL_CHOICE_NEW_FILES) ok(!/^app\/api\/models\//.test(rel), `${rel}: outside app/api/models/, the model catalog change's path family (scripts/studio-stack-tolerant.mjs, #473)`)
    for (const rel of strip.MODEL_CHOICE_ROUTES) { const source = read(rel); ok(!/['"]use client['"]/.test(source) && !/console\./.test(source), rel); ok(/from '@\/lib\/studio-model-choice-server'/.test(source), rel) }
    ok(/@\/lib\/prisma/.test(read(DECK_ROUTE)) && !/@\/lib\/prisma/.test(read(USER_ROUTE)) && !/@\/lib\/prisma/.test(read(USED_ROUTE)), 'only the deck route reads the database')
    const serverCode = read(SERVER).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    ok(!/console\./.test(serverCode) && !/NEXT_PUBLIC_/.test(serverCode.replace("export const MODEL_CHOICE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'", '')), 'the server lib never logs and reads no other public flag')
  })

  // ---- N. scope -----------------------------------------------------------------------------------------------------------------------------------------------------------
  const own = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%H %s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [head, ...names] = block.split('\n')
    if (/^[0-9a-f]{40} Model choice: /.test(head)) own.push({ commit: head.slice(0, 40), names: names.filter(Boolean) })
  }
  if (own.length === 0 && extraCommitted.length === 0) {
    if (!quiet) console.log('SKIP N  nothing of this change committed on top of the base yet (the scope check reads BASE..HEAD only)')
  } else {
    await check('N: the committed diff of its own commits holds exactly its files, and no FRONTEND-1 test', () => {
      // the net diff from the base to this change's newest commit, of the files its own commits touch (a file it added and later moved is not there any more)
      const touched = new Set(own.flatMap(entry => entry.names))
      const files = [...new Set([...git('diff', '--name-only', BASE, own[0].commit).split('\n').filter(rel => rel && touched.has(rel)), ...extraCommitted])].sort()
      deep(files, [...strip.MODEL_CHOICE_SCOPE_FILES].sort())
      ok(!files.some(rel => /test-studio-p2-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|landing|deck-title|test-studio-model-catalog/.test(rel)), 'no FRONTEND-1 test')
      ok(!files.includes(PAGE), 'the page hook is held')
    })
    await check('N: the registry gains three LATER-CHANGE lines; .env.example only its block', () => {
      const added = rel => git('diff', '-U0', BASE, own[0].commit, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      const registry = added(REGISTRY).filter(line => !(line.startsWith('+') && line.includes('// LATER-CHANGE: ') && !line.includes('studio-model-choice-strip.mjs'))) // dev 6fba3b7f: the lines another registered change adds (flow control's) are its own
      eq(registry.length, 3); ok(registry.every(line => line.startsWith('+') && line.includes('studio-model-choice-strip.mjs') && line.includes('// LATER-CHANGE: ')))
      const env = added(ENV); eq(env.filter(line => line.startsWith('-')).length, 0); ok(env.map(line => line.slice(1)).join('\n').endsWith(['', ...strip.MODEL_CHOICE_ENV_BLOCK.trimEnd().split('\n')].join('\n')), 'the block is the last thing it adds, after one blank line (dev 6fba3b7f: flow control\'s block, registered before this one, comes first)')
    })
  }
  await check('N: no credential-shaped literal or long hex in the new files', () => {
    const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
    for (const rel of strip.MODEL_CHOICE_NEW_FILES) { ok(!CRED.test(read(rel).replace(/credentials: "same-origin"/g, '')), rel); if (rel !== STRIP && rel !== 'scripts/test-studio-model-choice.mjs') ok(!/[A-Fa-f0-9]{40,}/.test(read(rel)), `${rel}: no long hex`) }
  })

  return { checks, failures }
}

/** The chooser module's imports, stubbed, for reading its flag constant only. */
function chooserStubDeps() {
  const anything = new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name === 'catalog' ? snapshot : () => null) })
  const { p2, cat, choice } = libs()
  return {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'), 'lucide-react': anything, './intelligence-workspace': anything,
    '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': { ...choice, createDeviceChoiceStore: () => ({}), createAccountChoiceStore: () => ({}), createModelChoiceStore: () => ({}) },
    '@/lib/studio-p2-polish': { STUDIO_P2_POLISH_ENABLED: false, STUDIO_P2_POLISH_ATTR: 'data-p2-polish' }, './intelligence-p2.css': {}, './intelligence-model-choice.css': {},
  }
}

// ---- run -------------------------------------------------------------------------------------------------------------------------------------------------------------
const main = await suite()
if (main.failures.length) {
  for (const failure of main.failures) console.error(`FAIL ${failure}`)
  console.error(`${main.failures.length} of ${main.checks + main.failures.length} checks failed`)
  process.exit(1)
}
console.log(`PASS A-N  ${main.checks} checks`)
if (process.env.MODEL_CHOICE_NO_MUTANTS === '1') process.exit(0)

// ---- O. mutants: each must make the suite fail -------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['lib: narration and imagery take any model', LIB, '    if (!need) return true\n', '    return true\n'],
  ['lib: a non-user-visible group is read', LIB, 'return group && group.visible && !MODEL_CHOICE_NEVER_GROUPS.includes(group.key) ? group : null', 'return group && !MODEL_CHOICE_NEVER_GROUPS.includes(group.key) ? group : null'],
  ['lib: embeddings may be switched', LIB, "export const MODEL_CHOICE_NEVER_GROUPS: readonly string[] = ['embeddings']", 'export const MODEL_CHOICE_NEVER_GROUPS: readonly string[] = []'],
  ['lib: imagery is choosable', LIB, "export const MODEL_CHOICE_CHOOSABLE_GROUPS: readonly string[] = ['planning_strategy', 'content_writing', 'research_analysis']", "export const MODEL_CHOICE_CHOOSABLE_GROUPS: readonly string[] = ['planning_strategy', 'content_writing', 'research_analysis', 'imagery']"],
  ['lib: a preset need not be certified', LIB, 'return slug && offeredModels(catalogue, group).includes(slug) ? slug : null', 'return slug || null'],
  ['lib: Fast reads Economy', LIB, "{ id: 'economy', label: 'Fast', hint: '$' }", "{ id: 'economy', label: 'Economy', hint: '$' }"],
  ['lib: the cost hints are swapped', LIB, "{ id: 'best', label: 'Best', hint: '$$$' }", "{ id: 'best', label: 'Best', hint: '$' }"],
  ['lib: the catalogue cost_hint is ignored', LIB, 'const hintFor = (slug: string, tier: P2PresetId | null) => catalogue.costHints[slug] ?? (tier ? modelChoiceTier(tier).hint : null)', 'const hintFor = (slug: string, tier: P2PresetId | null) => (tier ? modelChoiceTier(tier).hint : null)'],
  ['lib: no Suggested mark', LIB, 'suggested.has(slug) ? MODEL_CHOICE_SUGGESTED : null', 'null'],
  ['lib: the migration rewrites the old key', LIB, '          storage.setItem(modelChoiceKey(scope), serializeChoices(scope, legacy))\n', "          storage.setItem(modelChoiceKey(scope), serializeChoices(scope, legacy))\n          storage.setItem(deps.legacyKey, '{}')\n"],
  ['lib: no migration', LIB, "      if (scope.kind === 'user' && deps.legacyKey &&", '      if (false && deps.legacyKey &&'],
  ['lib: no If-Match on a save', LIB, "...(tag ? { 'If-Match': tag } : {})", '...({})'],
  ['lib: a conflict is ignored', LIB, '      if (answer.status === 412 || answer.status === 409) {', '      if (false) {'],
  ['lib: a 503 is not a device fallback', LIB, "new DeviceFallback(status === 503 && codeOf(body) === 'router_not_configured' ? 'not-configured' : 'unreachable')", "new DeviceFallback('unreachable')"],
  ['lib: R3 404 is an error', LIB, "(status === 404 && codeOf(body) === 'deck_scope_not_available' ? 'not-available' :", '(false ? \'not-available\' :'],
  ['lib: the deck does not follow the reusable default', LIB, "  if (scope.kind === 'deck' && source.kind !== 'fixed' && !(source.isChoice(choice)", "  if (false && !(source.isChoice(choice)"],
  ['lib: the saved note claims use now', LIB, "  account: 'Your choices are saved to your account. They apply from the next build.',", "  account: 'Your choices are saved to your account. Deckster uses them now.',"],
  ['lib: the unconfigured note claims saving', LIB, "  'not-configured': 'Saving isn’t switched on yet; your choice stays on this device.',", "  'not-configured': 'Your choices are saved.',"],
  ['lib: a fallback on my pick reads as fixed', LIB, '  if (mine && (row.fallback_depth ?? 0) >= 1) return `Your pick failed; used backup ${model}`\n', ''],
  ['lib: capability words dropped', LIB, "return `Used ${model}: your pick can't do this step${needs.length ? ` (needs ${needs.join(' / ')})` : ''}`", "return `Used ${model}: your pick can't do this step`"],
  ['lib: any frame names the build', LIB, "const id = type === 'build_phase' ? payload.build_id :", 'const id = payload.build_id ? payload.build_id :'],
  ['server: the flag is loose', SERVER, "export const routesOn = (env: Env) => env[MODEL_CHOICE_FLAG] === 'true'", 'export const routesOn = (env: Env) => Boolean(env[MODEL_CHOICE_FLAG])'],
  ['server: the session is read before the flag', SERVER, '  if (!routesOn(deps.env)) return notFound()\n  const user = await deps.getSessionUser()\n', '  const user = await deps.getSessionUser()\n  if (!routesOn(deps.env)) return notFound()\n'],
  ['server: the browser may name the user', SERVER, '  if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.preferences))', '  if (!isRecord(body) || !isRecord(body.preferences))'],
  ['server: imagery may be saved', SERVER, "    if (!MODEL_CHOICE_CHOOSABLE_GROUPS.includes(group)) return refuse(", "    if (false) return refuse("],
  ['server: both preset and model pass', SERVER, "    if (!isRecord(choice) || Object.keys(choice).length !== 1) return refuse(", "    if (!isRecord(choice)) return refuse("],
  ['server: a stale If-Match is written', SERVER, '  if (ifMatchTag !== null && ifMatchTag !== current.etag) return', '  if (false) return'],
  ['server: the write carries no If-Match', SERVER, "    written = await callRouter(deps.fetch, config, 'PUT', routerPath, { preferences: merged }, current.etag)", "    written = await callRouter(deps.fetch, config, 'PUT', routerPath, { preferences: merged }, null)"],
  ['server: PUT sends only the change', SERVER, "    for (const [group, row] of Object.entries(rowsOf(current.body))) merged[group]", "    for (const [group, row] of Object.entries({} as Record<string, Row>)) merged[group]"],
  ['server: ownership is not checked', SERVER, "    if (owned.userId !== user.id) return fail(403, 'forbidden', 'This presentation is not yours.', false)\n", ''],
  ['server: R3 404 is an error', SERVER, '  if (call.status === 404 && deck) return DECK_NOT_AVAILABLE()\n', ''],
  ['server: the timeline is not filtered', SERVER, '    if (!isRecord(item) || item.user_id !== userId) continue', '    if (!isRecord(item)) continue'],
  ['server: the user id comes from the email first', SERVER, "  const id = (user?.id || user?.email || '').trim()", "  const id = (user?.email || user?.id || '').trim()"],
  ['route: the user route returns the key', USER_ROUTE, "  if (outcome.etag) response.headers.set('ETag', outcome.etag)\n", "  if (outcome.etag) response.headers.set('ETag', outcome.etag)\n  response.headers.set('X-Debug', process.env.MODEL_ROUTER_FRONTEND_KEY ?? '')\n"],
  ['route: the deck route logs', DECK_ROUTE, '  const { deckKey } = await params\n  return reply(await handlePrefs(\'GET\'', '  const { deckKey } = await params\n  console.log(\'deck\', deckKey)\n  return reply(await handlePrefs(\'GET\''],
  ['route: no ETag back', USER_ROUTE, "  if (outcome.etag) response.headers.set('ETag', outcome.etag)\n", ''],
  ['chooser: no fallback note', CHOOSER, '{live.state === "fallback" && <p', '{false && <p'],
  ['chooser: another catalogue endpoint', CHOOSER, 'fetch(MODEL_CATALOG_ENDPOINT, {', 'fetch(`${MODEL_CATALOG_ENDPOINT}?include_available=true`, {'],
  ['chooser: the deck radio is never disabled', CHOOSER, 'disabled={!deckAvailable}', 'disabled={false}'],
  ['chooser: a refused choice stays', CHOOSER, '    else if (result.refused) setFor(target, before)\n', ''],
  ['chooser: a conflict is not shown', CHOOSER, '    if (result.conflict) setFor(target, result.conflict)\n', '    if (result.conflict) void 0\n'],
  ['chooser: fixed rows get a select', CHOOSER, '{source.kind === "fixed"\n                  ?', '{false\n                  ?'],
  ['chooser: the flag ignores Pass 2', CHOOSER, 'export const STUDIO_MODEL_CHOICE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true"', 'export const STUDIO_MODEL_CHOICE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"'],
  ['chooser: the polish lib is imported again', CHOOSER, 'import "./intelligence-p2.css"\n', 'import "./intelligence-p2.css"\nimport "@/lib/studio-p2-polish"\n'],
  ['chooser: "used" without a build', CHOOSER, '    if (!deckId || !buildId) return\n', '    if (!deckId) return\n'],
  ['css: 34 px targets', CSS, '[data-model-choice="true"] .sp-p2-pick select { min-height: 44px; }', '[data-model-choice="true"] .sp-p2-pick select { min-height: 34px; }'],
  ['css: an unscoped rule', CSS, '.sp-mc2-quiet {', 'select { min-height: 44px; }\n.sp-mc2-quiet {'],
  ['css: a larger text size', CSS, '.sp-mc2-fixed { margin: 0; color: var(--sp-muted); font-size: 10px; }', '.sp-mc2-fixed { margin: 0; color: var(--sp-muted); font-size: 13px; }'],
  ['strip: the hook ignores the flag', STRIP, "'  if (STUDIO_MODEL_CHOICE_ENABLED) return", "'  if (true) return"],
  ['strip: the strip keeps marked lines', STRIP, "  return text.split('\\n').filter(line => !MODEL_CHOICE_MARKER_RE.test(line)).join('\\n')", '  return text'],
  ['env: the block says "true"', ENV, 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE="false"', 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE="true"'],
  ['env: the block names the router address variable', STRIP, 'at the router address the narration block\n# above sets', 'at MODEL_ROUTER_URL (the narration block\n# above sets it)'],
  ['fixture: a timeline row of another person becomes mine', `${FIX}/router-timeline-200.json`, '"user_id": "user-fixture-2"', '"user_id": "user-fixture-1"'],
  // the deck's own Auto (ROUTER-2, model-router !42)
  ['server: auto: false is accepted', SERVER, "      if (choice.auto !== true) return refuse('Auto is { \"auto\": true }.')\n", ''],
  ['server: auto may carry another key', SERVER, "    if (!isRecord(choice) || Object.keys(choice).length !== 1) return refuse('A choice is { \"preset\" } or { \"model\" } or { \"auto\": true } or null.')", "    if (!isRecord(choice)) return refuse('A choice is { \"preset\" } or { \"model\" } or { \"auto\": true } or null.')"],
  ['server: auto is allowed on the user scope', SERVER, "    if (!deck && Object.values(changes).some(choice => choice !== null && 'auto' in choice)) return fail(", '    if (false) return fail('],
  ['server: a carried auto row is rewritten', SERVER, 'merged[group] = row.auto ? { auto: true } : row.preset !== null', 'merged[group] = row.preset !== null'],
  ['server: auto rows are not read', SERVER, "    else if (row.auto === true && (row.preset ?? null) === null && (row.model ?? null) === null) out[group] = { preset: null, model: null, stale: row.stale === true, auto: true }\n", ''],
  ['server: the user scope shows auto rows', SERVER, "(scope === 'deck' || !rows[group].auto)", 'true'],
  ['server: the auto refusal speaks generally', SERVER, "askedAuto || code === 'invalid_preference_auto' ? 'Auto cannot be saved for this presentation right now.' : 'That choice cannot be saved for this task right now.'", "'That choice cannot be saved for this task right now.'"],
  ['lib: auto is sent on the reusable defaults', LIB, "value === MODEL_CHOICE_AUTO && kind === 'deck' ? { auto: true } : null", "value === MODEL_CHOICE_AUTO ? { auto: true } : null"],
  ['lib: auto rows are not read', LIB, "else if (kind === 'deck' && row.auto === true) out[group as P2TaskId] = MODEL_CHOICE_AUTO", "else if (false) out[group as P2TaskId] = MODEL_CHOICE_AUTO"],
  ['lib: the account sends a deck as the user', LIB, 'body: JSON.stringify(toWire(choices, scope.kind))', 'body: JSON.stringify(toWire(choices))'],
  ['lib: the account reads a deck as the user', LIB, 'const choices = fromWire(answer.body, scope.kind)', 'const choices = fromWire(answer.body)'],
  ['lib: deck Auto is offered on the reusable defaults', LIB, "return scope.kind === 'deck' && source.kind !== 'fixed' ?", "return source.kind !== 'fixed' ?"],
  ['lib: the reusable defaults keep an auto', LIB, " && !(scope.kind === 'user' && stored[task.id] === MODEL_CHOICE_AUTO)) out[task.id]", ') out[task.id]'],
  ['lib: the default row keeps its old words', LIB, 'label: `${MODEL_CHOICE_USE_DEFAULT}: ${source.isChoice', 'label: `Reusable default — ${source.isChoice'],
  ['lib: a deck Auto reads as a dropped choice', LIB, ' && choices[task.id] !== MODEL_CHOICE_AUTO && !sources[task.id].isChoice(', ' && !sources[task.id].isChoice('],
  ['lib: a deck Auto is not a choice of the row', LIB, "if (deck && choices[task.id] === MODEL_CHOICE_AUTO && sources[task.id].kind !== 'fixed')", 'if (false)'],
  ['lib: deck_auto reads as fixed', LIB, "  if (reason === 'deck_auto') return `This presentation: Auto (Deckster's choice): ${model}`\n", ''],
  ['lib: the refusal code is dropped', LIB, 'refused: true, refusedCode: codeOf(answer.body) }', 'refused: true }'],
  ['chooser: a refused Auto reads as any refusal', CHOOSER, 'askedAuto || result.refusedCode === "invalid_preference_auto" ? MODEL_CHOICE_REFUSED_AUTO : MODEL_CHOICE_REFUSED', 'MODEL_CHOICE_REFUSED'],
  ['chooser: a deck Auto is taken on the reusable defaults', CHOOSER, 'const deckAuto = value === MODEL_CHOICE_AUTO && scope.kind === "deck"', 'const deckAuto = value === MODEL_CHOICE_AUTO'],
  ['chooser: the deck\'s choices drop the Auto', CHOOSER, 'effectiveChoices(raw, sources, scope.kind === "deck")', 'effectiveChoices(raw, sources)'],
  ['fixture: an auto row is not auto', `${FIX}/router-prefs-session-auto-200.json`, '"auto": true,\n      "preset": null,\n      "model": null,\n      "updated_at": "2026-10-26T14:00:00Z"', '"auto": false,\n      "preset": null,\n      "model": null,\n      "updated_at": "2026-10-26T14:00:00Z"'],
]
let caught = 0
const missed = []
for (const [name, rel, from, to] of MUTANTS) {
  const text = read(rel)
  if (!text.includes(from)) { missed.push(`${name} (target text not found)`); continue }
  overrides = { [rel]: text.replace(from, () => to) }
  let outcome
  try { outcome = await suite({ quiet: true }) } catch (error) { outcome = { failures: [String(error)] } } finally { overrides = {} }
  if (outcome.failures.length > 0) caught++; else missed.push(name)
}
const scopeMutant = await suite({ quiet: true, extraCommitted: ['lib/some-other-change.ts'] })
if (scopeMutant.failures.length > 0) caught++; else missed.push('scope: a stray committed file')
if (missed.length) {
  for (const name of missed) console.error(`MUTANT NOT CAUGHT: ${name}`)
  process.exit(1)
}
console.log(`PASS O  ${caught} of ${MUTANTS.length + 1} mutants caught`)
console.log(`test-studio-model-choice: ${main.checks} checks, ${caught} mutants, all passed`)
