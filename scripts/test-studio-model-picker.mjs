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
//   F. scope      no session: the reusable default ("Applies to new decks"), Auto alone; a session: this deck ("Applies to this deck"), following the default until it has a choice of its own, with TWO rows:
//                 "Auto: Deckster chooses" ({ auto: true }, ROUTER-2's model-router !42) and "Use my default: <it>" (the group left out)
//   G. fallbacks  router 503 -> this device ("Saved on this device for now"); no deck scope (404) or an unsaved / foreign session -> the default; the account unreachable or the routes off -> the device; a storage that throws
//   H. onChange   called after the save settles, with the choice in force; not for a refusal or an ignored pick; a conflict shows the saved choice; a second pick while one is saving is ignored
//   I. catalogue  no catalogue (route off, 503, 404, not JSON, wrong schema) leaves the tiers and no models; a kept model with no catalogue reads by its id; only Studio routes are asked, never a user id
//   J. a11y       the trigger and menu attributes (real React and real Radix), the pressed state, the labelled groups, the hint read as words; Escape, outside click and focus return are Radix's and are left alone
//   K. css        24 px chip, no width of its own, truncation, a 44 px hit area and 44 px rows at 640 px and below, every rule scoped, near-monochrome
//   S. slider     variant="slider" (stacked on #521): the gauge trigger, the stops [Auto, Fast, Balanced, Best] (+ extra presets, five at most), what each stop saves per scope, Custom, keyboard and aria, the 24 / 44 px
//                 sizes, "Advanced" closed, the one Auto switch, onChange, the slider's own commits ("Model choice slider: ...")
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
const SLIDER_STRIP = 'scripts/studio-model-slider-strip.mjs', SLIDER_BASE = '42f51ca9', SLIDER_SUBJECT = 'Model choice slider: ' // #521's head, and the subject of the slider's own commits
const SLIDER_ADDED = [FILES.sliderLib, FILES.option, FILES.slider, FILES.sliderCss, SLIDER_STRIP].sort()
const SLIDER_EDITED = [CHOICE_LIB, FILES.component, KIT, FIXTURE_SCRIPT, SELF, 'scripts/test-studio-model-choice.mjs', REGISTRY].sort()
const AUTO_FIXTURES = ['router-prefs-422-invalid-preference-auto.json', 'router-prefs-session-auto-200.json', 'router-put-session-auto-200.json'].map(name => `${FIX}/${name}`) // deck Auto (ROUTER-2, model-router !42)
const EDITED = ['components/studio-personal/intelligence-model-choice.tsx', SERVER, CHOICE_LIB, STRIP, 'scripts/test-studio-model-choice.mjs'] // the older files the picker's commits edit: the Intelligence chooser and its lib and server, for the deck's Auto
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
function fakeRouter({ deckScope = true, refuse = [], refuseAuto = false } = {}) {
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
    const isAuto = choice => choice !== null && typeof choice === 'object' && 'auto' in choice
    for (const choice of Object.values(body.preferences)) {
      if (!isAuto(choice)) continue
      if (!(init.method === 'PUT' && m[2])) return answer(422, { error: { message: 'Extra inputs are not permitted', type: 'invalid_request_error', code: 'extra_forbidden' } }) // the user routes have no auto
      if (refuseAuto || Object.keys(choice).length !== 1 || choice.auto !== true) return answer(422, json(`${FIX}/router-prefs-422-invalid-preference-auto.json`)) // exactly { "auto": true }, alone; the whole PUT is refused
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
  const seed = (pathname, choice) => store.set(pathname, Object.fromEntries(TEXT_GROUPS.map(group => [group, { ...(choice.auto ? { auto: true } : {}), preset: choice.tier ?? null, model: choice.model ?? null, updated_at: '2026-10-25T09:00:00Z' }])))
  return { fetch, store, log, state, seed, etagOf, bump: (pathname, rows) => store.set(pathname, rows) }
}
const kept = (router, pathname) => Object.fromEntries(Object.entries(router.store.get(pathname) ?? {}).map(([group, row]) => [group, row.auto === true ? 'auto' : row.preset ?? `model:${row.model}`]))

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
  const radixSlider = {
    Root: ({ children, ...p }) => ({ type: 'slider-root', props: { ...p, children } }),
    Track: ({ children, ...p }) => ({ type: 'slider-track', props: { ...p, children } }),
    Range: p => ({ type: 'slider-range', props: p }),
    Thumb: p => ({ type: 'span', props: { ...p, role: 'slider' } }),
  }
  const win = { localStorage: storage }
  const m = loadPicker({ read, react: hooks, jsx: { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' }, radix, radixSlider, lucide: new Proxy({}, { get: (_, name) => String(name) }), env: fullEnv, globals: { window: win, fetch: fetchImpl } })
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
    async open() { const trigger = rt.maybe(node => node.props?.['data-mpick'] === 'chip') ?? rt.maybe(node => node.props?.['data-mpick'] === 'gauge'); assert.ok(trigger, 'expected the trigger'); await rt.act(() => trigger.props.onClick()); assert.ok(rt.menu(), 'the menu opens') },
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
    gauge: () => rt.find(node => node.props?.['data-mpick'] === 'gauge', 'the gauge'),
    slider: () => rt.find(node => node.type === 'slider-root', 'the slider'),
    thumb: () => rt.find(node => node.type === 'span' && node.props.role === 'slider', 'the thumb'),
    stops: () => rt.all(node => node.props?.['data-mpick-stop']).map(node => ({ id: node.props['data-mpick-stop'], name: textOf(walk(node).find(n => n.props?.className === 'mpick-stop-name')), active: node.props['data-active'], node })),
    value: () => textOf(rt.find(node => node.props?.['data-mpick'] === 'value', 'the value')), // shown only when the choice is off the scale
    active: () => { const lit = rt.stops().filter(stop => stop.active === 'true'); return lit.length === 1 ? lit[0].name : null }, // the one stop whose label is bold
    async commit(i) { return rt.act(() => rt.slider().props.onValueCommit([i])) },
    async drag(i) { return rt.act(() => rt.slider().props.onValueChange([i])) },
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
    for (const choice of [{ model: 'google/gemini-3.8-flash' }, { model: 'x-ai/grok-4.6' }, { model: '../x' }, { tier: 'cheap' }, { model: 7 }, { auto: true }, { auto: false }]) deep(await api().select(choice), { kind: 'ignored' }, JSON.stringify(choice))
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
  await check('F: a deck with no choice of its own follows the default: the chip says it, and "Use my default: Best" is the selected row, beside "Auto: Deckster chooses"', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best')
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } })
    eq(rt.chipText(), 'Best', 'what applies'); await rt.open()
    deep(rt.items().map(item => [item.id, item.name, item.pressed]), [['auto', 'Auto: Deckster chooses', false], ['default', 'Use my default: Best', true], ['economy', 'Fast', false], ['balanced', 'Balanced', false], ['best', 'Best', false]], 'following: no tier row is selected')
    await rt.pick('economy'); eq(rt.chipText(), 'Fast'); await rt.open(); deep(rt.items().map(item => item.pressed), [false, false, true, false, false])
    await rt.pick('default')
    deep(JSON.parse(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, null])) }, '"use my default" is null on the wire')
    deep(kept(router, SESSION_PATH), {}, 'the group is left out'); eq(rt.chipText(), 'Best', 'back to the default'); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])))
    await rt.open(); eq(rt.item('default').pressed, true)
  })
  await check('F: the deck\'s own Auto is { "auto": true }: the chip says Auto, "Auto: Deckster chooses" is the selected row whatever the default, and onChange gets { auto: true }', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best'); const calls = []
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' }, onChange: choice => calls.push(choice) })
    await rt.open(); await rt.pick('auto')
    const put = router.log.filter(entry => entry.method === 'PUT'); eq(put.length, 1)
    eq(put[0].body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { auto: true }])) }), 'the router\'s session scope takes { "auto": true } for the three text groups')
    deep(kept(router, SESSION_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'auto']))); deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])), 'the default is untouched')
    eq(rt.chipText(), 'Auto'); eq(rt.chip().props['aria-label'], 'Model: Auto'); deep(calls, [{ auto: true }])
    await rt.open(); deep(rt.items().map(item => [item.id, item.pressed]), [['auto', true], ['default', false], ['economy', false], ['balanced', false], ['best', false]])
    const again = await mount({ router, props: { sessionId: 'sess-fixture-1' } })
    eq(again.chipText(), 'Auto', 'read back as Auto'); eq(again.chip().props['data-mpick-state'], 'auto'); await again.open(); eq(again.item('auto').pressed, true); eq(again.note('scope'), 'Applies to this deck')
    await rt.pick('default'); eq(rt.chipText(), 'Best'); deep(calls, [{ auto: true }, null]); deep(kept(router, SESSION_PATH), {})
  })
  await check('F: with no default of my own both deck rows are there ("Use my default: Auto" is selected for a deck with no choice); the groups of a deck that differ read as Custom', async () => {
    const router = fakeRouter()
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    deep(rt.items().slice(0, 2).map(item => [item.id, item.name, item.pressed]), [['auto', 'Auto: Deckster chooses', false], ['default', 'Use my default: Auto', true]]); eq(rt.chipText(), 'Auto')
    router.bump(SESSION_PATH, { content_writing: { preset: 'best', model: null, updated_at: 't' }, research_analysis: { auto: true, preset: null, model: null, updated_at: 't' } }) // the first group follows the default, the others differ
    const mixed = await mount({ router, props: { sessionId: 'sess-fixture-1' } }); eq(mixed.chipText(), 'Custom'); await mixed.open(); ok(mixed.items().every(item => item.pressed === false), 'no row is selected')
  })
  await check('F: on a deck only exactly { auto: true } is sent as Auto (false, "true", an extra key are ignored)', async () => {
    const router = fakeRouter()
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' }, body: m => function Probe(p) { const api = m.component.useModelChoice(p.sessionId); return { type: 'probe', props: { api } } } })
    for (const bad of [{ auto: false }, { auto: 'true' }, { auto: 1 }, { auto: true, x: 1 }, { auto: true, tier: 'best' }]) deep(await rt.find(node => node.type === 'probe').props.api.select(bad), { kind: 'ignored' }, JSON.stringify(bad))
    eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0); deep(kept(router, SESSION_PATH), {})
    deep(await rt.find(node => node.type === 'probe').props.api.select({ auto: true }), { kind: 'saved', choice: { auto: true } })
  })
  await check('F: the reusable default (no session, or no deck scope) has Auto alone, as null; no deck rows; a deck Auto is ignored there', async () => {
    for (const [name, extra] of [['no session', { props: { sessionId: null } }], ['no deck scope', { props: { sessionId: 'sess-fixture-1' }, router: fakeRouter({ deckScope: false }) }]]) {
      const router = extra.router ?? fakeRouter()
      const rt = await mount({ router, ...extra })
      await rt.open(); deep(rt.items().map(item => [item.id, item.name]), [['auto', 'Auto'], ['economy', 'Fast'], ['balanced', 'Balanced'], ['best', 'Best']], name); eq(rt.item('auto').detail, 'Deckster chooses')
      await rt.pick('best'); await rt.open(); await rt.pick('auto')
      deep(JSON.parse(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).init.body), { preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, null])) }, `${name}: Auto is null on the reusable default`)
      deep(kept(router, USER_PATH), {}, name)
    }
    const probe = await mount({ body: m => function Probe() { const api = m.component.useModelChoice(null); return { type: 'probe', props: { api } } } })
    deep(await probe.find(node => node.type === 'probe').props.api.select({ auto: true }), { kind: 'ignored' }); eq(probe.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0, 'nothing sent')
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

  await check('H: a router 422 invalid_preference_auto puts the earlier choice back, says it was Auto, reports nothing, and saves nothing; a deck Auto with extra keys or false is never sent', async () => {
    const router = fakeRouter({ refuseAuto: true }); router.bump(SESSION_PATH, Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'balanced', model: null, updated_at: 't' }]))); const calls = []
    const rt = await mount({ router, props: { sessionId: 'sess-fixture-1' }, onChange: choice => calls.push(choice) })
    eq(rt.chipText(), 'Balanced'); await rt.open(); await rt.pick('auto')
    deep(calls, []); eq(rt.chipText(), 'Balanced', 'put back'); eq(rt.status(), 'Auto cannot be saved for this presentation right now, so it keeps what it had.'); deep(kept(router, SESSION_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])))
    await rt.open(); await rt.pick('economy'); eq(rt.chipText(), 'Fast', 'a tier still saves'); eq(rt.status(), ''); deep(calls, [{ tier: 'economy' }])
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
    deep(await api().select({ auto: true }), { kind: 'saved', choice: { auto: true } }); await rt.settle(); deep(api().choice, { auto: true }, 'a deck\'s own Auto'); eq(api().deckOwn, 'auto')
    deep(await api().select(null), { kind: 'saved', choice: null }); await rt.settle(); deep(api().choice, null, 'use my default (the default is Auto)'); eq(api().deckOwn, 'default')
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

  // ---- S. slider --------------------------------------------------------------------------------------------------------------------------------------------------
  const mountSlider = (opts = {}) => mount({ ...opts, props: { sessionId: null, variant: 'slider', ...(opts.props ?? {}) } })
  const STOPS = [['economy', 'Fast', '$'], ['balanced', 'Balanced', '$$'], ['best', 'Best', '$$$']] // the scale: no Auto (it lives in Advanced)
  const catalogueOf = (m, body) => m.choice.withPresets(m.cat.parseCatalogue(body), body)
  const withOverride = async (rel, from, to, fn) => { const text = read(rel); assert.ok(text.includes(from), `override target in ${rel}`); const before = overrides; overrides = { ...overrides, [rel]: text.replace(from, () => to) }; try { return await fn() } finally { overrides = before } }
  const lastBody = rt => JSON.parse(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).init.body)
  const onUser = value => ({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, value])) })

  await check('S: variant="slider" renders nothing for every value but "true" (real React), and asks for nothing', async () => {
    for (const flag of [undefined, '', 'false', 'TRUE', ' true', '1']) {
      const m = loadPicker({ read, ...real, env: flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: flag } })
      eq(renderToStaticMarkup(real.react.createElement(m.component.ModelPicker, { sessionId: 'sess-fixture-1', variant: 'slider', disabled: true, className: 'x' })), '', `flag ${JSON.stringify(flag)}`)
    }
    for (const flag of [null, 'false', 'TRUE']) { const rt = await mountSlider({ flag }); eq(rt.tree, null); eq(rt.fetchLog.length, 0); eq(rt.storage.log.length, 0) }
  })
  await check('S: the trigger is a gauge icon button whose label names the current stop; the compact chip is still the default variant (real React and Radix)', () => {
    const m = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
    const html = renderToStaticMarkup(real.react.createElement(m.component.ModelPicker, { sessionId: null, variant: 'slider' }))
    ok(/^<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="[^"]+" data-state="closed" class="mpick-gauge" disabled="" aria-label="Model: Auto" title="Model: Auto" aria-busy="true" data-mpick="gauge"/.test(html), html.slice(0, 260))
    ok(html.includes('lucide-gauge') && html.includes('aria-hidden="true"') && !html.includes('mpick-chip'), 'a gauge icon, hidden from readers, no chip')
    for (const props of [{ sessionId: null }, { sessionId: null, variant: 'compact' }]) { const chip = renderToStaticMarkup(real.react.createElement(m.component.ModelPicker, props)); ok(chip.includes('mpick-chip') && !chip.includes('mpick-gauge'), JSON.stringify(props)) }
    const body = json(FIXTURE), catalogue = catalogueOf(m, body)
    const v = m.sliderLib.sliderView({ catalogue, state: { kind: 'tier', tier: 'balanced' } })
    const view = (extra = {}) => renderToStaticMarkup(real.react.createElement(m.slider.ModelSliderView, { label: v.label, valueText: v.valueText, stateKind: 'tier', scope: 'user', mode: 'account', ready: true, stops: v.stops, index: v.index, thumb: 'selected', advanced: { rows: [], models: [] }, saveNote: '', open: false, onOpenChange() {}, onDraft() {}, onCommit() {}, onAdvanced() {}, ...extra }))
    ok(/aria-label="Model: Balanced" title="Model: Balanced"/.test(view()) && !/disabled/.test(view()), 'enabled, labelled by the stop'); ok(/disabled=""/.test(view({ disabled: true })) && /disabled=""/.test(view({ ready: false })))
    ok(/class="mpick-gauge chip-end"/.test(view({ className: 'chip-end' })), 'className goes on the trigger'); ok(/<span class="mpick-sr" role="status"/.test(view()))
  })

  await check('S: the stops of the fixture catalogue are Fast $, Balanced $$, Best $$$ and NONE is Auto (it lives in Advanced); the same list is exported for a mock; SLIDER_AUTO_STOP is the one switch', () => {
    const m = loadPicker({ read, ...real, env: {} }); const catalogue = catalogueOf(m, json(FIXTURE))
    const flat = stops => stops.map(stop => [stop.id, stop.label, stop.hint])
    deep(flat(m.sliderLib.MODEL_PICKER_STOPS(catalogue)), STOPS); deep(flat(m.sliderLib.MODEL_PICKER_STOPS(null)), STOPS, 'no catalogue: the same'); deep(flat(m.sliderLib.MODEL_PICKER_DEFAULT_STOPS), STOPS)
    ok(!m.sliderLib.MODEL_PICKER_STOPS(catalogue).some(stop => stop.auto) && !m.sliderLib.MODEL_PICKER_DEFAULT_STOPS.some(stop => stop.auto), 'no stop is Auto')
    eq(m.component.MODEL_PICKER_STOPS, m.sliderLib.MODEL_PICKER_STOPS); eq(m.component.MODEL_PICKER_DEFAULT_STOPS, m.sliderLib.MODEL_PICKER_DEFAULT_STOPS); eq(m.component.SLIDER_AUTO_STOP, false); eq(m.sliderLib.SLIDER_AUTO_STOP, false)
    eq(m.component.SLIDER_CAPTION, 'Low = quicker, lower cost · High = deeper thinking, higher cost', 'the caption, as v3.1 prints it')
    const withAuto = m.sliderLib.MODEL_PICKER_STOPS(catalogue, { auto: true })
    deep(flat(withAuto), [['auto', 'Auto', null], ...STOPS], 'the switch on: Auto is the first stop'); deep(withAuto.map(stop => [stop.auto, stop.tier]), [[true, null], [false, 'economy'], [false, 'balanced'], [false, 'best']])
    deep([m.sliderLib.stopChoice(withAuto[0], 'user'), m.sliderLib.stopChoice(withAuto[0], 'deck'), m.sliderLib.stopChoice(withAuto[1], 'deck'), m.sliderLib.stopChoice(withAuto[3], 'user')], [null, { auto: true }, { tier: 'economy' }, { tier: 'best' }])
    const body = json(FIXTURE); body.groups.content_writing.presets.best = 'google/gemini-3.8-flash' // not certified for writing
    deep(m.sliderLib.MODEL_PICKER_STOPS(catalogueOf(m, body)).map(stop => stop.id), ['economy', 'balanced'], 'a tier a group does not certify is no stop')
    const hints = json(FIXTURE); for (const slug of ['moonshotai/kimi-k3', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-opus-5.5']) hints.models[slug].cost_hint = '$$'
    eq(m.sliderLib.MODEL_PICKER_STOPS(catalogueOf(m, hints))[2].hint, '$$', 'the models\' own cost_hint, when the groups agree')
  })
  await check('S: an extra catalogue preset joins the stops in cost-hint order, five at most; only a preset the Studio routes can save is a stop', () => {
    const m = loadPicker({ read, ...real, env: {} })
    const make = (extras, hint) => { const body = json(FIXTURE); for (const [id, slug] of extras) for (const group of TEXT_GROUPS) body.groups[group].presets[id] = slug; if (hint) for (const [slug, h] of Object.entries(hint)) body.models[slug].cost_hint = h; return catalogueOf(m, body) }
    const ids = (catalogue, presets, auto) => m.sliderLib.MODEL_PICKER_STOPS(catalogue, { ...(presets ? { presets: [...m.sliderLib.SLIDER_SAVABLE_PRESETS, ...presets] } : {}), ...(auto ? { auto } : {}) }).map(stop => stop.id)
    const ultra = make([['ultra', 'openai/gpt-6.1-sol']], { 'openai/gpt-6.1-sol': '$$$' })
    deep(ids(ultra), ['economy', 'balanced', 'best'], 'the routes cannot save "ultra" (best / balanced / economy): not offered')
    deep(ids(ultra, ['ultra']), ['economy', 'balanced', 'best', 'ultra'], 'dearest: last'); eq(m.sliderLib.MODEL_PICKER_STOPS(ultra, { presets: ['economy', 'balanced', 'best', 'ultra'] }).at(-1).label, 'Ultra')
    deep(ids(make([['ultra', 'openai/gpt-6.1-sol']], { 'openai/gpt-6.1-sol': '$$' }), ['ultra']), ['economy', 'balanced', 'ultra', 'best'], 'a $$ preset sits after Balanced')
    deep(ids(make([['ultra', 'openai/gpt-6.1-sol']], { 'openai/gpt-6.1-sol': '$' }), ['ultra']), ['economy', 'ultra', 'balanced', 'best'], 'a $ preset sits after Fast')
    deep(ids(make([['ultra', 'openai/gpt-6.1-sol']]), ['ultra']).at(-1), 'ultra', 'no hint: last')
    const two = make([['ultra', 'openai/gpt-6.1-sol'], ['mega', 'qwen/qwen3.8-flash']], { 'openai/gpt-6.1-sol': '$$$', 'qwen/qwen3.8-flash': '$$$' })
    deep(ids(two, ['ultra', 'mega']), ['economy', 'balanced', 'best', 'mega', 'ultra'], 'five at most: up to five presets by cost, ties by name'); deep(ids(two, ['ultra', 'mega'], true), ['auto', 'economy', 'balanced', 'best', 'mega'], 'with Auto on the scale it is one of the five: the dearest that does not fit is left out')
    const partial = json(FIXTURE); partial.groups.planning_strategy.presets.ultra = 'anthropic/claude-sonnet-5.5'; for (const group of ['content_writing', 'research_analysis']) partial.groups[group].presets.ultra = 'openai/gpt-6.1-sol'
    deep(ids(catalogueOf(m, partial), ['ultra']), ['economy', 'balanced', 'best'], 'a model one group does not certify: no stop')
    const odd = make([['Bad Id', 'openai/gpt-6.1-sol'], ['x'.repeat(40), 'openai/gpt-6.1-sol']]); deep(Object.keys(odd.allPresets.planning_strategy).sort(), ['balanced', 'best', 'economy'], 'an id that is not a plain preset name is not read')
  })
  await check('S: nothing chosen (Auto) shows NO thumb; a chosen stop has the filled thumb; a deck following the default has a HOLLOW thumb on the default\'s stop; a specific model or a mix is Custom, off the scale', async () => {
    const router = fakeRouter()
    let rt = await mountSlider({ router }); await rt.open()
    eq(rt.slider().props['data-thumb'], 'none'); deep(rt.slider().props.value, [0], 'it waits on the first stop, unseen'); eq(rt.slider().props.min, 0); eq(rt.slider().props.max, 2); eq(rt.slider().props.step, 1)
    eq(rt.thumb().props['aria-valuetext'], 'Auto, Deckster chooses'); eq(rt.gauge().props['aria-label'], 'Model: Auto'); eq(rt.gauge().props['data-mpick-state'], 'auto'); eq(rt.active(), null, 'no label is bold'); eq(rt.value(), 'Auto')
    deep(rt.stops().map(stop => [stop.id, stop.name, stop.active]), [['economy', 'Fast', 'false'], ['balanced', 'Balanced', 'false'], ['best', 'Best', 'false']], 'a label under each stop'); deep(rt.all(node => node.props?.className === 'mpick-tick').map(node => node.props['data-passed']), ['false', 'false', 'false'])
    for (const [i, tier] of [[0, 'economy'], [1, 'balanced'], [2, 'best']]) { seedWire(router, USER_PATH, tier); rt = await mountSlider({ router }); await rt.open(); eq(rt.slider().props['data-thumb'], 'selected', tier); deep(rt.slider().props.value, [i], tier); eq(rt.stops()[i].active, 'true'); eq(rt.active(), STOPS[i][1]); eq(rt.thumb().props['aria-valuetext'], `${STOPS[i][1]}, cost ${i + 1} of 3`) }
    const deckRouter = fakeRouter(); seedWire(deckRouter, USER_PATH, 'best')
    rt = await mountSlider({ router: deckRouter, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    eq(rt.slider().props['data-thumb'], 'hollow', 'a deck following the default'); deep(rt.slider().props.value, [2], 'on the default\'s stop'); eq(rt.active(), 'Best'); eq(rt.thumb().props['aria-valuetext'], 'Best, cost 3 of 3, your default'); eq(rt.gauge().props['aria-label'], 'Model: Best'); eq(rt.item('default').pressed, true)
    deckRouter.bump(SESSION_PATH, Object.fromEntries(TEXT_GROUPS.map(g => [g, { auto: true, preset: null, model: null, updated_at: 't' }]))); rt = await mountSlider({ router: deckRouter, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    eq(rt.slider().props['data-thumb'], 'none', 'the deck\'s own Auto: no thumb'); eq(rt.gauge().props['aria-label'], 'Model: Auto'); eq(rt.item('auto').pressed, true)
    const autoDefault = await mountSlider({ router: fakeRouter(), props: { sessionId: 'sess-fixture-1' } }); await autoDefault.open(); eq(autoDefault.slider().props['data-thumb'], 'none', 'a deck following a default of Auto')
    router.seed(USER_PATH, { model: 'anthropic/claude-opus-5.5' }); rt = await mountSlider({ router }); await rt.open()
    eq(rt.slider().props['data-thumb'], 'custom'); eq(rt.value(), 'Custom (Claude Opus 5.5)'); eq(rt.thumb().props['aria-valuetext'], 'Custom, off the scale'); eq(rt.gauge().props['aria-label'], 'Model: Custom (Claude Opus 5.5)'); eq(rt.gauge().props['data-mpick-state'], 'model'); ok(rt.stops().every(stop => stop.active === 'false'), 'no stop is lit')
    router.bump(USER_PATH, { planning_strategy: { preset: 'best', model: null, updated_at: 't' }, content_writing: { preset: 'economy', model: null, updated_at: 't' } }); rt = await mountSlider({ router }); await rt.open()
    eq(rt.slider().props['data-thumb'], 'custom'); ok(rt.value().startsWith('Custom'))
    router.seed(USER_PATH, { model: 'google/gemini-3.8-flash' }); rt = await mountSlider({ router }); await rt.open(); eq(rt.gauge().props['aria-label'], 'Model: Auto', 'a model the catalogue no longer opens reads as Auto'); eq(rt.slider().props['data-thumb'], 'none')
  })
  await check('S: each stop saves exactly its body on the reusable default (Fast, Balanced, Best are presets); Auto is saved from Advanced and clears (null); the thumb and the label follow', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best')
    const rt = await mountSlider({ router }); await rt.open()
    for (const [i, expected, held] of [[0, { preset: 'economy' }, 'economy'], [1, { preset: 'balanced' }, 'balanced'], [2, { preset: 'best' }, 'best'], [0, { preset: 'economy' }, 'economy']]) {
      await rt.commit(i)
      eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).url, '/api/model-choice/prefs'); deep(lastBody(rt), onUser(expected), `stop ${i}`)
      deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, held]))); deep(rt.slider().props.value, [i]); eq(rt.slider().props['data-thumb'], 'selected'); eq(rt.gauge().props['aria-label'], `Model: ${STOPS[i][1]}`); ok(rt.menu() !== undefined, 'the popover stays open')
    }
    await rt.pick('auto'); deep(lastBody(rt), onUser(null)); deep(kept(router, USER_PATH), {}); eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 5); eq(rt.menu(), undefined, 'a pick in Advanced closes the popover'); eq(rt.gauge().props['aria-label'], 'Model: Auto')
    await rt.open(); eq(rt.slider().props['data-thumb'], 'none', 'Auto: no thumb'); eq(rt.item('auto').pressed, true)
  })
  await check('S: on a deck Fast, Balanced, Best are presets written whole to the session scope and Auto, saved from Advanced, is { "auto": true }; the reusable default is untouched', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'balanced')
    const rt = await mountSlider({ router, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    deep(rt.slider().props.value, [1], 'following the default: its stop'); eq(rt.slider().props['data-thumb'], 'hollow'); eq(rt.gauge().props['data-mpick-scope'], 'deck'); const put = () => router.log.filter(entry => entry.method === 'PUT').at(-1)
    await rt.commit(1); eq(put().body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'balanced' }])) }), 'the default\'s own stop, clicked, is pinned for the deck'); eq(rt.slider().props['data-thumb'], 'selected')
    for (const [i, tier] of [[0, 'economy'], [2, 'best'], [1, 'balanced']]) { await rt.commit(i); eq(put().body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: tier }])) })); eq(new URL(put().url).pathname, SESSION_PATH); deep(kept(router, SESSION_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, tier]))) }
    eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).url, '/api/model-choice/prefs/deck/sess-fixture-1')
    await rt.pick('auto'); eq(put().body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { auto: true }])) })); deep(kept(router, SESSION_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'auto']))); eq(rt.gauge().props['aria-label'], 'Model: Auto')
    await rt.open(); eq(rt.slider().props['data-thumb'], 'none'); eq(rt.item('auto').pressed, true); await rt.pick('default'); deep(kept(router, SESSION_PATH), {}); eq(rt.gauge().props['aria-label'], 'Model: Balanced', 'use my default: back to the default\'s stop')
    deep(kept(router, USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])), 'the reusable default is untouched')
  })
  await check('S: a click on a stop\'s label saves like a commit; the chosen stop saves nothing again; a drag alone saves nothing and shows the stop under the thumb', async () => {
    const router = fakeRouter(); const rt = await mountSlider({ router }); await rt.open()
    await rt.drag(2); eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0, 'a drag saves nothing'); eq(rt.active(), 'Best'); deep(rt.slider().props.value, [2]); eq(rt.slider().props['data-thumb'], 'selected', 'a thumb being dragged is shown'); eq(rt.thumb().props['aria-valuetext'], 'Best'); eq(rt.gauge().props['aria-label'], 'Model: Auto', 'the trigger says what is saved')
    await rt.commit(2); eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 1); eq(rt.gauge().props['aria-label'], 'Model: Best'); eq(rt.slider().props['data-thumb'], 'selected')
    await rt.commit(2); eq(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 1, 'the same stop again: nothing')
    await rt.act(() => rt.stops()[0].node.props.onClick()); deep(lastBody(rt), onUser({ preset: 'economy' })); eq(rt.gauge().props['aria-label'], 'Model: Fast')
    ok(rt.stops().every(stop => stop.node.props['aria-hidden'] === 'true'), 'the labels are a pointer convenience: the slider is the accessible control')
  })
  await check('S: a stop reached while a save is in flight waits its turn: both are saved, in order, and the last one stands', async () => {
    const router = fakeRouter(); const calls = []
    const rt = await mountSlider({ router, onChange: choice => calls.push(choice) }); await rt.open()
    await rt.act(() => { rt.slider().props.onValueCommit([2]); rt.slider().props.onValueCommit([0]); rt.slider().props.onValueCommit([0]) })
    deep(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').map(entry => JSON.parse(entry.init.body).preferences.planning_strategy), [{ preset: 'best' }, { preset: 'economy' }]); eq(rt.gauge().props['aria-label'], 'Model: Fast'); deep(calls, [{ tier: 'best' }, { tier: 'economy' }])
  })
  await check('S: keyboard and aria: a slider over 0..2 in steps of 1 saves on commit only (Radix commits on every arrow, Home, End and Page key); the thumb is labelled, valued and described (real Radix)', () => {
    const source = read(FILES.slider).replace(/\/\*[\s\S]*?\*\//g, '')
    ok(/onValueCommit=\{values => onCommit\(values\[0\]\)\}/.test(source) && /onValueChange=\{values => onDraft\(values\[0\]\)\}/.test(source), 'the commit saves, the change only moves the draft')
    ok(/from "@radix-ui\/react-slider"/.test(source) && !/onPointer/.test(source) && (source.match(/onKeyDown/g) ?? []).length === 1 && /onKeyDown=\{firstStop\}/.test(source) && /\["ArrowLeft", "ArrowDown", "Home"\]\.includes\(event\.key\)/.test(source), 'Radix\'s own keys and pointer; ours only for the first stop while no thumb is on the scale')
    const dist = fs.readFileSync(path.join(root, 'node_modules/@radix-ui/react-slider/dist/index.js'), 'utf8')
    ok(/onHomeKeyDown: \(\) => !disabled && updateValues\(min, 0, \{ commit: true \}\)/.test(dist) && /onEndKeyDown: \(\) => !disabled && updateValues\(max, values\.length - 1, \{ commit: true \}\)/.test(dist) && /updateValues\(value2 \+ stepInDirection, atIndex, \{ commit: true \}\)/.test(dist), 'the installed Radix commits on Home, End, the arrows and Page keys')
    ok(/PAGE_KEYS = \["PageUp", "PageDown"\]/.test(dist) && /"ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"/.test(dist) && /"aria-valuemin": context\.min/.test(dist) && /role: "slider"/.test(dist) && /tabIndex: context\.disabled \? void 0 : 0/.test(dist))
    eq(JSON.parse(read('package.json')).dependencies['@radix-ui/react-slider'], '1.2.2', 'the version this was checked against is the pinned one')
    const m = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } }); const catalogue = catalogueOf(m, json(FIXTURE))
    const stops = m.sliderLib.MODEL_PICKER_STOPS(catalogue), v = m.sliderLib.sliderView({ catalogue, state: { kind: 'tier', tier: 'balanced' }, stops })
    const html = renderToStaticMarkup(real.react.createElement(m.slider.ModelSliderPanel, { label: v.label, valueText: v.valueText, scope: 'user', blocked: false, stops, index: v.index, thumb: 'selected', advanced: m.sliderLib.sliderAdvanced({ catalogue, state: { kind: 'tier', tier: 'balanced' }, scope: 'user' }), saveNote: NOTES.account, notesId: 'n1', captionId: 'c1', onDraft() {}, onCommit() {}, onAdvanced() {} }))
    const thumb = /<span role="slider"[^>]*>/.exec(html)?.[0] ?? ''
    for (const attribute of ['aria-label="Model"', 'aria-valuemin="0"', 'aria-valuemax="2"', 'aria-orientation="horizontal"', 'tabindex="0"', 'aria-valuetext="Balanced, cost 2 of 3"', 'aria-describedby="c1"', 'class="mpick-slider-thumb"']) ok(thumb.includes(attribute), `the thumb has ${attribute}: ${thumb}`)
    ok(html.includes('<p class="mpick-caption" id="c1" data-mpick="caption">Low = quicker, lower cost · High = deeper thinking, higher cost</p>'), 'the caption the thumb is described by')
    ok(html.includes('<ol class="mpick-stops"') && (html.match(/<li class="mpick-stop"/g) ?? []).length === 3 && (html.match(/aria-hidden="true"/g) ?? []).length >= 3)
    const disabled = renderToStaticMarkup(real.react.createElement(m.slider.ModelSliderPanel, { label: v.label, valueText: v.valueText, scope: 'user', blocked: true, stops, index: 2, thumb: 'selected', advanced: { rows: [], models: [] }, saveNote: '', onDraft() {}, onCommit() {}, onAdvanced() {} }))
    ok(/aria-disabled="true"/.test(disabled) && !/tabindex="0"/.test(disabled), 'a blocked slider takes no focus')
  })
  await check('S: Radix\'s keys, as the component sees them: each arrow, Home and End commits one index and each is saved in turn; with no thumb on the scale (Auto, Custom) Left, Down and Home choose the first stop', async () => {
    const router = fakeRouter(); let rt = await mountSlider({ router }); await rt.open()
    for (const i of [1, 2, 1, 0, 2]) await rt.commit(i)
    deep(rt.fetchLog.filter(entry => entry.init.method === 'PATCH').map(entry => JSON.parse(entry.init.body).preferences.planning_strategy), [{ preset: 'balanced' }, { preset: 'best' }, { preset: 'balanced' }, { preset: 'economy' }, { preset: 'best' }])
    deep(rt.slider().props.value, [2]); const before = rt.fetchLog.length
    for (const key of ['Home', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'End']) { await rt.act(() => rt.slider().props.onKeyDown({ key, preventDefault() {} })) } // a filled thumb: Radix's own keys, none of ours
    eq(rt.fetchLog.length, before, 'with a thumb on a stop the component adds no key of its own')
    for (const key of ['Home', 'ArrowLeft', 'ArrowDown']) {
      const r = await mountSlider({ router: fakeRouter() }); await r.open(); let prevented = 0
      await r.act(() => r.slider().props.onKeyDown({ key, preventDefault() { prevented++ } })); eq(prevented, 1, key); deep(lastBody(r), onUser({ preset: 'economy' }), `${key} from Auto: the first stop`)
      const model = fakeRouter(); model.seed(USER_PATH, { model: 'anthropic/claude-opus-5.5' }); const c = await mountSlider({ router: model }); await c.open(); await c.act(() => c.slider().props.onKeyDown({ key, preventDefault() {} })); deep(lastBody(c), onUser({ preset: 'economy' }), `${key} from Custom`)
    }
    const ignored = await mountSlider({ router: fakeRouter() }); await ignored.open(); await ignored.act(() => ignored.slider().props.onKeyDown({ key: 'ArrowRight', preventDefault() {} })); eq(ignored.fetchLog.filter(entry => entry.init.method === 'PATCH').length, 0, 'ArrowRight is Radix\'s: it moves, and commits, by itself')
  })
  await check('S: the dialog is the popover\'s (labelled, described by its notes); the slider is blocked while the choices load or when disabled', async () => {
    const rt = await mountSlider(); await rt.open(); const menu = rt.menu(); eq(menu.props['aria-label'], 'Choose model'); eq(menu.props['aria-describedby'], rt.find(node => node.props?.className === 'mpick-notes').props.id); ok(menu.props.className.includes('mpick-slider-menu'))
    eq(rt.slider().props.disabled, false); eq(rt.gauge().props.disabled, false)
    const off = await mountSlider({ props: { disabled: true } }); eq(off.gauge().props.disabled, true)
    const source = read(FILES.slider).replace(/\/\*[\s\S]*?\*\//g, ''); for (const prop of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside', 'onCloseAutoFocus', 'onOpenAutoFocus', 'modal=', 'forceMount']) ok(!source.includes(prop), `the slider does not override ${prop}`)
  })

  await check('S: "Advanced" is closed by default and holds "Auto: Deckster chooses" on BOTH scopes, the specific models, and on a deck "Use my default: <it>"; a pick there saves and closes', async () => {
    const m = loadPicker({ read, ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } }); const catalogue = catalogueOf(m, json(FIXTURE)); const stops = m.sliderLib.MODEL_PICKER_STOPS(catalogue)
    const panel = (extra = {}) => renderToStaticMarkup(real.react.createElement(m.slider.ModelSliderPanel, { label: 'Best', valueText: 'Best', scope: 'user', blocked: false, stops, index: 2, thumb: 'selected', advanced: m.sliderLib.sliderAdvanced({ catalogue, state: { kind: 'tier', tier: 'best' }, scope: 'user' }), saveNote: '', onDraft() {}, onCommit() {}, onAdvanced() {}, ...extra }))
    ok(/<details class="mpick-advanced" data-mpick="advanced"><summary>Advanced<\/summary>/.test(panel()) && !/<details[^>]* open/.test(panel()), 'a <details> with no open attribute')
    const router = fakeRouter(); seedWire(router, USER_PATH, 'best')
    let rt = await mountSlider({ router }); await rt.open()
    const advanced = rt.find(node => node.props?.['data-mpick'] === 'advanced'); eq(advanced.props.open, undefined, 'closed in the live tree too'); ok(walk(advanced).some(node => node.type === 'summary' && textOf(node) === 'Advanced'))
    deep(rt.items().map(item => [item.id, item.name, item.detail, item.pressed]), [['auto', 'Auto: Deckster chooses', null, false], ...COMMON.map(([slug, name, provider]) => [`model:${slug}`, name, provider, false])], 'the reusable default: Auto, then the six certified models common to the three groups'); eq(textOf(rt.find(node => node.props?.className === 'mpick-subhead')), 'Specific models')
    await rt.pick('model:openai/gpt-6.1-sol'); deep(lastBody(rt), onUser({ model: 'openai/gpt-6.1-sol' })); eq(rt.menu(), undefined, 'a pick in Advanced closes the popover'); eq(rt.gauge().props['aria-label'], 'Model: Custom (GPT-6.1 Sol)')
    await rt.open(); eq(rt.slider().props['data-thumb'], 'custom'); eq(rt.item('model:openai/gpt-6.1-sol').pressed, true); await rt.pick('auto'); deep(lastBody(rt), onUser(null), 'Auto on the reusable default clears'); deep(kept(router, USER_PATH), {})
    const deckRouter = fakeRouter(); seedWire(deckRouter, USER_PATH, 'best')
    rt = await mountSlider({ router: deckRouter, props: { sessionId: 'sess-fixture-1' } }); await rt.open()
    deep(rt.items().slice(0, 2).map(item => [item.id, item.name, item.pressed]), [['auto', 'Auto: Deckster chooses', false], ['default', 'Use my default: Best', true]]); eq(rt.items().length, 8)
    await rt.pick('auto'); eq(deckRouter.log.filter(entry => entry.method === 'PUT').at(-1).body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { auto: true }])) })); eq(rt.gauge().props['aria-label'], 'Model: Auto')
    await rt.open(); await rt.pick('model:moonshotai/kimi-k3'); eq(rt.gauge().props['aria-label'], 'Model: Custom (Kimi K3)'); await rt.open(); await rt.pick('default'); deep(kept(deckRouter, SESSION_PATH), {}); eq(rt.gauge().props['aria-label'], 'Model: Best', 'use my default: back to the default\'s stop')
  })
  await check('S: SLIDER_AUTO_STOP is the ONE switch: on, Auto is the first stop (and the reusable default\'s Advanced has no row for it); off (the default), Auto lives in Advanced', async () => {
    await withOverride(FILES.sliderLib, 'export const SLIDER_AUTO_STOP = false', 'export const SLIDER_AUTO_STOP = true', async () => {
      const router = fakeRouter(); seedWire(router, USER_PATH, 'best'); const rt = await mountSlider({ router }); await rt.open()
      eq(rt.slider().props.max, 3); deep(rt.stops().map(stop => stop.id), ['auto', 'economy', 'balanced', 'best']); eq(rt.slider().props['data-thumb'], 'selected'); deep(rt.slider().props.value, [3]); deep(rt.items().map(item => item.id).slice(0, 2), ['model:anthropic/claude-opus-5.5', 'model:deepseek/deepseek-v4.1-flash'], 'no Auto row on the reusable default')
      await rt.commit(0); deep(lastBody(rt), onUser(null), 'the Auto stop clears'); eq(rt.slider().props['data-thumb'], 'selected'); deep(rt.slider().props.value, [0]); eq(rt.gauge().props['aria-label'], 'Model: Auto')
      const deck = await mountSlider({ router: fakeRouter(), props: { sessionId: 'sess-fixture-1' } }); await deck.open(); eq(deck.slider().props['data-thumb'], 'hollow', 'a deck following a default of Auto: hollow on the Auto stop'); await deck.commit(0); eq(deck.fetchLog.filter(entry => entry.init.method === 'PATCH').at(-1).init.body, JSON.stringify({ preferences: Object.fromEntries(TEXT_GROUPS.map(g => [g, { auto: true }])) }), 'the Auto stop on a deck is { auto: true }')
    })
  })
  await check('S: onChange after a stop is saved: { tier }; Advanced\'s Auto is null on the reusable default and { auto: true } on a deck; not for a stop already chosen, a drag, a refusal or a deck scope that went away', async () => {
    const router = fakeRouter(); const calls = []
    const rt = await mountSlider({ router, onChange: choice => calls.push(choice) }); deep(calls, []); await rt.open()
    await rt.drag(1); deep(calls, []); await rt.commit(1); await rt.commit(1); deep(calls, [{ tier: 'balanced' }]); await rt.pick('auto'); deep(calls, [{ tier: 'balanced' }, null])
    const deckRouter = fakeRouter(); seedWire(deckRouter, USER_PATH, 'balanced')
    const deckCalls = []; const deck = await mountSlider({ router: deckRouter, props: { sessionId: 'sess-fixture-1' }, onChange: choice => deckCalls.push(choice) }); await deck.open(); await deck.commit(2); await deck.pick('auto'); deep(deckCalls, [{ tier: 'best' }, { auto: true }])
    const refused = fakeRouter({ refuseAuto: true }); const refusedCalls = []; const r = await mountSlider({ router: refused, props: { sessionId: 'sess-fixture-1' }, onChange: choice => refusedCalls.push(choice) }); await r.open(); await r.commit(2); await r.pick('auto')
    deep(refusedCalls, [{ tier: 'best' }]); eq(r.gauge().props['aria-label'], 'Model: Best', 'a refused Auto puts the stop back'); await r.open(); deep(r.slider().props.value, [2]); eq(r.status(), 'Auto cannot be saved for this presentation right now, so it keeps what it had.')
    const gone = fakeRouter(); const goneCalls = []; const g = await mountSlider({ router: gone, props: { sessionId: 'sess-fixture-1' }, onChange: choice => goneCalls.push(choice) }); await g.open(); gone.state.deckScope = false
    await g.drag(2); await g.commit(2) // dragged to Best, the deck scope has gone: the save falls back, and the thumb goes back with it
    deep(goneCalls, []); eq(g.slider().props['data-thumb'], 'none'); deep(g.slider().props.value, [0]); eq(g.status(), 'Choices for one presentation aren’t available yet, so your reusable defaults apply.'); eq(g.gauge().props['aria-label'], 'Model: Auto')
  })
  await check('S: as FRONTEND-1\'s v3.1 spec draws it: a 272 px popover headed "MODEL", a hollow dot at each stop (the ones the thumb has passed marked, none under the thumb), the current label bold, rows at 11.5 px with 10 px sub-text', async () => {
    const router = fakeRouter(); seedWire(router, USER_PATH, 'balanced')
    const rt = await mountSlider({ router }); await rt.open()
    const ticks = () => rt.all(node => node.props?.className === 'mpick-tick'); deep(ticks().map(node => node.props['data-passed']), ['true', 'true', 'false']); deep(ticks().map(node => node.props['data-current']), ['false', 'true', 'false']); ok(ticks().every(node => node.props['aria-hidden'] === 'true' && /^calc\(/.test(node.props.style.left)))
    eq(textOf(rt.find(node => node.props?.className === 'mpick-slider-title')), 'Model'); eq(rt.active(), 'Balanced')
    await rt.drag(0); deep(ticks().map(node => node.props['data-passed']), ['true', 'false', 'false'], 'the dots follow the thumb as it is dragged'); eq(rt.active(), 'Fast')
    const empty = await mountSlider(); await empty.open(); deep(empty.all(node => node.props?.className === 'mpick-tick').map(node => node.props['data-current']), ['false', 'false', 'false'], 'no thumb: every dot stays drawn, none marked passed'); deep(empty.all(node => node.props?.className === 'mpick-tick').map(node => node.props['data-passed']), ['false', 'false', 'false'])
    const css = postcss.parse(read(FILES.sliderCss)); const at = selector => { const out = {}; css.walkRules(rule => { if (rule.selector === selector && rule.parent.type === 'root') rule.walkDecls(decl => { out[decl.prop] = decl.value }) }); return out }
    eq(at('.mpick-slider-menu').width, '272px'); eq(at('.mpick-slider-menu')['font-size'], '11.5px'); eq(at('.mpick-slider-menu .mpick-detail, .mpick-slider-menu .mpick-hint, .mpick-slider-menu .mpick-notes')['font-size'], '10px')
    eq(at('.mpick-slider-title')['text-transform'], 'uppercase'); eq(at('.mpick-slider-title')['font-size'], '10px'); eq(at('.mpick-stop[data-active="true"] .mpick-stop-name')['font-weight'], '600')
    eq(at('.mpick-slider-root[data-thumb="none"] .mpick-slider-thumb')['border-color'], 'transparent', 'no thumb: unseen'); eq(at('.mpick-slider-root[data-thumb="none"] .mpick-slider-range').opacity, '0'); eq(at('.mpick-slider-root[data-thumb="hollow"] .mpick-slider-thumb').background, 'transparent', 'hollow'); eq(at('.mpick-slider-root[data-thumb="custom"] .mpick-slider-thumb')['border-style'], 'dashed')
    eq(at('.mpick-tick[data-current="true"]').opacity, '0')
  })
  await check('S: the sizes: a 24 px gauge on desktop and a 44 px hit area on phones; 44 px for the slider row, the stop labels and Advanced; every rule scoped, small text, near-monochrome', () => {
    const text = read(FILES.sliderCss); const css = postcss.parse(text)
    const decls = (selector, within) => { const out = {}; (within ?? css).walkRules(rule => { if (rule.selector === selector && (within || rule.parent.type === 'root')) rule.walkDecls(decl => { out[decl.prop] = decl.value }) }); return out }
    const gauge = decls('.mpick-gauge'); eq(gauge.width, '24px'); eq(gauge.height, '24px'); eq(gauge['box-sizing'], 'border-box')
    const phone = []; css.walkAtRules('media', at => { if (at.params === '(max-width: 640px)') phone.push(at) }); eq(phone.length, 1)
    const before = decls('.mpick-gauge::before', phone[0]); eq(before.content, '""'); eq(before.position, 'absolute'); const px = value => Number.parseInt(value)
    ok(24 + Math.abs(px(before.top)) + Math.abs(px(before.bottom)) >= 44 && 24 + Math.abs(px(before.left)) + Math.abs(px(before.right)) >= 44, 'a 44 x 44 hit area'); ok(px(before.top) < 0 && px(before.left) < 0)
    ok(px(decls('.mpick-slider-root', phone[0]).height) >= 44 && px(decls('.mpick-stop', phone[0])['min-height']) >= 44 && px(decls('.mpick-advanced > summary', phone[0])['min-height']) >= 44, 'the slider row, the stops and Advanced are 44 px on phones')
    eq(decls('.mpick-slider-root').height, '24px'); ok(!('pointer-events' in before), 'the hit area takes the click')
    css.walkRules(rule => { for (const selector of rule.selectors) ok(/^\.mpick-/.test(selector), `scoped: ${selector}`) })
    css.walkDecls('font-size', decl => ok(['10px', '11px', '11.5px'].includes(decl.value), `${decl.parent.selector}: ${decl.value}`)) // FRONTEND-1's v3.1: rows 11.5 px, sub-text and heading 10 px
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), 'no hex colours'); const ring = []; css.walkDecls(decl => { if (/--ring/.test(decl.value)) ring.push(decl.prop) }); ok(ring.length >= 3 && ring.every(prop => prop === 'outline'), `the accent is the focus ring alone: ${ring}`)
    css.walkDecls(decl => { if (/^(background|background-color|color|border-color)$/.test(decl.prop)) ok(!/(--ring|rgb\(|hsl\(var\(--(?!popover|border|muted))/.test(decl.value), `${decl.parent.selector} ${decl.prop}`) })
    ok(/mpick-slider-root\[data-thumb="custom"\] \.mpick-slider-thumb/.test(text) && /mpick-slider-root\[data-thumb="hollow"\] \.mpick-slider-thumb/.test(text) && /mpick-slider-root\[data-thumb="none"\] \.mpick-slider-thumb/.test(text), 'no thumb, a hollow one, a faint one off the scale'); ok(/prefers-reduced-motion/.test(text))
  })
  await check('S: the caption is exactly v3.1\'s, and the labels and the head say what the spec says', () => {
    const m = loadPicker({ read, ...real }); eq(m.sliderLib.SLIDER_CAPTION, 'Low = quicker, lower cost · High = deeper thinking, higher cost'); eq(m.sliderLib.SLIDER_ADVANCED_LABEL, 'Advanced'); eq(m.sliderLib.SLIDER_LABEL, 'Model'); eq(m.sliderLib.SLIDER_MAX_STOPS, 5)
    eq(m.sliderLib.SLIDER_CUSTOM_LABEL, 'Custom'); deep([...m.sliderLib.SLIDER_SAVABLE_PRESETS], ['economy', 'balanced', 'best'], 'the presets the Studio routes carry'); eq(m.sliderLib.SLIDER_AUTO_STOP, false, 'Auto lives in Advanced')
    const server = fs.readFileSync(path.join(root, SERVER), 'utf8'); ok(/const PRESETS = \['best', 'balanced', 'economy'\]/.test(server), 'the same three the server accepts')
    const spec = 'Low = quicker, lower cost · High = deeper thinking, higher cost'; ok(read(FILES.slider).includes('{SLIDER_CAPTION}') && read(FILES.sliderLib).includes(`'${spec}'`))
  })
  await check('L: nothing in the app imports the picker (it is placed by FRONTEND-1), so flag off the app is the base', async () => { // LATER-CHANGES: registry read (CHAT-CLEAN)
    const later = (await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)).LATER_CHANGE_FILES // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered after this one may mount the picker (chat clean: the composer); its files are its own
    let hits = ''
    try { hits = git('grep', '-l', '-E', 'model-choice/model-picker|use-model-choice|studio-model-picker|model-picker\\.css', 'HEAD', '--', 'app', 'components', 'lib', 'hooks', 'pages', 'middleware.ts', 'next.config.mjs', 'next.config.js') } catch { hits = '' }
    deep(hits.split('\n').filter(Boolean).map(line => line.replace(/^HEAD:/, '')).filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file) && !later.has(file)), [], 'no other file mentions it') // LATER-CHANGES: registry read (CHAT-CLEAN)
    const working = execFileSync('grep', ['-rlE', 'model-choice/model-picker|use-model-choice|studio-model-picker', 'app', 'components', 'lib', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean)
    deep(working.filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file) && !later.has(file)), [], 'nor does the working tree') // LATER-CHANGES: registry read (CHAT-CLEAN)
  })
  await check('L: the new files hold no credential-shaped literal and no long hex', () => {
    const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
    for (const rel of [...PICKER_FILES, ...SLIDER_ADDED]) { const text = read(rel).replace(/credentials: "same-origin"/g, '').replace(/headers\.Authorization !== `Bearer \$\{KEY\}`/g, ''); ok(!CRED.test(text), rel); ok(rel === SLIDER_STRIP || !/[A-Fa-f0-9]{40,}/.test(text), `${rel}: no long hex`) }
  })
  const own = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%H %s', `${PICKER_BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [head, ...names] = block.split('\n')
    if (/^[0-9a-f]{40} Model choice: /.test(head)) own.push({ commit: head.slice(0, 40), names: names.filter(Boolean) })
  }
  if (own.length === 0 && extraCommitted.length === 0) {
    if (!quiet) console.log('SKIP L  nothing of the picker committed on top of 8e735ca3 yet (the scope check reads PICKER_BASE..HEAD only)')
  } else {
    await check('L: the picker\'s own commits ("Model choice: ...") add exactly its files and the deck Auto fixtures, and edit only the Intelligence chooser, its lib and server, the strip list and their proof', async () => {
      const touched = new Set(own.flatMap(entry => entry.names))
      const status = git('diff', '--name-status', PICKER_BASE, own[0].commit).split('\n').filter(Boolean).map(line => line.split('\t')).filter(row => touched.has(row[1]))
      deep([...status.filter(row => row[0] === 'A').map(row => row[1]), ...extraCommitted].sort(), [...PICKER_FILES, ...AUTO_FIXTURES].sort())
      deep(status.filter(row => row[0] !== 'A').map(row => `${row[0]} ${row[1]}`).sort(), EDITED.map(file => `M ${file}`).sort())
    })
    await check('L: the strip list names the picker\'s files, so the registry hides them from the older scope checks, and it only gained lines', async () => {
      const strip = await import(`${path.join(root, STRIP)}?t=${Date.now()}`)
      for (const rel of [...PICKER_FILES, ...AUTO_FIXTURES]) ok(strip.MODEL_CHOICE_SCOPE_FILES.has(rel), rel)
      const reg = await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)
      for (const rel of [...PICKER_FILES, ...AUTO_FIXTURES]) ok(reg.LATER_CHANGE_FILES.has(rel), rel)
      const edit = git('diff', '-U0', PICKER_BASE, own[0].commit, '--', STRIP).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      ok(edit.length > 0 && edit.filter(line => line.startsWith('-')).length <= 3, `${edit.length} changed lines`)
    })
  }

  const sliderOwn = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%H %s', `${SLIDER_BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [head, ...names] = block.split('\n')
    if (head.slice(41).startsWith(SLIDER_SUBJECT)) sliderOwn.push({ commit: head.slice(0, 40), names: names.filter(Boolean) })
  }
  if (sliderOwn.length === 0) {
    if (!quiet) console.log('SKIP L  nothing of the slider committed on top of 42f51ca9 yet (the slider scope check reads SLIDER_BASE..HEAD only)')
  } else {
    await check('L: the slider\'s own commits ("Model choice slider: ...") add exactly its files and edit only #521\'s picker files, the catalogue helper, the two proofs and the registry; no app file, no route, no .env.example', async () => {
      const touched = new Set(sliderOwn.flatMap(entry => entry.names))
      const status = git('diff', '--name-status', SLIDER_BASE, sliderOwn[0].commit).split('\n').filter(Boolean).map(line => line.split('\t')).filter(row => touched.has(row[1]))
      deep([...status.filter(row => row[0] === 'A').map(row => row[1]), ...extraCommitted].sort(), SLIDER_ADDED)
      deep(status.filter(row => row[0] !== 'A').map(row => `${row[0]} ${row[1]}`).sort(), SLIDER_EDITED.map(file => `M ${file}`).sort())
      ok(!status.some(row => /^(app|pages|hooks)\//.test(row[1]) || row[1] === '.env.example' || /^components\/(?!model-choice\/)/.test(row[1])), 'nothing in the app')
      const subjects = git('log', '--no-merges', '--format=%s', `${SLIDER_BASE}..${sliderOwn[0].commit}`).split('\n').filter(Boolean); ok(subjects.every(subject => subject.startsWith(SLIDER_SUBJECT)), subjects.join(' | '))
    })
    await check('L: the slider strip names its files, the registry gains ONE line for it (no env block, no strip), and the older scope checks skip them', async () => {
      const strip = await import(`data:text/javascript,${encodeURIComponent(read(SLIDER_STRIP))}`)
      for (const rel of [...SLIDER_ADDED, ...SLIDER_EDITED]) ok(strip.MODEL_SLIDER_SCOPE_FILES.has(rel), rel)
      ok(strip.MODEL_SLIDER_BASE_COMMIT.startsWith(SLIDER_BASE) && strip.MODEL_SLIDER_BASE_COMMIT.length === 40); eq(strip.MODEL_SLIDER_SUBJECT, SLIDER_SUBJECT); eq(strip.MODEL_SLIDER_FLAG, 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE')
      const reg = await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)
      for (const rel of [...SLIDER_ADDED, ...SLIDER_EDITED]) ok(reg.LATER_CHANGE_FILES.has(rel), rel)
      const edit = git('diff', '-U0', SLIDER_BASE, sliderOwn[0].commit, '--', REGISTRY).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      eq(edit.length, 1); ok(edit[0].startsWith('+') && edit[0].includes('studio-model-slider-strip.mjs') && edit[0].includes('// LATER-CHANGE: '))
      ok(git('diff', '--name-only', SLIDER_BASE, sliderOwn[0].commit, '--', '.env.example', 'app') === '', 'no .env.example block, no app file')
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
const P = FILES.picker, H = FILES.hook, C = FILES.component, S = FILES.css, SL = FILES.sliderLib, SC = FILES.slider, SCSS = FILES.sliderCss
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
  // the slider variant
  ['slider: Auto is a stop', SL, 'export const SLIDER_AUTO_STOP = false', 'export const SLIDER_AUTO_STOP = true'],
  ['slider: nine stops', SL, 'export const SLIDER_MAX_STOPS = 5', 'export const SLIDER_MAX_STOPS = 9'],
  ['slider: the caption is lower-case', SL, "export const SLIDER_CAPTION = 'Low = quicker, lower cost · High = deeper thinking, higher cost'", "export const SLIDER_CAPTION = 'low = quicker, lower cost · high = deeper thinking, higher cost'"],
  ['slider: the caption says something else', SL, "export const SLIDER_CAPTION = 'Low = quicker, lower cost · High = deeper thinking, higher cost'", "export const SLIDER_CAPTION = 'low = cheap · high = good'"],
  ['slider: a preset the routes cannot save is a stop', SL, 'export const SLIDER_SAVABLE_PRESETS: readonly string[] = PICKER_TIERS', "export const SLIDER_SAVABLE_PRESETS: readonly string[] = [...PICKER_TIERS, 'ultra', 'mega']"],
  ['slider: the stops are not ordered by cost', SL, 'ranked.sort((a, b) => a.rank - b.rank || a.order - b.order)', 'ranked.sort((a, b) => a.order - b.order)'],
  ['slider: an extra preset needs one group only', SL, 'if (!slug || !offeredModels(catalogue, group).includes(slug)) return null', 'if (!slug) return null'],
  ['slider: a tier needs no certification', SL, 'if (tierOffered(catalogue, id)) ranked.push', 'if (true) ranked.push'],
  ['slider: Auto on a deck is null', SL, "(stop.auto ? (scope === 'deck' ? { auto: true } : null)", '(stop.auto ? null'],
  ['slider: Auto on the reusable default is a deck Auto', SL, "(stop.auto ? (scope === 'deck' ? { auto: true } : null)", '(stop.auto ? ({ auto: true })'],
  ['slider: a model sits on a stop', SL, "  if (state.kind === 'tier') return stops.findIndex(stop => stop.tier === state.tier)\n  return -1", "  if (state.kind === 'tier') return stops.findIndex(stop => stop.tier === state.tier)\n  return 0"],
  ['slider: Custom shows no thumb', SL, "return { stops, index, thumb: 'custom', label,", "return { stops, index, thumb: 'none', label,"],
  ['slider: the cost is not in the value text', SL, "const costWords = (hint: string | null) => (hint ? `, cost ${hint.length} of 3` : '')", "const costWords = (hint: string | null) => ''"],
  ['slider: Advanced holds the deck rows on the reusable default', SL, "const rows = args.scope === 'deck' ? head : (args.autoStop ?? SLIDER_AUTO_STOP) ? [] : head", 'const rows = head'],
  ['slider: Advanced has no deck rows', SL, "const rows = args.scope === 'deck' ? head :", "const rows = args.scope === 'deck' ? [] :"],
  ['slider: a plain id is any text', CHOICE_LIB, 'export const PRESET_ID = /^[a-z][a-z0-9_]{0,31}$/', 'export const PRESET_ID = /^.+$/'],
  ['slider: a following deck has a filled thumb', SL, "thumb: following ? 'hollow' : 'selected'", "thumb: 'selected'"],
  ['slider: Auto shows a thumb', SL, "if (state.kind === 'auto') return { stops, index, thumb: 'none',", "if (state.kind === 'auto') return { stops, index, thumb: 'selected',"],
  ['slider: Advanced\'s Auto keeps the short label', SL, "{ ...option, label: MODEL_CHOICE_AUTO_LABEL, detail: null }", 'option'],
  ['slider: the first-stop keys are lost', SC, 'if (!onScale && ["ArrowLeft", "ArrowDown", "Home"]', 'if (false && ["ArrowLeft", "ArrowDown", "Home"]'],
  ['slider: the first-stop keys fire with a thumb on a stop', SC, 'if (!onScale && ["ArrowLeft", "ArrowDown", "Home"]', 'if (["ArrowLeft", "ArrowDown", "Home"]'],
  ['slider: a dragged thumb is not shown', SC, 'const kind: ThumbKind = draft !== null ? "selected" : thumbKind', 'const kind: ThumbKind = thumbKind'],
  ['slider: the head hides Custom', SC, '{kind === "none" || kind === "custom" ? <span', '{false ? <span'],
  ['slider: a drag saves', SC, 'onValueChange={values => onDraft(values[0])}', 'onValueChange={values => { onDraft(values[0]); onCommit(values[0]) }}'],
  ['slider: a commit saves nothing', SC, 'onValueCommit={values => onCommit(values[0])}', 'onValueCommit={() => undefined}'],
  ['slider: the stop it sits on saves again', SC, "if (!stop || (!inFlight.current && view.thumb === 'selected' && index === view.index)) return", 'if (!stop) return'],
  ['slider: a following deck\'s stop saves nothing when clicked', SC, "view.thumb === 'selected' && index === view.index", 'index === view.index'],
  ['slider: a stop that waits is dropped', SC, 'if (next) save(next.choice)', 'if (next) void 0'],
  ['slider: the draft stays', SC, '    setDraft(null)\n    if (!stop', '    if (!stop'],
  ['slider: Advanced is open', SC, '<details className="mpick-advanced" data-mpick="advanced">', '<details className="mpick-advanced" data-mpick="advanced" open>'],
  ['slider: an Advanced pick keeps the popover open', SC, 'onAdvanced={choice => { setOpen(false); void api.select(choice) }}', 'onAdvanced={choice => { void api.select(choice) }}'],
  ['slider: the thumb has no label', SC, 'aria-label={SLIDER_LABEL} aria-valuetext', 'aria-valuetext'],
  ['slider: the thumb has no value text', SC, 'aria-valuetext={shown ? shown.label : valueText} ', ''],
  ['slider: the thumb is not described by the caption', SC, ' aria-describedby={captionId} />', ' />'],
  ['slider: the stop labels are read twice', SC, 'data-mpick-stop={stop.id} aria-hidden="true"', 'data-mpick-stop={stop.id}'],
  ['slider: the slider is not blocked', SC, 'disabled={blocked} data-thumb', 'data-thumb'],
  ['slider: the step is 2', SC, 'step={1}', 'step={2}'],
  ['slider: the trigger has no label', SC, 'aria-label={`Model: ${label}`} title=', 'title='],
  ['slider: the trigger opens before the choices are in', SC, 'const blocked = Boolean(disabled) || !ready', 'const blocked = Boolean(disabled)'],
  ['slider: a stop label is not clickable', SC, 'onClick={() => { if (!blocked) onCommit(i) }}', 'onClick={() => undefined}'],
  ['slider: the thumb kind is not on the slider', SC, 'data-thumb={kind} data-mpick="slider"', 'data-mpick="slider"'],
  ['slider: className is dropped', SC, '["mpick-gauge", className].filter(Boolean).join(" ")', '"mpick-gauge"'],
  ['slider: the variant is ignored', C, 'props.variant === "slider" ? <ModelPickerSlider {...props} /> :', 'false ? <ModelPickerSlider {...props} /> :'],
  ['slider: it renders with the flag off', C, 'if (!STUDIO_MODEL_PICKER_ENABLED) return null\n  return props.variant', 'return props.variant'],
  ['slider: the dots are not marked', SC, 'data-passed={onScale && i <= thumb ? "true" : "false"}', 'data-passed="false"'],
  ['slider: the dots are marked with no thumb', SC, 'data-passed={onScale && i <= thumb', 'data-passed={i <= thumb'],
  ['slider: the dot under the thumb is drawn', SC, 'data-current={kind !== "none" && i === thumb ? "true" : "false"}', 'data-current="false"'],
  ['slider css: a wide popover', SCSS, '.mpick-slider-menu { width: 272px;', '.mpick-slider-menu { width: 372px;'],
  ['slider css: a thin label', SCSS, '.mpick-stop[data-active="true"] .mpick-stop-name { font-weight: 600; }', '.mpick-stop[data-active="true"] .mpick-stop-name { font-weight: 400; }'],
  ['slider css: the thumb shows with nothing chosen', SCSS, '.mpick-slider-root[data-thumb="none"] .mpick-slider-thumb { border-color: transparent; background: transparent; cursor: pointer; }', '.mpick-slider-root[data-thumb="none"] .mpick-slider-thumb { cursor: pointer; }'],
  ['slider css: the hollow thumb is filled', SCSS, '.mpick-slider-root[data-thumb="hollow"] .mpick-slider-thumb { background: transparent; }', '.mpick-slider-root[data-thumb="hollow"] .mpick-slider-thumb { }'],
  ['slider css: the dot under the thumb is drawn', SCSS, '.mpick-tick[data-current="true"] { opacity: 0; }', '.mpick-tick[data-current="true"] { opacity: 1; }'],
  ['slider css: the fill shows with nothing chosen', SCSS, '.mpick-slider-root[data-thumb="none"] .mpick-slider-range { opacity: 0; }', '.mpick-slider-root[data-thumb="none"] .mpick-slider-range { opacity: 0.8; }'],
  ['slider css: a 32 px gauge', SCSS, '  width: 24px;\n  height: 24px;', '  width: 32px;\n  height: 32px;'],
  ['slider css: no hit area on phones', SCSS, '  .mpick-gauge::before { content: ""; position: absolute; top: -10px; right: -10px; bottom: -10px; left: -10px; }\n', ''],
  ['slider css: a 36 px hit area', SCSS, 'top: -10px; right: -10px; bottom: -10px; left: -10px;', 'top: -6px; right: -6px; bottom: -6px; left: -6px;'],
  ['slider css: a short slider row on phones', SCSS, '  .mpick-slider-root { height: 44px; }', '  .mpick-slider-root { height: 24px; }'],
  ['slider css: short stops on phones', SCSS, '  .mpick-stop { min-height: 44px; justify-content: center; }', '  .mpick-stop { min-height: 30px; justify-content: center; }'],
  ['slider css: an unscoped rule', SCSS, '.mpick-slider-panel {', 'div { height: 24px; }\n.mpick-slider-panel {'],
  ['slider css: an accent on the fill', SCSS, '.mpick-slider-range { position: absolute; height: 100%; border-radius: 999px; background: var(--mpick-fg, currentColor); opacity: 0.8; }', '.mpick-slider-range { position: absolute; height: 100%; border-radius: 999px; background: hsl(var(--ring, 250 90% 60%)); opacity: 0.8; }'],
  ['slider css: a larger caption', SCSS, 'font-size: 10px; line-height: 1.4; }', 'font-size: 15px; line-height: 1.4; }'],
  ['slider strip: a file is not named', SLIDER_STRIP, "  'components/model-choice/model-option.tsx',\n  'components/model-choice/model-slider.tsx',", "  'components/model-choice/model-slider.tsx',"],
  ['picker: the default row names no default', P, '`${MODEL_CHOICE_USE_DEFAULT}: ${args.userState ? plainName(args.userState, catalogue) : PICKER_AUTO_LABEL}`', '`${MODEL_CHOICE_USE_DEFAULT}: Auto`'],
  ['picker: the deck\'s Auto is no { auto: true }', P, "{ id: 'auto', label: MODEL_CHOICE_AUTO_LABEL, detail: null, hint: null, choice: { auto: true },", "{ id: 'auto', label: MODEL_CHOICE_AUTO_LABEL, detail: null, hint: null, choice: null,"],
  ['picker: "use my default" writes the Auto', P, "hint: null, choice: null, selected: following },", "hint: null, choice: { auto: true }, selected: following },"],
  ['picker: "use my default" is never selected', P, "hint: null, choice: null, selected: following },", "hint: null, choice: null, selected: false },"],
  ['picker: the reusable default shows the deck rows', P, 'const main: PickerOption[] = deck\n', 'const main: PickerOption[] = true\n'],
  ['picker: a deck Auto is on offer on the reusable default', P, "return scope === 'deck' && choice.auto === true && Object.keys(choice).length === 1", 'return choice.auto === true && Object.keys(choice).length === 1'],
  ['picker: an Auto with extra keys is on offer', P, ' && Object.keys(choice).length === 1\n', '\n'],
  ['picker: a tier is selected while following the default', P, 'selected: !following && state.kind === \'tier\'', "selected: state.kind === 'tier'"],
  ['picker: a mixed deck reads as its first group', P, "  if (PICKER_GROUPS.some(group => deck[group] !== first)) return 'mixed'\n", ''],
  ['picker: the deck\'s Auto loses its flag', P, 'if (first === MODEL_CHOICE_AUTO) return PICKER_AUTO_DECK', 'if (first === MODEL_CHOICE_AUTO) return PICKER_AUTO'],
  ['picker: the deck\'s Auto is reported as null', P, "(state.deck ? { auto: true } : null)", 'null'],
  ['hook: the scope is not given to offerable', H, '!offerable(now.catalogue, choice, now.scope.kind)', '!offerable(now.catalogue, choice)'],
  ['hook: a refused Auto reads as any refusal', H, 'askedAuto || result.refusedCode === "invalid_preference_auto" ? MODEL_CHOICE_REFUSED_AUTO : MODEL_CHOICE_REFUSED', 'MODEL_CHOICE_REFUSED'],
  ['hook: what a deck holds is not given', H, '    deckOwn,\n    choice:', '    deckOwn: undefined,\n    choice:'],
  ['component: the menu is built for the reusable default', C, 'scope: api.scope, own: api.deckOwn, userState: api.userState })', 'scope: "user", userState: api.userState })'],
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
  ['hook: a pick that is not on offer is written', H, '|| !offerable(now.catalogue, choice, now.scope.kind)', ''],
  ['hook: a second pick is taken while saving', H, 'if (!now.loaded || busy.current ||', 'if (!now.loaded ||'],
  ['hook: a conflict is ignored', H, 'if ("conflict" in result && result.conflict) {', 'if (false) {'],
  ['hook: a refusal is not put back', H, '      put(own)\n      outcome = { kind: "refused" }', '      outcome = { kind: "refused" }'],
  ['hook: a refusal is reported', H, '      reported = undefined\n    } else if ("deckUnavailable"', '      reported = choice\n    } else if ("deckUnavailable"'],
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
  ['component: no pressed state', FILES.option, 'aria-pressed={option.selected} ', ''],
  ['component: Escape is swallowed', C, 'side="top" align="start"', 'onEscapeKeyDown={event => event.preventDefault()} side="top" align="start"'],
  ['component: focus is not returned', C, 'side="top" align="start"', 'onCloseAutoFocus={event => event.preventDefault()} side="top" align="start"'],
  ['component: the chip opens before the choices are in', C, 'const blocked = Boolean(disabled) || !ready', 'const blocked = Boolean(disabled)'],
  ['component: disabled is ignored', C, 'const blocked = Boolean(disabled) || !ready', 'const blocked = !ready'],
  ['component: className is dropped', C, '["mpick-chip", className].filter(Boolean).join(" ")', '"mpick-chip"'],
  ['component: no Back button', C, '{models ? <button type="button" className="mpick-item mpick-back"', '{false ? <button type="button" className="mpick-item mpick-back"'],
  ['component: the hint is read as symbols', FILES.option, '<span className="mpick-sr">, cost {costLevel(option.hint)} of 3</span>', ''],
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
