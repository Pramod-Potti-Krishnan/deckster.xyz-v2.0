// FRONTEND-2: proof for the P3-10 compact MODEL PICKER (components/model-choice/model-picker.tsx, its hook use-model-choice.ts, lib/studio-model-picker.ts, model-picker.css), the control FRONTEND-1 places in the new
// chat composer. Same flag as the Intelligence picker, NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true", default off); the picker is NOT mounted anywhere in the app by this change. It saves through the adapter and the three
// Studio routes of the Intelligence picker (lib/studio-model-choice.ts, lib/studio-model-choice-server.ts), so those are run here for real: the browser side talks to the real server handlers, and behind them is an
// in-process fake router that keeps saved choices with ETags as the router does. Every catalogue and router answer is a fixture (scripts/fixtures/studio-model-choice/). No network, no browser, no services; nothing
// is written. The router key is made up at run time.
//
// Run: node scripts/test-studio-model-picker.mjs      (plain node: the real TypeScript transpiled and run in this process; MODEL_PICKER_NO_MUTANTS=1 skips the mutants)
//
//   A. fixtures   the catalogue fixture's six models common to the three text groups, written out by hand
//   B. flag       nothing is rendered for any value but "true" (real React), and nothing is asked, stored or run; the modules do nothing when imported
//   C. chip       the label for each state: the tier only (Auto / Fast / Balanced / Best), a short model name with the full name in the accessible label and title, Custom for a mix; truncation
//   D. menu       Auto, Fast, Balanced, Best with $ / $$ / $$$ (the models' cost_hint when the three groups agree); "More models…" lists the models common to the three groups, and only those
//   E. write      one choice is written to the three text groups and to nothing else; Auto clears them; the wire values; imagery and narration are never written
//   F. scope      no session: the reusable default ("Applies to new decks"); a session: this deck ("Applies to this deck"), following the default until it has a choice of its own
//   G. fallbacks  router 503 -> this device ("Saved on this device for now"); no deck scope (404) or an unsaved / foreign session -> the default; the account unreachable or the routes off -> the device; a storage that throws
//   H. onChange   called after the save settles, with the choice in force; not for a refusal or an ignored pick; a conflict shows the saved choice; a second pick while one is saving is ignored
//   I. catalogue  no catalogue (route off, 503, 404, not JSON, wrong schema) leaves the tiers and no models; a kept model with no catalogue reads by its id; only Studio routes are asked, never a user id
//   J. a11y       the trigger and menu attributes (real React and real Radix), the pressed state, the labelled groups, the hint read as words; Escape, outside click and focus return are Radix's and are left alone
//   K. css        24 px chip, no width of its own, truncation, a 44 px hit area and 44 px rows at 640 px and below, every rule scoped, near-monochrome
//   L. identity   flag off is the base: the new files only, nothing imports them, the committed diff of the picker's own commits adds exactly its files (subject "Model choice: ...")
//   M. mutants    each one must make A-L fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { FILES, loadPicker, nodeRequire, realDeps, root, runModule } from './studio-model-picker-kit.mjs'

const postcss = nodeRequire('postcss')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const nextServer = nodeRequire('next/server')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

const STRIP = 'scripts/studio-model-choice-strip.mjs'
const KIT = 'scripts/studio-model-picker-kit.mjs', FIXTURE_SCRIPT = 'scripts/render-model-picker-fixture.mjs', SELF = 'scripts/test-studio-model-picker.mjs'
const SERVER = 'lib/studio-model-choice-server.ts', CHOICE_LIB = FILES.choice
const REGISTRY = 'scripts/studio-later-changes.mjs'
const FIX = 'scripts/fixtures/studio-model-choice', FIXTURE = `${FIX}/catalogue-live-shape.json`
const PICKER_BASE = '8e735ca3' // the head of #521 before the picker (frontend2/model-choice-ui)
const PICKER_FILES = [FILES.picker, FILES.hook, FILES.component, FILES.css, KIT, FIXTURE_SCRIPT, SELF].sort()
const TEXT_GROUPS = ['planning_strategy', 'content_writing', 'research_analysis']

let overrides = {}
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const json = rel => JSON.parse(read(rel))

// The made-up router key (built at run time, so no file carries one) and the made-up people.
const KEY = ['fixture', 'frontend', crypto.randomBytes(8).toString('hex')].join('-')
const ME = { id: 'user-fixture-1', email: 'me@example.test' }
const OWNED = { 'sess-fixture-1': { userId: 'user-fixture-1', status: 'active' }, 'sess-fixture-2': { userId: 'user-fixture-1', status: 'active' }, 'sess-other': { userId: 'user-fixture-2', status: 'active' } }
const CONFIGURED = { MODEL_ROUTER_URL: 'https://router.example.test/v1/', MODEL_ROUTER_FRONTEND_KEY: KEY, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
const USER_PATH = `/v1/prefs/${ME.id}`, SESSION_PATH = `/v1/prefs/${ME.id}/sessions/sess-fixture-1`
const USER_KEY = 'deckster-studio-model-choice-v1:user'

// ---------------------------------------------------------------- the router: an in-process fake that keeps choices per (user) and (user, session) with ETags, as the router does
function fakeRouter({ deckScope = true, refuse = [] } = {}) {
  const store = new Map(), log = [], state = { deckScope }
  const certified = Object.fromEntries(TEXT_GROUPS.map(group => [group, json(FIXTURE).groups[group].selectable_models]))
  const etagOf = rows => `"${sha(JSON.stringify(Object.entries(rows).sort())).slice(0, 32)}"`
  let clock = 0
  const answer = (status, body, etag) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? etag ?? null : null) }, json: async () => JSON.parse(JSON.stringify(body)) })
  const fetch = async (url, init) => {
    log.push({ url, method: init.method, headers: { ...init.headers }, body: init.body ?? null })
    if (init.headers.Authorization !== `Bearer ${KEY}`) return answer(401, { error: { message: 'Invalid key', type: 'authentication_error', code: 'invalid_api_key' } })
    const { pathname } = new URL(url)
    const m = /^\/v1\/prefs\/([^/]+)(?:\/sessions\/([^/]+))?$/.exec(pathname)
    if (!m || (m[2] && !state.deckScope)) return answer(404, json(`${FIX}/router-not-found-404.json`))
    const rows = store.get(pathname) ?? {}
    const view = list => ({ user_id: decodeURIComponent(m[1]), ...(m[2] ? { session_id: decodeURIComponent(m[2]) } : {}), preferences: Object.fromEntries(Object.entries(list).map(([g, r]) => [g, { ...r, stale: false }])), catalogue_version: 'fixture' })
    if (init.method === 'GET') return answer(200, view(rows), etagOf(rows))
    if (init.headers['If-Match'] && init.headers['If-Match'] !== etagOf(rows)) return answer(412, json(`${FIX}/router-prefs-412.json`), etagOf(rows))
    const body = JSON.parse(init.body)
    for (const [group, choice] of Object.entries(body.preferences)) {
      if (choice === null) continue
      if (!TEXT_GROUPS.includes(group)) return answer(422, { error: { message: 'x', type: 'invalid_request_error', code: 'invalid_preference_group' } })
      if (choice.model && (!certified[group].includes(choice.model) || refuse.includes(choice.model))) return answer(422, { error: { message: 'x', type: 'invalid_request_error', code: 'invalid_preference_model' } })
    }
    const stamp = choice => ({ preset: choice.preset ?? null, model: choice.model ?? null, updated_at: `2026-10-26T12:00:${String(++clock).padStart(2, '0')}Z` })
    if (init.method === 'PATCH' && !m[2]) {
      const next = { ...rows }
      for (const [group, choice] of Object.entries(body.preferences)) { if (choice === null) delete next[group]; else next[group] = stamp(choice) }
      store.set(pathname, next)
      return answer(200, view(next), etagOf(next))
    }
    if (init.method === 'PUT' && m[2]) {
      const next = Object.fromEntries(Object.entries(body.preferences).map(([group, choice]) => [group, stamp(choice)]))
      store.set(pathname, next)
      return answer(200, view(next))
    }
    return answer(405, { detail: 'Method Not Allowed' })
  }
  const seed = (pathname, choice) => store.set(pathname, Object.fromEntries(TEXT_GROUPS.map(group => [group, { preset: choice.tier ?? null, model: choice.model ?? null, updated_at: '2026-10-25T09:00:00Z' }])))
  return { fetch, store, log, state, seed, etagOf, bump: (pathname, rows) => store.set(pathname, rows) }
}
const kept = (router, pathname) => Object.fromEntries(Object.entries(router.store.get(pathname) ?? {}).map(([group, row]) => [group, row.preset ?? `model:${row.model}`]))

// ---------------------------------------------------------------- the picker under a small hook runtime. Real: the TypeScript, the adapter, the server handlers. Stubbed: React's scheduler (state is applied at once, effects run after each pass) and Radix (a popover that is open when asked).
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

async function mount({ props = { sessionId: null }, flag = 'true', env = {}, studio = 'account', router = fakeRouter(), storage = makeStorage(), catalogue = okCatalogue(json(FIXTURE)), body, onChange } = {}) {
  const fullEnv = { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: flag, NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true', ...env }
  if (flag === null) delete fullEnv.NEXT_PUBLIC_STUDIO_MODEL_CHOICE
  const studioEnv = studio === 'unconfigured' ? { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } : studio === 'routes-off' ? { ...CONFIGURED, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: undefined } : CONFIGURED
  const fetchLog = []
  const respond = (status, payload, etag) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? etag ?? null : null) }, json: async () => { if (payload === undefined) throw new SyntaxError('no body'); return JSON.parse(JSON.stringify(payload)) } })
  const world = { fetchLog, storage, router }
  let server = null
  const fetchImpl = async (url, init = {}) => {
    fetchLog.push({ url: String(url), init })
    if (url === '/api/models/catalogue') {
      if (catalogue.throws) throw new TypeError('Failed to fetch')
      return respond(catalogue.status, catalogue.notJson ? undefined : catalogue.body)
    }
    if (studio === 'down') throw new TypeError('Failed to fetch')
    const deps = { env: studioEnv, getSessionUser: async () => ME, findOwnedSession: async id => OWNED[id] ?? null, fetch: router.fetch }
    let outcome
    if (url.startsWith('/api/model-choice/prefs')) {
      const deck = url.startsWith('/api/model-choice/prefs/deck/') ? decodeURIComponent(url.slice('/api/model-choice/prefs/deck/'.length)) : null
      outcome = await server.handlePrefs(init.method ?? 'GET', deck, { ifMatch: init.headers?.['If-Match'] ?? null, body: async () => JSON.parse(init.body) }, deps)
    } else throw new Error(`the browser asked for ${url}`)
    return respond(outcome.status, outcome.body, outcome.etag)
  }
  // the hook runtime
  let current, changes = 0, dirty = false, ids = 0
  const fibers = new Map(), queue = []
  const same = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const hooks = {
    useState(initial) {
      const fiber = current, index = fiber.cursor++
      if (!(index in fiber.state)) fiber.state[index] = typeof initial === 'function' ? initial() : initial
      return [fiber.state[index], value => { const next = typeof value === 'function' ? value(fiber.state[index]) : value; if (!Object.is(next, fiber.state[index])) { fiber.state[index] = next; dirty = true; changes++ } }]
    },
    useRef(initial) { const fiber = current, index = fiber.cursor++; if (!(index in fiber.state)) fiber.state[index] = { current: initial }; return fiber.state[index] },
    useId() { const fiber = current, index = fiber.cursor++; if (!(index in fiber.state)) fiber.state[index] = `:r${++ids}:`; return fiber.state[index] },
    useCallback(fn, deps) { const fiber = current, index = fiber.cursor++, prior = fiber.state[index]; if (prior && same(prior.deps, deps)) return prior.fn; fiber.state[index] = { fn, deps }; return fn },
    useEffect(effect, deps) {
      assert.ok(Array.isArray(deps), 'every effect needs a dependency array')
      const fiber = current, index = fiber.cursor++, prior = fiber.effects[index]
      if (!prior || !same(prior.deps, deps)) fiber.pending.push({ fiber, index, effect, deps })
    },
  }
  const mockJsx = (type, p) => ({ type, props: p || {} })
  const popover = { open: false, onOpenChange: null }
  const radix = {
    Root: ({ open, onOpenChange, children }) => { popover.open = open; popover.onOpenChange = onOpenChange; return { type: 'popover-root', props: { children } } },
    Trigger: p => ({ type: 'button', props: { ...p, 'aria-haspopup': 'dialog', 'aria-expanded': popover.open, onClick: () => popover.onOpenChange(!popover.open) } }),
    Portal: ({ children }) => ({ type: 'popover-portal', props: { children } }),
    Content: ({ children, ...rest }) => (popover.open ? { type: 'div', props: { ...rest, role: 'dialog', children } } : null),
  }
  const win = { localStorage: storage }
  const m = loadPicker({ read, react: hooks, jsx: { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' }, radix, lucide: new Proxy({}, { get: (_, name) => String(name) }), env: fullEnv, globals: { window: win, fetch: fetchImpl } })
  server = runModule(SERVER, { '@/lib/studio-model-choice': m.choice }, { read })
  const rootProps = { ...props, ...(onChange ? { onChange } : {}) }
  const rootOf = body ? body(m) : m.component.ModelPicker
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
    m, world, popover, fetchLog, router, storage, props: rootProps, tree: null,
    flush() {
      for (let pass = 0; pass < 40; pass++) {
        dirty = false; queue.length = 0
        rt.tree = resolve({ type: rootOf, props: rt.props }, 'root')
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
    async act(fn) { await fn(); return rt.settle() },
    nodes: () => walk(rt.tree),
    maybe: predicate => rt.nodes().find(predicate),
    find(predicate, label = 'node') { const found = rt.nodes().find(predicate); assert.ok(found, `expected ${label}`); return found },
    all: predicate => rt.nodes().filter(predicate),
    chip: () => rt.find(node => node.props?.['data-mpick'] === 'chip', 'the chip'),
    chipText: () => textOf(rt.find(node => node.props?.className === 'mpick-label', 'the chip label')),
    menu: () => rt.maybe(node => node.props?.['data-mpick'] === 'menu'),
    status: () => textOf(rt.find(node => node.props?.['data-mpick'] === 'status', 'the status')),
    async open() { await rt.act(() => rt.chip().props.onClick()); assert.ok(rt.menu(), 'the menu opens') },
    items() {
      const menu = rt.menu(); assert.ok(menu, 'the menu is open')
      return walk(menu).filter(node => node.type === 'button' && node.props['data-mpick-option'] && node.props['data-mpick-option'] !== 'more').map(node => {
        const part = cls => { const found = walk(node).find(n => n.props?.className === cls); return found ? textOf(found) : null }
        return { id: node.props['data-mpick-option'], name: part('mpick-name'), detail: part('mpick-detail'), hint: part('mpick-hint'), pressed: node.props['aria-pressed'], node }
      })
    },
    more() { return rt.all(node => node.props?.['data-mpick-option'] === 'more') },
    item(id) { const found = rt.items().find(item => item.id === id); assert.ok(found, `expected the option ${id}`); return found },
    async pick(id) { const item = rt.item(id); await rt.act(() => item.node.props.onClick()); return rt },
    note(kind) { const node = rt.maybe(n => n.props?.['data-mpick'] === kind); return node ? textOf(node) : null },
    async setProps(next) { rt.props = { ...rt.props, ...next }; return rt.settle() },
  }
  return rt.settle()
}
const seedWire = (router, pathname, tier) => router.seed(pathname, { tier })

// ---------------------------------------------------------------- expected values, written out here (not derived from the helpers)
// The fixture's three text groups certify, in common: Claude Opus 5.5, DeepSeek V4.1 Flash, GPT-6 Luna, GPT-6.1 Sol, Kimi K3, Qwen3.8 Flash. Not in common: Gemini 3.8 Flash, Nemotron 3.5 Lightning and Grok 4.6 (planning only),
// Claude Sonnet 5.5 (writing and research), Grok 4.7 (writing and research), Gemini 3.5 Flash Lite (research only).
const COMMON = [
  ['anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'Anthropic'], ['deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek'], ['openai/gpt-6-luna', 'GPT-6 Luna', 'OpenAI'],
  ['openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'OpenAI'], ['moonshotai/kimi-k3', 'Kimi K3', 'Moonshot AI'], ['qwen/qwen3.8-flash', 'Qwen3.8 Flash', 'Qwen'],
]
const NOT_COMMON = ['google/gemini-3.8-flash', 'nvidia/nemotron-3.5-lightning', 'x-ai/grok-4.6', 'anthropic/claude-sonnet-5.5', 'x-ai/grok-4.7', 'google/gemini-3.5-flash-lite']
const MAIN = [['auto', 'Auto', null], ['economy', 'Fast', '$'], ['balanced', 'Balanced', '$$'], ['best', 'Best', '$$$']]
const NOTES = { account: 'Saved to your account. Applies from the next build.', device: 'Saved on this device for now', unreachable: 'Your account could not be reached; saved on this device for now', noStorage: 'This browser cannot keep it; it lasts until you leave' }

// ================================================================ the whole check
async function suite({ quiet = false, bail = false, extraCommitted = [] } = {}) {
  let checks = 0
  const failures = []
  const check = async (name, fn) => {
    if (bail && failures.length) return
    try { await fn(); checks++ } catch (error) { failures.push(`${name}: ${String(error.message).split('\n')[0]}`) }
  }
  const eq = assert.equal, ok = assert.ok, deep = (a, b, message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), message)
  const fixture = json(FIXTURE)
  const real = realDeps()

  // ---- A. fixtures ------------------------------------------------------------------------------------------------------------------------------------------------
  await check('A: the models certified in all three text groups are the six written out here, and only they', () => {
    const certified = group => fixture.groups[group].selectable_models
    const common = certified('planning_strategy').filter(slug => certified('content_writing').includes(slug) && certified('research_analysis').includes(slug)).sort()
    deep(common, COMMON.map(([slug]) => slug).sort())
    for (const slug of NOT_COMMON) ok(!common.includes(slug), slug)
    deep(Object.fromEntries(TEXT_GROUPS.map(group => [group, fixture.groups[group].visibility])), { planning_strategy: 'user', content_writing: 'user', research_analysis: 'user' })
  })

  // ---- B. flag -----------------------------------------------------------------------------------------------------------------------------------------------------
  await check('B: real React renders nothing for every value but "true", whatever the props', () => {
    for (const flag of [undefined, '', 'false', 'TRUE', ' true', 'true ', '1', 'yes']) {
      const m = loadPicker({ read, ...real, env: flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: flag } })
      for (const props of [{ sessionId: null }, { sessionId: 'sess-fixture-1', disabled: true, className: 'x', variant: 'compact' }]) eq(renderToStaticMarkup(real.react.createElement(m.component.ModelPicker, props)), '', `flag ${JSON.stringify(flag)}`)
      eq(m.component.STUDIO_MODEL_PICKER_ENABLED, false)
    }
    const on = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
    ok(renderToStaticMarkup(real.react.createElement(on.component.ModelPicker, { sessionId: null })).includes('data-mpick="chip"'), 'and "true" renders the chip')
  })
  await check('B: flag off nothing is asked, nothing is stored, no effect runs; the other flags change nothing', async () => {
    for (const flag of [null, 'false', 'TRUE', '1']) {
      const rt = await mount({ flag, env: { NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'true' } })
      eq(rt.tree, null); eq(rt.fetchLog.length, 0); eq(rt.storage.log.length, 0)
    }
    const rt = await mount({ env: { NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: undefined, NEXT_PUBLIC_STUDIO_V4_SHELL: undefined } })
    ok(rt.chip(), 'on with the one flag only (no Pass 2 flag needed)')
  })
  await check('B: importing the modules asks for nothing and touches no storage', () => {
    const spy = { fetch: 0, storage: 0 }
    loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true' }, globals: { fetch: () => { spy.fetch++; return Promise.reject(new Error('no')) }, window: { get localStorage() { spy.storage++; return {} } } } })
    eq(spy.fetch, 0); eq(spy.storage, 0)
  })

  // ---- C. chip ------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('C: the chip says the tier only: Auto, Fast, Balanced, Best, for a new deck and for a session', async () => {
    const router = fakeRouter()
    for (const [tier, label] of [[null, 'Auto'], ['economy', 'Fast'], ['balanced', 'Balanced'], ['best', 'Best']]) {
      router.store.clear(); if (tier) seedWire(router, USER_PATH, tier)
      const rt = await mount({ router })
      eq(rt.chipText(), label); eq(rt.chip().props['aria-label'], `Model: ${label}`); eq(rt.chip().props.title, `Model: ${label}`); eq(rt.chip().props['data-mpick-state'], tier ? 'tier' : 'auto')
    }
  })
  await check('C: a chosen model shows a short name, whole when it fits; the full name is in the label and the title', async () => {
    for (const [slug, name, shown] of [['anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'Claude Opus 5.5'], ['deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek V4.1…'], ['openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'GPT-6.1 Sol'], ['qwen/qwen3.8-flash', 'Qwen3.8 Flash', 'Qwen3.8 Flash']]) {
      const router = fakeRouter(); router.seed(USER_PATH, { model: slug })
      const rt = await mount({ router })
      eq(rt.chipText(), shown, slug); eq(rt.chip().props['aria-label'], `Model: ${name}`); eq(rt.chip().props.title, `Model: ${name}`); eq(rt.chip().props['data-mpick-state'], 'model')
      ok(rt.chipText().length <= rt.m.picker.PICKER_SHORT_MAX, `${slug}: at most ${rt.m.picker.PICKER_SHORT_MAX} characters`)
    }
  })
  await check('C: shortName: whole at the limit, cut at a word with an ellipsis, mid-word only for one long word; never longer than the limit', () => {
    const { picker } = loadPicker({ read, ...real })
    for (const [name, shown] of [['Kimi K3', 'Kimi K3'], ['0123456789012345', '0123456789012345'], ['Claude Opus 5.5 Thinking', 'Claude Opus 5.5…'], ['Claude Sonnet 5.5', 'Claude Sonnet…'], ['DeepSeek V4.1 Flash', 'DeepSeek V4.1…'],
      ['Supercalifragilisticexpialidocious', 'Supercalifragil…'], ['A very long model name indeed', 'A very long…']]) eq(picker.shortName(name), shown, name)
    for (const name of ['x'.repeat(80), 'Word '.repeat(30)]) ok(picker.shortName(name).length <= picker.PICKER_SHORT_MAX, name.slice(0, 8))
  })
  await check('C: three groups that differ read as Custom (the Intelligence page sets them per task), and report nothing', async () => {
    const router = fakeRouter()
    router.bump(USER_PATH, { planning_strategy: { preset: 'best', model: null, updated_at: 't' }, content_writing: { preset: 'economy', model: null, updated_at: 't' } })
    const rt = await mount({ router })
    eq(rt.chipText(), 'Custom'); eq(rt.chip().props['data-mpick-state'], 'mixed'); ok(rt.chip().props['aria-label'].startsWith('Model: Custom'))
  })
  await check('C: a kept tier or model the catalogue no longer opens reads as Auto, and stays kept', async () => {
    const router = fakeRouter(); router.seed(USER_PATH, { model: 'google/gemini-3.8-flash' })
    const rt = await mount({ router })
    eq(rt.chipText(), 'Auto'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'model:google/gemini-3.8-flash'])))
    const body = json(FIXTURE); delete body.groups.planning_strategy.presets.best; body.groups.planning_strategy.presets.best = 'x-ai/not-certified'
    const router2 = fakeRouter(); seedWire(router2, USER_PATH, 'best')
    const rt2 = await mount({ router: router2, catalogue: okCatalogue(body) })
    eq(rt2.chipText(), 'Auto', 'a tier whose model the group does not certify')
  })
  await check('C: until the choices are in the chip is disabled, busy and says Auto; then it opens', async () => {
    const rt = await mount({ flag: 'true' }) // settled
    ok(!rt.chip().props.disabled && rt.chip().props['aria-busy'] === undefined)
    const real1 = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
    const html = renderToStaticMarkup(real.react.createElement(real1.component.ModelPicker, { sessionId: null }))
    ok(/disabled=""/.test(html) && /aria-busy="true"/.test(html) && html.includes('>Auto<'), 'the server markup, before anything has loaded')
  })

  // ---- D. menu ------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('D: the menu opens on Auto / Fast / Balanced / Best with $ / $$ / $$$, Auto first, Auto selected, and More models… below', async () => {
    const rt = await mount()
    eq(rt.menu(), undefined, 'closed at first'); await rt.open()
    deep(rt.items().map(item => [item.id, item.name, item.hint]), MAIN)
    deep(rt.items().map(item => item.pressed), [true, false, false, false]); eq(rt.item('auto').detail, 'Deckster chooses')
    const more = rt.more(); eq(more.length, 1); eq(textOf(more[0]), 'More models…')
    eq(rt.chip().props['aria-expanded'], true)
  })
  await check('D: More models… lists exactly the models certified in all three text groups, by name, with their provider; the others are not offered', async () => {
    const rt = await mount(); await rt.open()
    await rt.act(() => rt.more()[0].props.onClick())
    deep(rt.items().map(item => [item.id, item.name, item.detail]), COMMON.map(([slug, name, provider]) => [`model:${slug}`, name, provider]))
    for (const slug of NOT_COMMON) ok(!rt.items().some(item => item.id === `model:${slug}`), slug)
    ok(rt.maybe(node => node.type === 'button' && textOf(node).trim() === 'Back'), 'a Back button'); eq(rt.items().length, 6)
    await rt.act(() => rt.find(node => node.type === 'button' && textOf(node).trim() === 'Back').props.onClick()); deep(rt.items().map(item => item.id), MAIN.map(row => row[0]))
  })
  await check('D: a group that does not certify a model takes it out of the list; a group the catalogue does not open leaves no models at all', async () => {
    const body = json(FIXTURE); body.groups.research_analysis.selectable_models = body.groups.research_analysis.selectable_models.filter(slug => slug !== 'openai/gpt-6.1-sol')
    const rt = await mount({ catalogue: okCatalogue(body) }); await rt.open()
    await rt.act(() => rt.more()[0].props.onClick())
    eq(rt.items().length, 5); ok(!rt.items().some(item => item.id === 'model:openai/gpt-6.1-sol'))
    const hidden = json(FIXTURE); hidden.groups.content_writing.visibility = 'system'
    const rt2 = await mount({ catalogue: okCatalogue(hidden) }); await rt2.open()
    eq(rt2.more().length, 0, 'no More models…'); deep(rt2.items().map(item => item.id), MAIN.map(row => row[0]), 'the tiers stay (the router\'s own)')
  })
  await check('D: a tier is offered only when each open group certifies the model it names', async () => {
    const body = json(FIXTURE); body.groups.content_writing.presets.best = 'google/gemini-3.8-flash' // not certified for writing
    const rt = await mount({ catalogue: okCatalogue(body) }); await rt.open()
    deep(rt.items().map(item => item.id), ['auto', 'economy', 'balanced'])
  })
  await check('D: the catalogue\'s cost_hint is the tier\'s hint when the three groups\' models agree, else the tier\'s own; a model shows its own', async () => {
    const body = json(FIXTURE) // best: kimi-k3 / sonnet-5.5 / opus-5.5; balanced: gemini-3.8-flash / luna / luna; economy: luna ×3
    for (const slug of ['moonshotai/kimi-k3', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-opus-5.5']) body.models[slug].cost_hint = '$$'
    body.models['google/gemini-3.8-flash'].cost_hint = '$'; body.models['openai/gpt-6-luna'].cost_hint = '$'
    body.models['openai/gpt-6.1-sol'].cost_hint = '$$$'; body.models['qwen/qwen3.8-flash'].cost_hint = '$$$$'
    const rt = await mount({ catalogue: okCatalogue(body) }); await rt.open()
    deep(rt.items().map(item => [item.id, item.hint]), [['auto', null], ['economy', '$'], ['balanced', '$'], ['best', '$$']], 'agree: their hint; economy: luna $')
    body.models['anthropic/claude-sonnet-5.5'].cost_hint = '$$$'
    const rt2 = await mount({ catalogue: okCatalogue(body) }); await rt2.open()
    eq(rt2.item('best').hint, '$$$', 'disagree: the tier\'s own')
    await rt2.act(() => rt2.more()[0].props.onClick())
    deep(rt2.items().map(item => [item.name, item.hint]).filter(row => ['GPT-6.1 Sol', 'Qwen3.8 Flash', 'Kimi K3'].includes(row[0])), [['GPT-6.1 Sol', '$$$'], ['Kimi K3', '$$'], ['Qwen3.8 Flash', null]], 'a model\'s own hint; a malformed one is none')
  })

  // ---- E. write -----------------------------------------------------------------------------------------------------------------------------------------------------
  await check('E: a tier is written to the three text groups and to nothing else (Fast is "economy" on the wire); the router holds exactly those', async () => {
    for (const [id, wire, chip] of [['best', 'best', 'Best'], ['balanced', 'balanced', 'Balanced'], ['economy', 'economy', 'Fast']]) {
      const router = fakeRouter()
      const rt = await mount({ router }); await rt.open(); await rt.pick(id)
      const patch = rt.fetchLog.filter(entry => entry.init.method === 'PATCH'); eq(patch.length, 1); eq(patch[0].url, '/api/model-choice/prefs')
      deep(JSON.parse(patch[0].init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: wire }])) })
      deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, wire]))); eq(rt.chipText(), chip); eq(rt.menu(), undefined, 'the menu closes')
      ok(router.log.every(entry => !/imagery|voice_narration|structure_layout|embeddings/.test(entry.body ?? '')), 'the router is never sent another group')
    }
  })
  await check('E: a model is written to the three text groups; the router refuses nothing, and holds exactly the model', async () => {
    const router = fakeRouter()
    const rt = await mount({ router }); await rt.open()
    await rt.act(() => rt.more()[0].props.onClick()); await rt.pick('model:openai/gpt-6.1-sol')
    deep(JSON.parse(rt.fetchLog.find(entry => entry.init.method === 'PATCH').init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { model: 'openai/gpt-6.1-sol' }])) })
    deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'model:openai/gpt-6.1-sol']))); eq(rt.chipText(), 'GPT-6.1 Sol')
    await rt.open(); eq(textOf(rt.more()[0]), 'More models…GPT-6.1 Sol', 'the row names the model chosen')
  })
  await check('E: Auto clears the three groups (null on the wire), so the router holds nothing', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best')
    const rt = await mount({ router }); eq(rt.chipText(), 'Best'); await rt.open(); await rt.pick('auto')
    deep(JSON.parse(rt.fetchLog.find(entry => entry.init.method === 'PATCH').init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, null])) })
    deep(kept(router, USER_PATH), {}); eq(rt.chipText(), 'Auto'); eq(rt.chip().props['data-mpick-state'], 'auto')
  })
  await check('E: a choice replaces the one before it, and survives a reload (the next mount reads it from the router)', async () => {
    const router = fakeRouter()
    let rt = await mount({ router }); await rt.open(); await rt.pick('best'); await rt.open(); await rt.pick('economy')
    rt = await mount({ router }); eq(rt.chipText(), 'Fast'); await rt.open(); deep(rt.items().map(item => item.pressed), [false, true, false, false])
    eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0, 'a mount saves nothing')
  })
  await check('E: a pick that is not on offer writes nothing (a model not certified in all three groups, a tier the catalogue does not open, no catalogue for a model)', async () => {
    const rt = await mount({ body: m => function Probe() { const api = m.component.useModelChoice(null); return { type: 'probe', props: { api } } } })
    const api = () => rt.find(node => node.type === 'probe').props.api
    for (const choice of [{ model: 'google/gemini-3.8-flash' }, { model: 'x-ai/grok-4.6' }, { model: '../x' }, { tier: 'cheap' }, { model: 7 }]) deep(await api().select(choice), { kind: 'ignored' })
    eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0)
    const bare = await mount({ catalogue: { status: 503, body: { service_unavailable: true, code: 'router_not_configured' } }, body: m => function Probe() { const api = m.component.useModelChoice(null); return { type: 'probe', props: { api } } } })
    deep(await bare.find(node => node.type === 'probe').props.api.select({ model: 'openai/gpt-6.1-sol' }), { kind: 'ignored' }, 'a model with no catalogue to check it against')
    eq(bare.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0)
  })

  // ---- F. scope -----------------------------------------------------------------------------------------------------------------------------------------------------
  await check('F: with no session the menu edits the reusable default and says "Applies to new decks"', async () => {
    const router = fakeRouter()
    const rt = await mount({ router, props: { sessionId: null } }); await rt.open()
    eq(rt.note('scope'), 'Applies to new decks'); eq(rt.chip().props['data-mpick-scope'], 'user')
    await rt.pick('best'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))); deep(kept(router, SESSION_PATH), {})
    ok(rt.fetchLog.every(entry => !entry.url.includes('/deck/')), 'no deck route was asked')
    for (const sessionId of ['new', '', '../x', 'a b']) { const r = await mount({ props: { sessionId } }); eq(r.chip().props['data-mpick-scope'], 'user', JSON.stringify(sessionId)); ok(r.fetchLog.every(entry => !entry.url.includes('/deck/'))) }
  })
  await check('F: with a session the menu edits that deck, says "Applies to this deck", and leaves the default alone', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'balanced')
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    eq(rt.note('scope'), 'Applies to this deck'); eq(rt.chip().props['data-mpick-scope'], 'deck')
    await rt.pick('economy')
    const put = rt.fetchLog.filter(entry => entry.init.method === 'PATCH'); eq(put.length, 1); eq(put[0].url, '/api/model-choice/prefs/deck/sess-fixture-1')
    deep(kept(router, SESSION_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'economy']))); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])), 'the default is untouched')
    eq(router.log.filter(entry => entry.method === 'PUT').length, 1, 'the router\'s session scope takes the whole map')
    eq(rt.chipText(), 'Fast')
  })
  await check('F: a deck with no choice of its own follows the default (the chip says it; Auto says so); Auto clears the deck back to it', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best')
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } })
    eq(rt.chipText(), 'Best', 'what applies'); await rt.open()
    eq(rt.item('auto').detail, 'Your default: Best'); deep(rt.items().map(item => item.pressed), [false, false, false, true])
    await rt.pick('economy'); eq(rt.chipText(), 'Fast'); await rt.open(); await rt.pick('auto')
    deep(JSON.parse(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, null])) })
    deep(kept(router, SESSION_PATH), {}); eq(rt.chipText(), 'Best', 'back to the default'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])))
  })
  await check('F: a new session id reloads the choice; the first deck\'s choice does not follow', async () => {
    const router = fakeRouter()
    router.bump(SESSION_PATH, Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'best', model: null, updated_at: 't' }])))
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } }); eq(rt.chipText(), 'Best')
    await rt.setProps({ sessionId: 'sess-fixture-2' }); eq(rt.chipText(), 'Auto'); await rt.setProps({ sessionId: null }); eq(rt.chipText(), 'Auto'); eq(rt.chip().props['data-mpick-scope'], 'user')
    await rt.setProps({ sessionId: 'sess-fixture-1' }); eq(rt.chipText(), 'Best')
  })

  // ---- G. fallbacks -------------------------------------------------------------------------------------------------------------------------------------------------
  await check('G: router 503 (no key yet): the choice stays on this device, the menu says "Saved on this device for now", and the account is not asked again', async () => {
    const storage = makeStorage()
    const rt = await mount({ studio: 'unconfigured', storage }); await rt.open()
    eq(rt.note('save'), NOTES.device); eq(rt.chip().props['data-mpick-mode'], 'device')
    await rt.pick('best')
    deep(JSON.parse(storage.map.get(USER_KEY)), { v: 1, scope: 'user', choices: Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])) }); eq(rt.chipText(), 'Best')
    deep(rt.fetchLog.filter(entry => entry.url.startsWith('/api/model-choice')).map(entry => entry.init.method), ['GET'], 'one probe, then the device')
    const again = await mount({ studio: 'unconfigured', storage }); eq(again.chipText(), 'Best', 'read back from this device')
    await rt.open(); await rt.pick('auto'); deep(JSON.parse(storage.map.get(USER_KEY)).choices, {}); eq(rt.chipText(), 'Auto')
  })
  await check('G: with the router key set the menu says "Saved to your account. Applies from the next build."', async () => {
    const rt = await mount({ studio: 'account' }); await rt.open(); eq(rt.note('save'), NOTES.account); eq(rt.chip().props['data-mpick-mode'], 'account')
  })
  await check('G: a deck scope the router does not have (404) falls back to the default: the menu edits and says it', async () => {
    const router = fakeRouter({ deckScope: false }); seedWire(router, USER_PATH, 'balanced')
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } })
    eq(rt.chip().props['data-mpick-scope'], 'user'); eq(rt.chipText(), 'Balanced'); await rt.open(); eq(rt.note('scope'), 'Applies to new decks')
    await rt.pick('best'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))); ok(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').every(entry => !entry.url.includes('/deck/')))
  })
  await check('G: an unsaved or another person\'s session falls back to the default too (404 session_not_found, 403 forbidden)', async () => {
    for (const sessionId of ['sess-unsaved', 'sess-other']) {
      const router = fakeRouter(); seedWire(router, USER_PATH, 'economy')
      const rt = await mount({ router, props: { sessionId } })
      eq(rt.chip().props['data-mpick-scope'], 'user', sessionId); eq(rt.chipText(), 'Fast', sessionId); await rt.open(); eq(rt.note('scope'), 'Applies to new decks')
      await rt.pick('best'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])), sessionId)
    }
  })
  await check('G: the account unreachable, or the Studio routes off (404): this device, and the menu says the account was not reached', async () => {
    for (const studio of ['down', 'routes-off']) {
      const storage = makeStorage()
      const rt = await mount({ studio, storage }); await rt.open(); eq(rt.note('save'), NOTES.unreachable, studio)
      await rt.pick('balanced'); eq(rt.chipText(), 'Balanced'); deep(JSON.parse(storage.map.get(USER_KEY)).choices, Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])))
    }
  })
  await check('G: a deck chosen on this device is kept under the deck\'s own key and does not leak into the default', async () => {
    const storage = makeStorage()
    const rt = await mount({ studio: 'unconfigured', storage, props: { sessionId: 'sess-fixture-1' } }); await rt.open(); eq(rt.note('scope'), 'Applies to this deck'); await rt.pick('best')
    deep(JSON.parse(storage.map.get('deckster-studio-model-choice-v1:deck:sess-fixture-1')).choices, Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))); eq(storage.map.has(USER_KEY), false)
  })
  await check('G: a storage that throws keeps the choice for this visit and says so; the pick still works and reports', async () => {
    const calls = []
    const rt = await mount({ studio: 'unconfigured', storage: makeStorage({}, { get: true, set: true }), onChange: choice => calls.push(choice) }); await rt.open()
    eq(rt.note('save'), NOTES.noStorage); await rt.pick('best'); eq(rt.chipText(), 'Best'); deep(calls, [{ tier: 'best' }])
  })

  // ---- H. onChange --------------------------------------------------------------------------------------------------------------------------------------------------
  await check('H: onChange is called once, after the save settles, with { tier }, { model } or null', async () => {
    const router = fakeRouter(); const calls = []; let ref
    const rt = await mount({ router, onChange: choice => calls.push({ choice, patches: ref.fetchLog.filter(entry => entry.init.method === 'PATCH').length, held: kept(router, USER_PATH).planning_strategy ?? null }) })
    ref = rt
    await rt.open(); await rt.pick('economy')
    await rt.open(); await rt.act(() => rt.more()[0].props.onClick()); await rt.pick('model:moonshotai/kimi-k3')
    await rt.open(); await rt.pick('auto')
    deep(calls.map(call => call.choice), [{ tier: 'economy' }, { model: 'moonshotai/kimi-k3' }, null])
    deep(calls.map(call => [call.patches, call.held]), [[1, 'economy'], [2, 'model:moonshotai/kimi-k3'], [3, null]], 'each call came after its save reached the router')
  })
  await check('H: onChange is not called on load, for an ignored pick, or when the router refuses; a refusal puts the choice back and says so', async () => {
    const router = fakeRouter({ refuse: ['openai/gpt-6.1-sol'] }); seedWire(router, USER_PATH, 'balanced'); const calls = []
    const rt = await mount({ router, onChange: choice => calls.push(choice) }); deep(calls, [])
    await rt.open(); await rt.act(() => rt.more()[0].props.onClick()); await rt.pick('model:openai/gpt-6.1-sol')
    deep(calls, []); eq(rt.chipText(), 'Balanced', 'put back'); eq(rt.status(), 'That choice cannot be saved for this task right now.'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])))
  })
  await check('H: a change made elsewhere since the load (412) shows the saved choice, says so, and reports what is now in force', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'balanced'); const calls = []
    const rt = await mount({ router, onChange: choice => calls.push(choice) })
    seedWire(router, USER_PATH, 'economy') // another tab
    await rt.open(); await rt.pick('best')
    eq(rt.chipText(), 'Fast', 'the saved choice'); eq(rt.status(), 'Your choices changed elsewhere, so the saved ones are shown.'); deep(calls, [{ tier: 'economy' }])
    await rt.open(); await rt.pick('best'); eq(rt.chipText(), 'Best', 'and the next pick goes through'); eq(rt.status(), ''); deep(calls, [{ tier: 'economy' }, { tier: 'best' }])
  })
  await check('H: a second pick while one is saving is ignored (one write)', async () => {
    const router = fakeRouter()
    const rt = await mount({ router }); await rt.open()
    const best = rt.item('best').node, fast = rt.item('economy').node
    await rt.act(() => { best.props.onClick(); fast.props.onClick() })
    eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 1); eq(rt.chipText(), 'Best')
  })
  await check('H: a presentation scope that goes away at save time reverts the pick, falls back to the default, says why and reports nothing', async () => {
    const router = fakeRouter(); const calls = []
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' }, onChange: choice => calls.push(choice) })
    eq(rt.chip().props['data-mpick-scope'], 'deck'); router.state.deckScope = false
    await rt.open(); await rt.pick('best')
    deep(calls, []); eq(rt.chipText(), 'Auto'); eq(rt.chip().props['data-mpick-scope'], 'user'); eq(rt.status(), 'Choices for one presentation aren’t available yet, so your reusable defaults apply.')
    await rt.open(); eq(rt.note('scope'), 'Applies to new decks'); deep(kept(router, USER_PATH), {})
  })

  // ---- I. catalogue -------------------------------------------------------------------------------------------------------------------------------------------------
  await check('I: with no catalogue (route off, 503, 404, not JSON, wrong schema, unreachable) the tiers work and no model is offered', async () => {
    const cases = [
      ['route flag off', { env: { NEXT_PUBLIC_STUDIO_MODEL_CATALOG: undefined } }], ['503 not available', { catalogue: { status: 503, body: { service_unavailable: true, code: 'router_not_configured' } } }],
      ['404', { catalogue: { status: 404, body: { error: 'x' } } }], ['not JSON', { catalogue: { status: 200, notJson: true } }], ['another schema', { catalogue: okCatalogue({ ...json(FIXTURE), schema_version: 2 }) }], ['unreachable', { catalogue: { throws: true } }],
    ]
    for (const [name, extra] of cases) {
      const router = fakeRouter()
      const rt = await mount({ router, ...extra }); await rt.open()
      deep(rt.items().map(item => item.id), MAIN.map(row => row[0]), name); eq(rt.more().length, 0, name); deep(rt.items().map(item => item.hint), [null, '$', '$$', '$$$'], name)
      await rt.pick('best'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])), name); eq(rt.chipText(), 'Best', name)
    }
    const off = await mount({ env: { NEXT_PUBLIC_STUDIO_MODEL_CATALOG: undefined } }); eq(off.fetchLog.filter(entry => entry.url === '/api/models/catalogue').length, 0, 'the catalogue flag off: not asked')
  })
  await check('I: a model kept earlier shows by its id while there is no catalogue to name it', async () => {
    const router = fakeRouter(); router.seed(USER_PATH, { model: 'openai/gpt-6.1-sol' })
    const rt = await mount({ router, catalogue: { status: 503, body: { service_unavailable: true, code: 'router_not_configured' } } })
    eq(rt.chipText(), 'openai/gpt-6.1-…'); eq(rt.chip().props['aria-label'], 'Model: openai/gpt-6.1-sol')
  })
  await check('I: the browser asks only the catalogue route and the Studio prefs routes, same-origin, never with a user id; the catalogue once', async () => {
    const router = fakeRouter()
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } }); await rt.open(); await rt.pick('best')
    ok(rt.fetchLog.length >= 4)
    for (const entry of rt.fetchLog) {
      ok(entry.url === '/api/models/catalogue' || entry.url === '/api/model-choice/prefs' || /^\/api\/model-choice\/prefs\/deck\/sess-fixture-1$/.test(entry.url), entry.url)
      eq(entry.init.credentials, 'same-origin'); eq(entry.init.cache, 'no-store'); ok(!/user-fixture|me@example/.test(JSON.stringify(entry)), 'no user id or email in a request')
    }
    eq(rt.fetchLog.filter(entry => entry.url === '/api/models/catalogue').length, 1)
  })

  await check('I: two pickers on one page share one catalogue request', async () => {
    const rt = await mount({ body: m => function Two() { return { type: 'div', props: { children: [{ type: m.component.ModelPicker, props: { sessionId: null } }, { type: m.component.ModelPicker, props: { sessionId: null } }] } } } })
    eq(rt.all(node => node.props?.['data-mpick'] === 'chip').length, 2); eq(rt.fetchLog.filter(entry => entry.url === '/api/models/catalogue').length, 1)
  })

  // ---- J. a11y ------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('J: the trigger is a labelled button that says it opens a dialog and whether it is open (real React, real Radix)', () => {
    const m = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
    const { picker, component } = m
    const body = json(FIXTURE), catalogue = m.choice.withPresets(m.cat.parseCatalogue(body), body)
    const view = (extra = {}) => renderToStaticMarkup(real.react.createElement(component.ModelPickerView, {
      label: picker.chipLabel({ kind: 'tier', tier: 'balanced' }, catalogue), stateKind: 'tier', scope: 'user', mode: 'account', ready: true, menu: picker.pickerMenu({ catalogue, state: { kind: 'tier', tier: 'balanced' } }), saveNote: '', open: false, onOpenChange() {}, view: 'main', onView() {}, onPick() {}, ...extra,
    }))
    const html = view()
    ok(/^<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="[^"]+" data-state="closed" class="mpick-chip" aria-label="Model: Balanced" title="Model: Balanced"/.test(html), html.slice(0, 220))
    ok(html.includes('<span class="mpick-label">Balanced</span>') && /aria-hidden="true"/.test(html), 'the caret is hidden from readers')
    ok(!/disabled/.test(html), 'enabled'); ok(/disabled=""/.test(view({ disabled: true })), 'disabled when asked'); ok(/disabled=""/.test(view({ ready: false })) && /aria-busy="true"/.test(view({ ready: false })))
    ok(/class="mpick-chip chip-end"/.test(view({ className: 'chip-end' })), 'className goes on the chip'); ok(/<span class="mpick-sr" role="status"/.test(html), 'a live region')
  })
  await check('J: the menu: a labelled dialog described by its notes; items are buttons with a pressed state; hints read as words; the groups are labelled (real React)', async () => {
    const rt = await mount(); await rt.open()
    const menu = rt.menu(); eq(menu.props['aria-label'], 'Choose model'); const notes = rt.find(node => node.props?.className === 'mpick-notes'); eq(menu.props['aria-describedby'], notes.props.id); ok(notes.props.id)
    eq(menu.props.side, 'top'); eq(menu.props.className, 'mpick-menu')
    ok(rt.items().every(item => item.node.type === 'button' && item.node.props.type === 'button' && typeof item.pressed === 'boolean'))
    const group = rt.find(node => node.props?.role === 'group'); eq(group.props['aria-label'], 'Model')
    const m = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
    const body = json(FIXTURE), catalogue = m.choice.withPresets(m.cat.parseCatalogue(body), body)
    const panel = (state, view = 'main') => renderToStaticMarkup(real.react.createElement(m.component.ModelPickerPanel, { menu: m.picker.pickerMenu({ catalogue, state }), view, notesId: 'n1', scope: 'user', saveNote: NOTES.account, onView() {}, onPick() {} }))
    const html = panel({ kind: 'tier', tier: 'best' })
    eq((html.match(/aria-pressed="true"/g) ?? []).length, 1); eq((html.match(/aria-pressed="false"/g) ?? []).length, 3); eq((html.match(/<button type="button"/g) ?? []).length, (html.match(/<button/g) ?? []).length)
    ok(html.includes('role="group" aria-label="Model"') && html.includes('id="n1"')); ok(html.includes('<span class="mpick-hint" aria-hidden="true">$$$</span><span class="mpick-sr">, cost 3 of 3</span>'), 'the hint is read as words')
    ok(panel({ kind: 'auto' }, 'models').includes('role="group" aria-label="More models…"') && panel({ kind: 'auto' }, 'models').includes('>Back<'))
  })
  await check('J: Escape, a click outside and focus return are Radix Popover\'s and the picker leaves them alone', () => {
    const source = read(FILES.component).replace(/\/\*[\s\S]*?\*\//g, '')
    ok(/from "@radix-ui\/react-popover"/.test(source) && /PopoverPrimitive\.Content/.test(source) && /PopoverPrimitive\.Portal/.test(source))
    for (const prop of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside', 'onFocusOutside', 'onCloseAutoFocus', 'onOpenAutoFocus', 'modal=', 'forceMount']) ok(!source.includes(prop), `the picker does not override ${prop}`)
    const dist = fs.readFileSync(path.join(root, 'node_modules/@radix-ui/react-popover/dist/index.js'), 'utf8')
    ok(/onEscapeKeyDown/.test(dist) && /triggerRef\.current\?\.focus\(\)/.test(dist), 'the installed Radix closes on Escape and puts focus back on the trigger')
    eq(JSON.parse(read('package.json')).dependencies['@radix-ui/react-popover'], '1.1.4', 'the version this was checked against is the pinned one')
  })
  await check('J: useModelChoice is exported (from the picker\'s module too) and gives a caller the choice and select', async () => {
    const rt = await mount({ body: m => { eq(typeof m.component.useModelChoice, 'function'); eq(m.component.useModelChoice, m.hook.useModelChoice); return function Probe(p) { const api = m.component.useModelChoice(p.sessionId); return { type: 'probe', props: { api } } } }, props: { sessionId: 'sess-fixture-1' } })
    const api = () => rt.find(node => node.type === 'probe').props.api
    eq(api().ready, true); eq(api().choice, null); eq(api().scope, 'deck'); deep(api().state, { kind: 'auto' })
    deep(await api().select({ tier: 'best' }), { kind: 'saved', choice: { tier: 'best' } }); await rt.settle()
    deep(api().choice, { tier: 'best' }); eq(api().saveNote, NOTES.account)
  })

  // ---- K. css -------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('K: the chip is 24 px tall and has no width of its own', () => {
    const css = postcss.parse(read(FILES.css))
    const chip = []
    css.walkRules(rule => { if (rule.selector === '.mpick-chip') chip.push(...rule.nodes.filter(node => node.type === 'decl')) })
    const get = prop => chip.filter(decl => decl.prop === prop).map(decl => decl.value)
    deep(get('height'), ['24px']); deep(get('width'), [], 'no width'); deep(get('max-width'), ['100%']); deep(get('min-height'), []); deep(get('box-sizing'), ['border-box'])
    ok(get('min-width').every(value => /^\d+px$/.test(value) && Number.parseInt(value) <= 44), 'only a small minimum')
    let any = false; css.walkRules(rule => { if (/\.mpick-chip/.test(rule.selector) && rule.parent.type !== 'atrule') rule.walkDecls('width', () => { any = true }) }); ok(!any, 'no rule gives the chip a width')
  })
  await check('K: truncation: the label can shrink and is cut with an ellipsis', () => {
    const css = postcss.parse(read(FILES.css)); const label = {}
    css.walkRules(rule => { if (rule.selector === '.mpick-label') rule.walkDecls(decl => { label[decl.prop] = decl.value }) })
    deep(label, { 'min-width': '0', overflow: 'hidden', 'text-overflow': 'ellipsis' })
  })
  await check('K: on phones (640 px and below) the hit area is 44 px tall and 44 px wide while the chip stays 24 px; the rows are 44 px', () => {
    const css = postcss.parse(read(FILES.css))
    const phone = []; css.walkAtRules('media', at => { if (at.params === '(max-width: 640px)') phone.push(at) }); eq(phone.length, 1)
    const decls = selector => { const out = {}; phone[0].walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { out[decl.prop] = decl.value }) }); return out }
    const px = value => Number.parseInt(value)
    const before = decls('.mpick-chip::before'); eq(before.content, '""'); eq(before.position, 'absolute')
    ok(24 + Math.abs(px(before.top)) + Math.abs(px(before.bottom)) >= 44, `the pseudo-element grows 24 px to ${24 + Math.abs(px(before.top)) + Math.abs(px(before.bottom))}`); ok(px(before.top) < 0 && px(before.bottom) < 0)
    ok(px(decls('.mpick-chip')['min-width']) >= 44, 'at least 44 px wide'); ok(!('height' in decls('.mpick-chip')), 'the visual height is not changed on phones')
    ok(px(decls('.mpick-item')['min-height']) >= 44)
    const base = []; css.walkRules(rule => { if (rule.selector === '.mpick-item' && rule.parent.type === 'root') rule.walkDecls('min-height', decl => base.push(decl.value)) }); deep(base, ['32px'])
    ok(!/\.mpick-chip[^{]*\{[^}]*pointer-events:\s*none/.test(read(FILES.css)), 'the pseudo-element takes the click')
  })
  await check('K: every rule is scoped to mpick-*, text sizes are small and few, the only colours are the theme\'s tokens, and the accent is the focus ring alone', () => {
    const text = read(FILES.css); const css = postcss.parse(text)
    css.walkRules(rule => { if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return; for (const selector of rule.selectors) ok(/^\.mpick-/.test(selector), `scoped: ${selector}`) })
    css.walkDecls('font-size', decl => ok(['11px', '12px', '13px'].includes(decl.value), `${decl.parent.selector}: ${decl.value}`))
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), 'no hex colours')
    for (const match of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/hsl\(([^)]*)\)/g)) ok(/^var\(--(ring|border|popover|popover-foreground|muted-foreground),/.test(match[1]), match[0])
    const ringUses = []; css.walkDecls(decl => { if (/--ring/.test(decl.value)) ringUses.push(decl.prop) }); ok(ringUses.length >= 2 && ringUses.every(prop => prop === 'outline'), `the accent: ${ringUses}`)
    css.walkDecls(decl => { if (/^(background|background-color|color|border-color)$/.test(decl.prop)) ok(!/(--ring|rgb\(|hsl\(var\(--(?!popover|border|muted|popover-foreground))/.test(decl.value), `${decl.parent.selector} ${decl.prop}`) })
    ok(/prefers-reduced-motion/.test(text))
  })

  // ---- L. identity -------------------------------------------------------------------------------------------------------------------------------------------------
  await check('L: nothing in the app imports the picker (it is placed by FRONTEND-1), so flag off the app is the base', () => {
    let hits = ''
    try { hits = git('grep', '-l', '-E', 'model-choice/model-picker|use-model-choice|studio-model-picker|model-picker\\.css', 'HEAD', '--', 'app', 'components', 'lib', 'hooks', 'pages', 'middleware.ts', 'next.config.mjs', 'next.config.js') } catch { hits = '' }
    deep(hits.split('\n').filter(Boolean).map(line => line.replace(/^HEAD:/, '')).filter(file => !PICKER_FILES.includes(file)), [], 'no other file mentions it')
    const working = execFileSync('grep', ['-rlE', 'model-choice/model-picker|use-model-choice|studio-model-picker', 'app', 'components', 'lib', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean)
    deep(working.filter(file => !PICKER_FILES.includes(file)), [], 'nor does the working tree')
  })
  await check('L: the new files hold no credential-shaped literal and no long hex', () => {
    const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
    for (const rel of PICKER_FILES) { const text = read(rel).replace(/credentials: "same-origin"/g, '').replace(/headers\.Authorization !== `Bearer \$\{KEY\}`/g, ''); ok(!CRED.test(text), rel); ok(!/[A-Fa-f0-9]{40,}/.test(text), `${rel}: no long hex`) }
  })
  const own = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%H %s', `${PICKER_BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [head, ...names] = block.split('\n')
    if (/^[0-9a-f]{40} Model choice: /.test(head)) own.push({ commit: head.slice(0, 40), names: names.filter(Boolean) })
  }
  if (own.length === 0 && extraCommitted.length === 0) {
    if (!quiet) console.log('SKIP L  nothing of the picker committed on top of 8e735ca3 yet (the scope check reads PICKER_BASE..HEAD only)')
  } else {
    await check('L: the picker\'s own commits ("Model choice: ...") add exactly its files; the only existing file they edit is the strip list', async () => {
      const touched = new Set(own.flatMap(entry => entry.names))
      const status = git('diff', '--name-status', PICKER_BASE, own[0].commit).split('\n').filter(Boolean).map(line => line.split('\t')).filter(row => touched.has(row[1]))
      deep([...status.filter(row => row[0] === 'A').map(row => row[1]), ...extraCommitted].sort(), PICKER_FILES)
      deep(status.filter(row => row[0] !== 'A').map(row => `${row[0]} ${row[1]}`), [`M ${STRIP}`])
    })
    await check('L: the strip list names the picker\'s files, so the registry hides them from the older scope checks, and it only gained lines', async () => {
      const strip = await import(`${path.join(root, STRIP)}?t=${Date.now()}`)
      for (const rel of PICKER_FILES) ok(strip.MODEL_CHOICE_SCOPE_FILES.has(rel), rel)
      const reg = await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)
      for (const rel of PICKER_FILES) ok(reg.LATER_CHANGE_FILES.has(rel), rel)
      const edit = git('diff', '-U0', PICKER_BASE, own[0].commit, '--', STRIP).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      ok(edit.length > 0 && edit.filter(line => line.startsWith('-')).length <= 1, `${edit.length} changed lines`)
    })
  }

  return { checks, failures }
}

// ---- run -------------------------------------------------------------------------------------------------------------------------------------------------------------
const main = await suite()
if (main.failures.length) {
  for (const failure of main.failures) console.error(`FAIL ${failure}`)
  console.error(`${main.failures.length} of ${main.checks + main.failures.length} checks failed`)
  process.exit(1)
}
console.log(`PASS A-L  ${main.checks} checks`)
if (process.env.MODEL_PICKER_NO_MUTANTS === '1') process.exit(0)

// ---- M. mutants: each must make the suite fail -------------------------------------------------------------------------------------------------------------------------
const P = FILES.picker, H = FILES.hook, C = FILES.component, S = FILES.css
const MUTANTS = [
  ['picker: a model needs only one group', P, 'return first.filter(slug => rest.every(list => list.includes(slug)))', 'return first.filter(slug => rest.every(() => true))'],
  ['picker: a closed group is skipped', P, '    if (!group) return []\n', '    if (!group) continue\n'],
  ['picker: the common models are not sorted', P, '.sort((a, b) => modelName(catalogue, a).localeCompare(modelName(catalogue, b)))', ''],
  ['picker: a choice is written to imagery too', P, 'for (const group of PICKER_GROUPS) out[group] = choiceValue(choice)', "for (const group of PICKER_GROUPS) out[group] = choiceValue(choice)\n  out.imagery = choiceValue(choice)"],
  ['picker: a choice is written to one group', P, 'for (const group of PICKER_GROUPS) out[group] = choiceValue(choice)', 'out[PICKER_GROUPS[0]] = choiceValue(choice)'],
  ['picker: Auto is not the default', P, 'choice === null ? P2_DEFAULT_CHOICE', "choice === null ? 'balanced'"],
  ['picker: the chip shows the hint', P, 'return { text: label, full: label } }', 'return { text: `${label} ${tierMeta(state.tier).hint}`, full: label } }'],
  ['picker: the chip shows the whole model name', P, 'return { text: shortName(name), full: name }', 'return { text: name, full: name }'],
  ['picker: the short name has no ellipsis', P, ".trimEnd()}…`", ".trimEnd()}`"],
  ['picker: the short name is long', P, 'export const PICKER_SHORT_MAX = 16', 'export const PICKER_SHORT_MAX = 40'],
  ['picker: the tiers are listed dearest first', P, "['economy', 'balanced', 'best']", "['best', 'balanced', 'economy']"],
  ['picker: the new-deck note names the deck', P, "export const PICKER_SCOPE_USER = 'Applies to new decks'", "export const PICKER_SCOPE_USER = 'Applies to this deck'"],
  ['picker: the device note claims the account', P, "'not-configured': 'Saved on this device for now'", "'not-configured': 'Saved to your account'"],
  ['picker: the device note is silent about an unreachable account', P, "return reason === 'unreachable' ? PICKER_SAVE_NOTE.unreachable : PICKER_SAVE_NOTE['not-configured']", "return PICKER_SAVE_NOTE['not-configured']"],
  ['picker: the models\' cost_hint is ignored', P, 'return hints[0] !== null && hints.every', 'return false && hints.every'],
  ['picker: any model is on offer', P, "return typeof choice.model === 'string' && commonModels(catalogue).includes(choice.model)", "return typeof choice.model === 'string'"],
  ['picker: a dropped model stays shown', P, "return commonModels(catalogue).includes(state.model) ? state : PICKER_AUTO", 'return state'],
  ['picker: a dropped tier stays shown', P, "return tierOffered(catalogue, state.tier) ? state : PICKER_AUTO", 'return state'],
  ['picker: the deck ignores the default', P, 'out[group] = deck && deck[group] !== P2_DEFAULT_CHOICE ? deck[group] : user[group]', 'out[group] = deck ? deck[group] : user[group]'],
  ['picker: the deck ignores its own choice', P, 'out[group] = deck && deck[group] !== P2_DEFAULT_CHOICE ? deck[group] : user[group]', 'out[group] = user[group]'],
  ['picker: a mix reads as the first group', P, 'if (PICKER_GROUPS.some(group => choices[group] !== first)) return MIXED\n', ''],
  ['picker: every tier is offered', P, 'return group === null || presetModel(catalogue, group, tier) !== null })', 'return true })'],
  ['picker: the session id is trusted', P, 'export const deckIdFromSessionId = (sessionId: string | null | undefined): string | null => (sessionId ?', 'export const deckIdFromSessionId = (sessionId: string | null | undefined): string | null => (sessionId ? sessionId : null) || (sessionId ?'],
  ['picker: Auto does not name the default', P, 'detail: inheritedLabel ? `Your default: ${inheritedLabel}` : PICKER_AUTO_DETAIL', 'detail: PICKER_AUTO_DETAIL'],
  ['picker: More is always offered', P, 'const more = common.length > 0 ?', 'const more = true ?'],
  ['picker: a mix is reported as Auto', P, "state.kind === 'mixed' ? PICKER_MIXED_LABEL : PICKER_AUTO_LABEL", 'PICKER_AUTO_LABEL'],
  ['hook: the flag is loose', H, 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE)'],
  ['hook: the flag needs the Pass 2 flag', H, 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"', 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true"'],
  ['hook: the catalogue is asked with its flag off', H, '  if (!CATALOGUE_ROUTE_ON) return null\n', ''],
  ['hook: another catalogue endpoint', H, 'await fetch(MODEL_CATALOG_ENDPOINT, {', 'await fetch(`${MODEL_CATALOG_ENDPOINT}?include_available=true`, {'],
  ['hook: credentials leave the origin', H, 'credentials: "same-origin", cache: "no-store" })\n  let body', 'credentials: "include", cache: "no-store" })\n  let body'],
  ['hook: the deck scope is never used', H, 'deckId && loaded?.deckState === "ok" ? { kind: "deck", deckId } : USER_SCOPE', 'USER_SCOPE'],
  ['hook: an unavailable deck scope is used', H, 'if (answer.deckUnavailable) deckState = answer.deckUnavailable\n          else {', 'if (false) deckState = answer.deckUnavailable\n          else {'],
  ['hook: the default is not loaded for a deck', H, 'const user = await runtime.store.loadChoices(USER_SCOPE)', 'const user = { choices: modelChoiceDefaults() }'],
  ['hook: a pick that is not on offer is written', H, '|| !offerable(now.catalogue, choice)', ''],
  ['hook: a second pick is taken while saving', H, 'if (!now.loaded || busy.current ||', 'if (!now.loaded ||'],
  ['hook: a conflict is ignored', H, 'if ("conflict" in result && result.conflict) {', 'if (false) {'],
  ['hook: a refusal is not put back', H, '      put(own)\n      outcome = { kind: "refused" }', '      outcome = { kind: "refused" }'],
  ['hook: a refusal is reported', H, '      words = MODEL_CHOICE_REFUSED\n      reported = undefined', '      words = MODEL_CHOICE_REFUSED\n      reported = choice'],
  ['hook: the conflict is reported as the pick', H, 'reported = choiceOfState(pickerStateOf(mergeChoices(target.kind === "deck" ? now.loaded.user : saved, target.kind === "deck" ? saved : null)))', 'reported = choice'],
  ['hook: onChange is never called', H, 'if (reported !== undefined && notify) notify(reported)', 'if (false) void notify'],
  ['hook: onChange is called before the save', H, '    let result: ModelChoiceSave | { mode: "session" }\n', '    if (latest.current.onChange) latest.current.onChange(choice)\n    let result: ModelChoiceSave | { mode: "session" }\n'],
  ['hook: a throwing storage is not noticed', H, 'storageOk: false }\n      }\n      if (!alive) return', 'storageOk: true }\n      }\n      if (!alive) return'],
  ['hook: a new session keeps the old choice', H, '  }, [runtime, deckId])', '  }, [runtime])'],
  ['hook: the catalogue is not shared', H, 'if (!pendingCatalogue) {', 'if (true) {'],
  ['component: it renders with the flag off', C, 'if (!STUDIO_MODEL_PICKER_ENABLED) return null', 'if (false) return null'],
  ['component: no accessible label', C, 'aria-label={`Model: ${label.full}`} ', ''],
  ['component: no title', C, 'title={`Model: ${label.full}`}', 'title=""'],
  ['component: the menu stays open after a pick', C, 'onPick={choice => { setOpen(false); setView("main"); void api.select(choice) }}', 'onPick={choice => { void api.select(choice) }}'],
  ['component: no pressed state', C, 'aria-pressed={option.selected} ', ''],
  ['component: Escape is swallowed', C, 'side="top" align="start"', 'onEscapeKeyDown={event => event.preventDefault()} side="top" align="start"'],
  ['component: focus is not returned', C, 'side="top" align="start"', 'onCloseAutoFocus={event => event.preventDefault()} side="top" align="start"'],
  ['component: the chip opens before the choices are in', C, 'const blocked = Boolean(disabled) || !ready', 'const blocked = Boolean(disabled)'],
  ['component: disabled is ignored', C, 'const blocked = Boolean(disabled) || !ready', 'const blocked = !ready'],
  ['component: className is dropped', C, '["mpick-chip", className].filter(Boolean).join(" ")', '"mpick-chip"'],
  ['component: no Back button', C, '{models ? <button type="button" className="mpick-item mpick-back"', '{false ? <button type="button" className="mpick-item mpick-back"'],
  ['component: the hint is read as symbols', C, '<span className="mpick-sr">, cost {costLevel(option.hint)} of 3</span>', ''],
  ['component: the menu is not described', C, ' aria-describedby={notesId}', ''],
  ['component: the menu has no label', C, ' aria-label={PICKER_MENU_LABEL}', ''],
  ['css: a 32 px chip', S, '  height: 24px;\n  min-width: 32px;', '  height: 32px;\n  min-width: 32px;'],
  ['css: the chip has a width', S, '  max-width: 100%;\n  margin: 0;', '  width: 120px;\n  max-width: 100%;\n  margin: 0;'],
  ['css: no hit area on phones', S, '  .mpick-chip::before { content: ""; position: absolute; top: -10px; right: 0; bottom: -10px; left: 0; }\n', ''],
  ['css: a 36 px hit area', S, 'top: -10px; right: 0; bottom: -10px; left: 0;', 'top: -6px; right: 0; bottom: -6px; left: 0;'],
  ['css: the hit area ignores clicks', S, 'content: ""; position: absolute;', 'content: ""; pointer-events: none; position: absolute;'],
  ['css: a 36 px row on phones', S, '  .mpick-item { min-height: 44px; }', '  .mpick-item { min-height: 36px; }'],
  ['css: the chip is 24 px on phones', S, '  .mpick-chip { min-width: 44px; }', '  .mpick-chip { min-width: 44px; height: 44px; }'],
  ['css: the label is not truncated', S, '.mpick-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }', '.mpick-label { min-width: 0; overflow: hidden; }'],
  ['css: an unscoped rule', S, '.mpick-list {', 'button { height: 24px; }\n.mpick-list {'],
  ['css: a coloured chip', S, '  background: transparent;\n  color: var(--mpick-fg, inherit);', '  background: #2563eb;\n  color: var(--mpick-fg, inherit);'],
  ['css: a larger text size', S, '  font-size: 12px;\n  font-weight: 500;', '  font-size: 16px;\n  font-weight: 500;'],
  ['css: an accent on the selected row', S, '.mpick-item[aria-pressed="true"] .mpick-name { font-weight: 600; }', '.mpick-item[aria-pressed="true"] .mpick-name { font-weight: 600; color: hsl(var(--ring, 250 90% 60%)); }'],
]
let caught = 0
const missed = []
for (const [name, rel, from, to] of MUTANTS) {
  const text = read(rel)
  if (!text.includes(from)) { missed.push(`${name} (target text not found)`); continue }
  overrides = { [rel]: text.replace(from, () => to) }
  let outcome
  try { outcome = await suite({ quiet: true, bail: true }) } catch (error) { outcome = { failures: [String(error)] } } finally { overrides = {} }
  if (outcome.failures.length > 0) caught++; else missed.push(name)
}
const scopeMutant = await suite({ quiet: true, bail: true, extraCommitted: ['lib/some-other-change.ts'] })
if (scopeMutant.failures.length > 0) caught++; else missed.push('scope: a stray committed file')
if (missed.length) {
  for (const name of missed) console.error(`MUTANT NOT CAUGHT: ${name}`)
  process.exit(1)
}
console.log(`PASS M  ${caught} of ${MUTANTS.length + 1} mutants caught`)
console.log(`test-studio-model-picker: ${main.checks} checks, ${caught} mutants, all passed`)
