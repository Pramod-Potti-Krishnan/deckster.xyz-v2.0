// FRONTEND-2 (B37; OPS-2's RISK of 27 Oct 22:15Z, E2E-2's F8 re-check on Studio dev, session 57f9e99a): proof of NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE (exact "true", default off, build-time).
//
// THE DEFECTS (root causes, read in the code):
//   1. Every deck save answered 412 preferences_modified, with GET 200 {} in front of it, and the reusable defaults would too. Not the router: the router's deck PUT (model-router app/read_api.py:357 at c19a384f) has no precondition
//      at all (replace, last writer wins, 200, no ETag), and its GETs send a stable strong ETag (:339, :117, :708 _set_validators, :685 _etag; an empty map's is "4f53cda18c2baa0c0354bb5f9a3ecbe5"). The 412 is Studio's own
//      stale-read check, lib/studio-model-choice-server.ts handlePrefs: `ifMatchTag !== current.etag`, plain string equality between the browser's If-Match and the tag the router just sent. CONFIRMED by E2E-2's $0 capture
//      (27 Oct 22:49Z, Studio dev, session 57f9e99a; scripts/fixtures/studio-model-choice-deck-save/e2e2-f8-recorded.json): the deck GET came back with ETag W/"4f53...", compressed by Vercel; the PATCH sent If-Match W/"4f53..." and got
//      412, whose own ETag was the strong "4f53..." (a 412 is not compressed); the USER GET came back W/"4f53..." too. Studio's browser store keeps one tag PER SCOPE and sends the scope's own (checked below). This proof reproduces
//      that transit (edge: 'weaken': a 200's strong tag arrives as W/"...") and shows the clean path (200 on either flag value: no defect without an altered tag) and the altered one (412 today, 200 with the flag), on both scopes.
//   2. The popover said "Saved to your account. Applies from the next build." after every failed save. That line is the picker's standing note about where choices are kept (lib/studio-model-picker.ts saveNote, by mode: account,
//      device, no storage); it never looked at the save. The words of a failed save (MODEL_CHOICE_CONFLICT ...) reach the screen-reader status only.
//   There is no retry loop in the code: a 412 re-reads once (adapter, lib/studio-model-choice.ts) and returns; E2E-2's "three times" are three slider commits. This proof pins "one failed save = one PATCH + one re-read".
//
// THE FIX (flag on): (1) a PATCH on either scope compares the entity tags as OPAQUE values (a W/ mark and the quotes are not part of it), so the same read in another form passes and a different tag (another tab saved first) is
// still refused 412; the router's own user PATCH still gets the router's strong tag as If-Match (its precondition keeps working). (2) in account mode, either scope, the note is "Saved ..." only after a save the account
// confirmed, the failed save's own (existing) words after one that failed, and nothing before a save.
//
//   A. router      the router's own ETag algorithm (a Python-derived vector, ROUTER-2's empty-deck tag), and the fake router built from its handlers: the deck PUT ignores If-Match and sends no ETag, the user PATCH honours it
//   B. the route   the REAL handlePrefs: first deck save and first user save, flag off / on, strong / weakened tag; a real concurrent change is 412 either way; other tags; the router's own precondition still refuses a racing write
//   C. the browser the REAL adapter, hook and slider over the real route: E2E-2's run reproduced flag off; flag on saves; the note follows the save; every kind of failed save; one failed save = one PATCH; a tag per scope
//   D. user scope  the reusable defaults: the same outcomes as the base flag off; flag on differs only for a weakened tag of the router's own; a browser save, and a real concurrent change refused in the existing words
//   E. flag off    the base: the strip gives each file's base back byte for byte, and base and head, flag off, answer the same matrices with the same hashes
//   F. scope       the COMMITTED diff, gate-safe: own commits are read from HEAD^2 when HEAD is the gate's merge (HEAD^1 = BASE); proven on a gate-style merge too
//   G. mutants     each one must make A-F fail
//
//   node scripts/test-studio-model-choice-deck-save.mjs        (MODEL_CHOICE_DECK_SAVE_NO_MUTANTS=1 skips G)
//
// Offline: no socket, fetch or real timer; the router is an in-process fake built from the router's own handler code; git is read for E and F (and F writes one unreachable commit object for the gate-style merge).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { FILES, loadPicker, root, runModule } from './studio-model-picker-kit.mjs'

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const eq = assert.equal, ok = assert.ok
const deep = (a, b, message) => { const x = JSON.parse(JSON.stringify(a)), y = JSON.parse(JSON.stringify(b)); if (message === undefined) assert.deepStrictEqual(x, y); else assert.deepStrictEqual(x, y, message) }

const FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE'
const SERVER = 'lib/studio-model-choice-server.ts', HOOK = FILES.hook
const REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
const FIX = 'scripts/fixtures/studio-model-choice', DFIX = 'scripts/fixtures/studio-model-choice-deck-save'

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n       ')}`) }
}

let overrides = {}
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const json = rel => JSON.parse(read(rel))
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-model-choice-deck-save-strip.mjs')
const {
  stripModelChoiceDeckSave, BASE_COMMIT: BASE, MODEL_CHOICE_DECK_SAVE_FILES, MODEL_CHOICE_DECK_SAVE_SCOPE_FILES, MODEL_CHOICE_DECK_SAVE_NEW_FILES, MODEL_CHOICE_DECK_SAVE_ENV_BLOCK, MODEL_CHOICE_DECK_SAVE_SUBJECT, MODEL_CHOICE_DECK_SAVE_MARKER_RE,
} = stripModule
const baseFile = rel => git('show', `${BASE}:${rel}`)
const baseRead = rel => (rel === SERVER || rel === HOOK ? baseFile(rel) : read(rel))

// ---- the made-up people, the router key (built at run time, so no file carries one) and the words the picker already has ---------------------------------------------------------------------
const KEY = ['fixture', 'frontend', crypto.randomBytes(8).toString('hex')].join('-')
const ME = { id: 'user-fixture-1', email: 'me@example.test' }
const SESSION = 'sess-fixture-1', SESSION_2 = 'sess-fixture-2'
const OWNED = { [SESSION]: { userId: ME.id, status: 'active' }, [SESSION_2]: { userId: ME.id, status: 'active' }, 'sess-other': { userId: 'user-fixture-2', status: 'active' } }
const CONFIGURED = { MODEL_ROUTER_URL: 'https://router.example.test/v1/', MODEL_ROUTER_FRONTEND_KEY: KEY, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
const USER_PATH = `/v1/prefs/${ME.id}`, DECK_PATH = `/v1/prefs/${ME.id}/sessions/${SESSION}`
const TEXT_GROUPS = ['planning_strategy', 'content_writing', 'research_analysis']
const PRESETS = ['quick', 'economy', 'balanced', 'best', 'max']
const NOTES = { account: 'Saved to your account. Applies from the next build.', unreachable: 'Your account could not be reached; saved on this device for now' }
const WORDS = {
  conflict: 'Your choices changed elsewhere, so the saved ones are shown.',
  refused: 'That choice cannot be saved for this task right now.',
  deckUnavailable: 'Choices for one presentation aren’t available yet, so your reusable defaults apply.',
}
const RECORDED = json(`${DFIX}/e2e2-f8-recorded.json`)
const EMPTY_ETAG = RECORDED.empty_deck_etag
const CAPTURE = RECORDED.capture_22_49Z // E2E-2 capture 27 Oct 22:49Z
const CATALOGUE_VERSION = json(`${DFIX}/router-session-get-empty-200.json`).catalogue_version
const BEST3 = Object.fromEntries(TEXT_GROUPS.map(group => [group, { preset: 'best' }]))

// ---------------------------------------------------------------- A. the router, from its own code (app/read_api.py at c19a384f)
/** _etag (:685): a strong tag over exactly what is stored: '"' + sha256(json.dumps([[name, preset, model, updated_at], ...sorted by name], separators=(',', ':')))[:32] + '"'. */
const routerEtag = rows => `"${sha(JSON.stringify(Object.keys(rows).sort().map(name => [name, rows[name].preset ?? null, rows[name].model ?? null, rows[name].updated_at]))).slice(0, 32)}"`
const row = (choice, updated_at) => ({ ...(choice.auto === true ? { auto: true } : {}), preset: choice.preset ?? null, model: choice.model ?? null, updated_at })

/** The router, as far as the prefs routes go (`state.race`: a function run once, just before the next write is handled): GET user / deck (:117, :339) always send the strong tag; PATCH user (:156) honours If-Match through _precondition (:715); PUT deck (:357) has NO precondition, replaces the map,
 * answers 200 and sets no ETag. `state` can change mid-visit: deckScope (R3 off: 404), putStatus (a 5xx from the PUT), refuse (presets the router refuses with 422). */
function modelRouter({ deckScope = true, putStatus = 200, refuse = [] } = {}) {
  const store = new Map(), log = [], state = { deckScope, putStatus, refuse, race: null }
  let clock = 0
  const stamp = () => `2026-10-27T22:03:${String(++clock).padStart(2, '0')}Z`
  const answer = (status, body, etag = null) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? etag : null) }, json: async () => JSON.parse(JSON.stringify(body)) })
  const viewOf = rows => Object.fromEntries(Object.entries(rows).map(([group, r]) => [group, { ...(r.auto ? { auto: true } : {}), preset: r.preset, model: r.model, updated_at: r.updated_at, stale: false }]))
  const refusal = code => answer(422, { error: { message: 'x', type: 'invalid_request_error', code } })
  const fetch = async (url, init) => {
    log.push({ url, method: init.method, headers: { ...init.headers }, body: init.body ?? null })
    if (init.headers.Authorization !== `Bearer ${KEY}`) return answer(401, { error: { message: 'Invalid key', type: 'authentication_error', code: 'invalid_api_key' } })
    const { pathname } = new URL(url)
    const m = /^\/v1\/prefs\/([^/]+)(?:\/sessions\/([^/]+))?$/.exec(pathname)
    if (!m || (m[2] && !state.deckScope)) return answer(404, json(`${FIX}/router-not-found-404.json`))
    if (state.race && (init.method === 'PATCH' || init.method === 'PUT')) { const race = state.race; state.race = null; race() } // another writer lands between Studio's read and its write
    const rows = store.get(pathname) ?? {}
    const head = { user_id: decodeURIComponent(m[1]), ...(m[2] ? { session_id: decodeURIComponent(m[2]) } : {}) }
    if (init.method === 'GET') return answer(200, { ...head, preferences: viewOf(rows), catalogue_version: CATALOGUE_VERSION }, routerEtag(rows))
    const body = JSON.parse(init.body)
    for (const [group, choice] of Object.entries(body.preferences)) {
      if (choice === null) continue
      if (!TEXT_GROUPS.includes(group)) return refusal('invalid_preference_group')
      if (choice.preset && (!PRESETS.includes(choice.preset) || state.refuse.includes(choice.preset))) return refusal('invalid_preference_preset')
    }
    if (init.method === 'PUT' && m[2]) { // :357: no precondition (an If-Match header is not even read), replace, last writer wins, 200, no ETag
      if (state.putStatus !== 200) return answer(state.putStatus, { detail: 'Internal Server Error' })
      const next = Object.fromEntries(Object.entries(body.preferences).map(([group, choice]) => [group, row(choice, stamp())]))
      store.set(pathname, next)
      return answer(200, { ...head, preferences: Object.fromEntries(Object.entries(next).map(([group, r]) => [group, r.auto ? { auto: true } : { preset: r.preset, model: r.model }])), catalogue_version: CATALOGUE_VERSION })
    }
    if (init.method === 'PATCH' && !m[2]) { // :156 with _precondition (:715): If-Match is a set of tags, "*" passes, a tag that is not the stored rows' tag is 412 with the current ETag
      const ifMatch = init.headers['If-Match']
      if (ifMatch !== undefined) {
        const tags = new Set(ifMatch.split(',').map(tag => tag.trim()))
        if (!tags.has('*') && !tags.has(routerEtag(rows))) return answer(412, json(`${FIX}/router-prefs-412.json`), routerEtag(rows))
      }
      const next = { ...rows }
      for (const [group, choice] of Object.entries(body.preferences)) { if (choice === null) delete next[group]; else next[group] = row(choice, stamp()) }
      store.set(pathname, next)
      return answer(200, { ...head, preferences: viewOf(next), catalogue_version: CATALOGUE_VERSION }, routerEtag(next))
    }
    return answer(405, { detail: 'Method Not Allowed' })
  }
  const seed = (pathname, choices) => store.set(pathname, Object.fromEntries(Object.entries(choices).map(([group, choice]) => [group, row(choice, stamp())])))
  const kept = pathname => Object.fromEntries(Object.entries(store.get(pathname) ?? {}).map(([group, r]) => [group, r.auto ? 'auto' : r.preset ?? `model:${r.model}`]))
  const writes = () => log.filter(entry => entry.method === 'PUT' || entry.method === 'PATCH')
  return { fetch, store, log, state, seed, kept, writes }
}

// ---------------------------------------------------------------- the real route and the real browser code
function loadServer(rd = read) {
  const opts = { read: rd }
  const p2 = runModule(FILES.p2, {}, opts), cat = runModule(FILES.catalog, {}, opts)
  const choice = runModule(FILES.choice, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat }, opts)
  return runModule(SERVER, { '@/lib/studio-model-choice': choice }, opts)
}
const flagEnv = flag => (flag === undefined ? {} : { [FLAG]: flag })
const routeDeps = (router, flag, user = ME) => ({ env: { ...CONFIGURED, ...flagEnv(flag) }, getSessionUser: async () => user, findOwnedSession: async id => OWNED[id] ?? null, fetch: router.fetch })
const getTag = async (server, router, deckKey, flag) => (await server.handlePrefs('GET', deckKey, { ifMatch: null }, routeDeps(router, flag))).etag
const patchOf = (server, router, deckKey, ifMatch, changes, flag) => server.handlePrefs('PATCH', deckKey, { ifMatch, body: async () => ({ preferences: changes }) }, routeDeps(router, flag))
const weak = tag => `W/${tag}`
/** The edge between Studio's route and the browser. 'weaken' is what E2E-2 captured (27 Oct 22:49Z): Vercel compresses a 200 and sends its strong ETag on as W/"...", which the browser then sends back in If-Match; a 412 is not compressed, so its tag stays strong. */
const edgeOf = (edge, tag) => (tag && edge === 'weaken' && !tag.startsWith('W/') ? weak(tag) : tag)

const tick = () => new Promise(resolve => setImmediate(resolve))
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree, ...walk(tree.props?.children)]
const textOf = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : tree && typeof tree === 'object' ? textOf(tree.props?.children ?? '') : ''
function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)) }, removeItem: key => { map.delete(key) } }
}

/** The picker / slider / a probe of useModelChoice under a small hook runtime (state applied at once, effects after each pass), with Studio's real route behind its fetch and the fake router behind that. */
async function mount({ read: rd = read, flag, edge = 'clean', router = modelRouter(), storage = makeStorage(), props = { sessionId: null }, probe = true } = {}) {
  const hookEnv = { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true', ...flagEnv(flag) }
  const world = { studio: 'up', edge, fetchLog: [], storage, router }
  const respond = (status, payload, etag) => ({ status, headers: { get: name => (name.toLowerCase() === 'etag' ? (status === 200 ? edgeOf(world.edge, etag) : etag) ?? null : null) }, json: async () => JSON.parse(JSON.stringify(payload)) })
  let server = null
  const fetchImpl = async (url, init = {}) => {
    world.fetchLog.push({ url: String(url), method: init.method ?? 'GET', headers: { ...(init.headers ?? {}) }, body: init.body ?? null })
    if (url === '/api/models/catalogue') return respond(200, json(`${FIX}/catalogue-live-shape.json`))
    if (world.studio === 'down') throw new TypeError('Failed to fetch')
    const deck = url.startsWith('/api/model-choice/prefs/deck/') ? decodeURIComponent(url.slice('/api/model-choice/prefs/deck/'.length)) : null
    if (!url.startsWith('/api/model-choice/prefs')) throw new Error(`the browser asked for ${url}`)
    const outcome = await server.handlePrefs(init.method ?? 'GET', deck, { ifMatch: init.headers?.['If-Match'] ?? null, body: async () => JSON.parse(init.body) }, routeDeps(router, flag))
    return respond(outcome.status, outcome.body, outcome.etag)
  }
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
    Trigger: p => ({ type: 'button', props: { ...p, 'aria-expanded': popover.open, onClick: () => popover.onOpenChange(!popover.open) } }),
    Portal: ({ children }) => ({ type: 'popover-portal', props: { children } }),
    Content: ({ children, ...rest }) => (popover.open ? { type: 'div', props: { ...rest, role: 'dialog', children } } : null),
  }
  const radixSlider = {
    Root: ({ children, ...p }) => ({ type: 'slider-root', props: { ...p, children } }),
    Track: ({ children, ...p }) => ({ type: 'slider-track', props: { ...p, children } }),
    Range: p => ({ type: 'slider-range', props: p }),
    Thumb: p => ({ type: 'span', props: { ...p, role: 'slider' } }),
  }
  const m = loadPicker({ read: rd, react: hooks, jsx: { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' }, radix, radixSlider, lucide: new Proxy({}, { get: (_, name) => String(name) }), env: hookEnv, globals: { window: { localStorage: storage }, fetch: fetchImpl } })
  server = runModule(SERVER, { '@/lib/studio-model-choice': m.choice }, { read: rd })
  const Probe = function Probe(p) { return { type: 'probe', props: { api: m.component.useModelChoice(p.sessionId) } } }
  const rootOf = probe ? Probe : m.component.ModelPicker
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
    m, world, fetchLog: world.fetchLog, router, storage, popover, props, tree: null,
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
    api: () => rt.find(node => node.type === 'probe', 'the probe').props.api,
    async setProps(next) { rt.props = { ...rt.props, ...next }; return rt.settle() },
    slider: () => rt.find(node => node.type === 'slider-root', 'the slider'),
    stops: () => rt.nodes().filter(node => node.props?.['data-mpick-stop']).map(node => ({ id: node.props['data-mpick-stop'], node })),
    async open() { const trigger = rt.find(node => ['gauge', 'chip'].includes(node.props?.['data-mpick']), 'the gauge or chip'); await rt.act(() => trigger.props.onClick()); assert.ok(rt.maybe(node => node.props?.['data-mpick'] === 'menu'), 'the menu opens') },
    async commit(id) { const i = rt.stops().findIndex(stop => stop.id === id); assert.ok(i >= 0, `a stop ${id}`); return rt.act(() => rt.slider().props.onValueCommit([i])) },
    gaugeLabel: () => rt.find(node => node.props?.['data-mpick'] === 'gauge', 'the gauge').props['aria-label'],
    note(kind) { const node = rt.maybe(n => n.props?.['data-mpick'] === kind); return node ? textOf(node) : null },
    patches: () => rt.fetchLog.filter(entry => entry.method === 'PATCH'),
  }
  return rt.settle()
}
const mountSlider = (opts = {}) => mount({ ...opts, probe: false, props: { sessionId: SESSION, variant: 'slider', ...(opts.props ?? {}) } })
const mountProbe = (opts = {}) => mount({ ...opts, probe: true, props: { sessionId: SESSION, ...(opts.props ?? {}) } })
const deckOf = tier => ({ tier })

// ================================================================ A. the router
console.log('A. The router, from its own code')
await check('the ETag algorithm: ROUTER-2\'s empty-deck tag, and two vectors computed with the router\'s own Python (_etag, json.dumps with compact separators)', () => {
  eq(routerEtag({}), '"4f53cda18c2baa0c0354bb5f9a3ecbe5"'); eq(routerEtag({}), EMPTY_ETAG)
  eq(routerEtag({ planning_strategy: row({ preset: 'best' }, '2026-10-27T22:03:34Z'), content_writing: row({ model: 'anthropic/claude-sonnet-5.5' }, '2026-10-27T22:03:35Z') }), '"0e2577e607ac90015a45c4adc28bad5f"')
  eq(routerEtag({ content_writing: row({ preset: 'balanced' }, '2026-10-27T22:03:34.250000Z') }), '"0b97e960b4829fe5a3e27841cb353b40"')
  eq(routerEtag({}), `"${crypto.createHash('sha256').update('[]').digest('hex').slice(0, 32)}"`, 'sha256("[]") quoted')
})
await check('the recorded F8 run, E2E-2\'s capture of 27 Oct 22:49Z and the router fixtures have the shapes the proof relies on (a weakened GET tag sent back in If-Match; an empty deck GET; a PUT echo with no updated_at; the user 412)', () => {
  deep(RECORDED.recorded.deck_get, { status: 200, body: { scope: 'deck', preferences: {} } })
  eq(RECORDED.recorded.deck_patch_each_time.status, 412); eq(RECORDED.recorded.deck_patch_each_time.body.code, 'preferences_modified')
  eq(CAPTURE.deck_get_etag, weak(EMPTY_ETAG), 'E2E-2 capture 27 Oct 22:49Z: the deck GET came back weakened'); eq(CAPTURE.deck_patch_if_match, CAPTURE.deck_get_etag, 'and the PATCH sent that back'); eq(CAPTURE.deck_patch_status, 412)
  eq(CAPTURE.deck_patch_response_etag, EMPTY_ETAG, 'the 412 itself carried the strong tag'); eq(CAPTURE.user_get_etag, weak(EMPTY_ETAG), 'the user GET came back weakened too')
  deep(json(`${DFIX}/router-session-get-empty-200.json`).preferences, {})
  deep(Object.keys(json(`${DFIX}/router-session-put-200.json`).preferences), TEXT_GROUPS.slice().sort()); eq(json(`${DFIX}/router-session-put-200.json`).preferences.content_writing.updated_at, undefined)
  eq(json(`${FIX}/router-prefs-412.json`).error.code, 'preferences_modified')
})
await check('the fake router is the router: the deck GET sends a stable strong tag, the deck PUT ignores If-Match and sends none, the user PATCH refuses a wrong If-Match with 412 and the current tag', async () => {
  const router = modelRouter(), call = (method, pathname, headers = {}, body) => router.fetch(`https://router.example.test${pathname}`, { method, headers: { Authorization: `Bearer ${KEY}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const first = await call('GET', DECK_PATH), second = await call('GET', DECK_PATH)
  eq(first.headers.get('etag'), EMPTY_ETAG); eq(second.headers.get('etag'), EMPTY_ETAG); deep(await first.json(), json(`${DFIX}/router-session-get-empty-200.json`))
  const put = await call('PUT', DECK_PATH, { 'If-Match': '"nothing-like-the-stored-tag"' }, { preferences: BEST3 })
  eq(put.status, 200, 'a deck PUT is never 412'); eq(put.headers.get('etag'), null, 'and sets no ETag'); deep(router.kept(DECK_PATH), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best' })
  const user = await call('PATCH', USER_PATH, { 'If-Match': '"not-the-tag"' }, { preferences: { content_writing: { preset: 'best' } } })
  eq(user.status, 412); eq(user.headers.get('etag'), EMPTY_ETAG); eq(router.kept(USER_PATH).content_writing, undefined)
  eq((await call('PATCH', USER_PATH, { 'If-Match': EMPTY_ETAG }, { preferences: { content_writing: { preset: 'best' } } })).status, 200)
  eq((await call('PATCH', USER_PATH, { 'If-Match': weak(routerEtag(router.store.get(USER_PATH))) }, { preferences: { content_writing: { preset: 'max' } } })).status, 412, 'the router would refuse a weak tag too (Studio sends it its own, strong, tag)')
})

// ================================================================ B. the route
console.log('B. The route (the real handlePrefs): the 412 is Studio\'s own check')
const head = loadServer(), base = loadServer(baseRead)
await check('flag off, the tag as the router sent it: the first deck save is written (the 412 needs a tag that arrived altered)', async () => {
  const router = modelRouter(), tag = await getTag(head, router, SESSION)
  eq(tag, EMPTY_ETAG, 'Studio hands the browser the router\'s tag as it is')
  const out = await patchOf(head, router, SESSION, tag, BEST3)
  eq(out.status, 200); deep(router.kept(DECK_PATH), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best' })
  eq(router.writes().length, 1); eq(router.writes()[0].method, 'PUT'); eq(router.writes()[0].headers['If-Match'], EMPTY_ETAG, 'Studio sends its fresh tag with the PUT, which the router never reads')
  ok(out.etag && out.etag !== EMPTY_ETAG, 'the new tag comes from a re-read (the PUT sets none)')
})
await check('flag off, the same tag arrived as W/"...": 412 preferences_modified, and the router never saw a write (so the 412 is Studio\'s, line "ifMatchTag !== current.etag")', async () => {
  const router = modelRouter(), tag = await getTag(head, router, SESSION)
  const out = await patchOf(head, router, SESSION, weak(tag), BEST3)
  eq(out.status, 412); eq(out.body.code, 'preferences_modified'); eq(out.body.error, 'Your choices changed elsewhere. Read them again and retry.'); eq(out.etag, EMPTY_ETAG); eq(out.etag, CAPTURE.deck_patch_response_etag, 'the 412 carries the strong tag, as captured')
  eq(router.writes().length, 0); deep(router.kept(DECK_PATH), {}); deep(router.log.map(entry => entry.method), ['GET', 'GET'])
  deep(RECORDED.recorded.deck_patch_each_time.body, { error: out.body.error, code: out.body.code }, 'the words E2E-2 recorded')
  for (let again = 0; again < 3; again++) eq((await patchOf(head, router, SESSION, weak(await getTag(head, router, SESSION)), BEST3)).status, 412, `a re-read does not help: the tag comes back weakened (${again + 1})`)
})
await check('flag on: the weakened tag is the same read, so the first deck save is written; the strong tag still is; no tag at all still is', async () => {
  for (const [label, makeTag] of [['weakened', t => weak(t)], ['strong', t => t], ['absent', () => null]]) {
    const router = modelRouter(), tag = await getTag(head, router, SESSION, 'true')
    const out = await patchOf(head, router, SESSION, makeTag(tag), BEST3, 'true')
    eq(out.status, 200, label); deep(router.kept(DECK_PATH), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best' }, label); eq(router.writes().length, 1, label)
  }
})
await check('a real concurrent change is 412 on both flag values, strong or weakened, and nothing is written; the browser gets the current map and tag, and a retry with the fresh tag saves', async () => {
  for (const flag of [undefined, 'true']) for (const edge of ['clean', 'weaken']) {
    const router = modelRouter(), tag = await getTag(head, router, SESSION, flag)
    router.seed(DECK_PATH, { content_writing: { preset: 'economy' } }) // another tab saved first
    const out = await patchOf(head, router, SESSION, edgeOf(edge, tag), BEST3, flag), label = `flag ${flag}, ${edge}`
    eq(out.status, 412, label); eq(out.body.code, 'preferences_modified', label); eq(router.writes().length, 0, label)
    eq(out.body.preferences.content_writing.preset, 'economy', `${label}: the current map comes back`); eq(out.etag, routerEtag(router.store.get(DECK_PATH)), label)
    eq((await patchOf(head, router, SESSION, edgeOf(edge, out.etag), BEST3, flag)).status, flag === 'true' || edge === 'clean' ? 200 : 412, `${label}: the retry`)
  }
})
await check('other tags: a different value, weakened or not, another scope\'s tag (the user map\'s, which differs when it holds a choice), and a tag with no quotes are all refused, flag on and off', async () => {
  for (const flag of [undefined, 'true']) {
    const router = modelRouter(); router.seed(USER_PATH, { planning_strategy: { preset: 'balanced' } })
    const userTag = routerEtag(router.store.get(USER_PATH)); ok(userTag !== EMPTY_ETAG)
    for (const sent of ['"deadbeefdeadbeefdeadbeefdeadbeef"', weak('"deadbeefdeadbeefdeadbeefdeadbeef"'), userTag, weak(userTag)]) {
      const out = await patchOf(head, router, SESSION, sent, BEST3, flag); eq(out.status, 412, `${flag} ${sent}`)
    }
    for (const sent of ['4f53cda18c2baa0c0354bb5f9a3ecbe5', '*', 'W/', '"']) { const out = await patchOf(head, router, SESSION, sent, BEST3, flag); eq(out.status, 400, `${flag} ${sent}`); eq(out.body.code, 'invalid_request') }
    eq(router.writes().length, 0)
  }
})
const userPatchOf = (server, router, ifMatch, changes, flag) => server.handlePrefs('PATCH', null, { ifMatch, body: async () => ({ preferences: changes }) }, routeDeps(router, flag))
const BEST_WRITING = { content_writing: { preset: 'best' } }
await check('USER scope, flag off: the first save with the router\'s tag is written; with the tag arrived as W/"..." (E2E-2 capture, 27 Oct 22:49Z) it is 412, and the router sees no write', async () => {
  const router = modelRouter(), tag = await getTag(head, router, null)
  eq(tag, EMPTY_ETAG); eq((await userPatchOf(head, router, tag, BEST_WRITING)).status, 200); eq(router.kept(USER_PATH).content_writing, 'best')
  const refused = modelRouter(), out = await userPatchOf(head, refused, CAPTURE.user_get_etag, BEST_WRITING)
  eq(out.status, 412); eq(out.body.code, 'preferences_modified'); eq(out.body.scope, 'user', 'Studio\'s own stale-read refusal, with the current map'); eq(refused.writes().length, 0); deep(refused.kept(USER_PATH), {})
})
await check('USER scope, flag on: the captured weakened tag, the strong tag and no tag all save, and the router still gets its OWN strong tag as If-Match (its precondition is untouched)', async () => {
  for (const [label, sent] of [['captured W/', CAPTURE.user_get_etag], ['strong', EMPTY_ETAG], ['absent', null]]) {
    const router = modelRouter(), out = await userPatchOf(head, router, sent, BEST_WRITING, 'true')
    eq(out.status, 200, label); eq(router.kept(USER_PATH).content_writing, 'best', label); eq(router.writes().length, 1, label)
    eq(router.writes()[0].method, 'PATCH', label); eq(router.writes()[0].headers['If-Match'], EMPTY_ETAG, `${label}: the router is sent its own tag, not the browser's`)
    ok(out.etag && out.etag !== EMPTY_ETAG, `${label}: the router's new tag comes back`)
  }
})
await check('USER scope: a real concurrent change is 412 on both flag values, strong or weakened, other and unquoted tags are refused as before, and nothing is written', async () => {
  for (const flag of [undefined, 'true']) {
    for (const edge of ['clean', 'weaken']) {
      const router = modelRouter(), tag = await getTag(head, router, null, flag)
      router.seed(USER_PATH, { planning_strategy: { preset: 'economy' } }) // another tab saved first
      const out = await userPatchOf(head, router, edgeOf(edge, tag), BEST_WRITING, flag), label = `flag ${flag}, ${edge}`
      eq(out.status, 412, label); eq(out.body.code, 'preferences_modified', label); eq(router.writes().length, 0, label); eq(router.kept(USER_PATH).content_writing, undefined, label)
      eq(out.body.preferences.planning_strategy.preset, 'economy', `${label}: the current map comes back`); eq(out.etag, routerEtag(router.store.get(USER_PATH)), label)
    }
    const router = modelRouter()
    for (const sent of ['"deadbeefdeadbeefdeadbeefdeadbeef"', weak('"deadbeefdeadbeefdeadbeefdeadbeef"')]) eq((await userPatchOf(head, router, sent, BEST_WRITING, flag)).status, 412, `${flag} ${sent}`)
    for (const sent of ['4f53cda18c2baa0c0354bb5f9a3ecbe5', '*']) eq((await userPatchOf(head, router, sent, BEST_WRITING, flag)).status, 400, `${flag} ${sent}`)
    eq(router.writes().length, 0)
  }
})
await check('the router\'s own precondition still protects the user map: a write that lands between Studio\'s read and its PATCH is refused 412 by the router, flag on and off, nothing of the refused write is kept; the deck PUT has none (last writer wins, as the router\'s PUT is)', async () => {
  for (const flag of [undefined, 'true']) {
    const router = modelRouter(), tag = await getTag(head, router, null, flag)
    router.state.race = () => router.seed(USER_PATH, { planning_strategy: { preset: 'economy' } })
    const out = await userPatchOf(head, router, flag === 'true' ? weak(tag) : tag, BEST_WRITING, flag)
    eq(out.status, 412, `flag ${flag}`); eq(out.body.code, 'preferences_modified'); eq(router.writes().length, 1, 'the router was asked, with the old tag'); eq(router.writes()[0].headers['If-Match'], EMPTY_ETAG)
    deep(router.kept(USER_PATH), { planning_strategy: 'economy' }, 'only the other writer\'s choice is there')
    const deck = modelRouter(), deckTag = await getTag(head, deck, SESSION, flag)
    deck.state.race = () => deck.seed(DECK_PATH, { planning_strategy: { preset: 'economy' } })
    eq((await patchOf(head, deck, SESSION, flag === 'true' ? weak(deckTag) : deckTag, BEST3, flag)).status, 200, 'the deck PUT takes it'); deep(deck.kept(DECK_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best'])), 'and replaces the other writer\'s map')
  }
})
await check('the comparison: the same opaque value however it is marked or quoted; case and content count; a missing tag is never the same', () => {
  const { sameEntityTag } = head
  for (const [a, b, same] of [['"a1"', '"a1"', true], ['W/"a1"', '"a1"', true], ['"a1"', 'W/"a1"', true], ['W/"a1"', 'W/"a1"', true], ['"a1"', '"a2"', false], ['"A1"', '"a1"', false], ['W/"a1"', '"a2"', false], ['"a1"', '"a1 "', false], [null, '"a1"', false], ['"a1"', null, false], [null, null, false]]) eq(sameEntityTag(a, b), same, `${a} ${b}`)
})
await check('the flag is exactly "true", and the deck GET and an unchanged request are the same either way', async () => {
  for (const [value, on] of [[undefined, false], ['', false], ['false', false], ['TRUE', false], [' true', false], ['1', false], ['true', true]]) eq(head.deckSaveOn(flagEnv(value)), on, JSON.stringify(value))
  const a = modelRouter(), b = modelRouter()
  deep(await head.handlePrefs('GET', SESSION, { ifMatch: null }, routeDeps(a)), await head.handlePrefs('GET', SESSION, { ifMatch: null }, routeDeps(b, 'true')))
})

// ================================================================ C. the browser
console.log('C. The browser (the real adapter, hook and slider over the real route)')
const lastPatch = rt => rt.patches().at(-1)
await check('E2E-2\'s run, flag off, tag weakened on its way: Best is refused 412, the gauge goes back to Auto, and the popover still says "Saved to your account" (the observed defect)', async () => {
  const rt = await mountSlider({ edge: 'weaken' }); await rt.open()
  eq(rt.gaugeLabel(), 'Model: Auto'); eq(rt.note('save'), NOTES.account, 'the standing note is there before any save too')
  await rt.commit('best')
  eq(rt.patches().length, 1); eq(rt.patches()[0].url, `/api/model-choice/prefs/deck/${SESSION}`); eq(rt.patches()[0].headers['If-Match'], CAPTURE.deck_patch_if_match, 'the browser sends the weakened tag it was given (the captured If-Match)')
  eq(rt.gaugeLabel(), 'Model: Auto'); eq(rt.router.writes().length, 0); eq(rt.note('save'), NOTES.account, 'the false success, with the failure only in the screen-reader status')
  eq(rt.note('status'), WORDS.conflict)
  for (let again = 0; again < 2; again++) { await rt.commit('economy'); await rt.commit('best') }
  ok(rt.patches().length >= 3 && rt.patches().every(patch => patch.body !== null), 'more attempts, all refused'); eq(rt.router.writes().length, 0, 'three times and more, and nothing is saved')
})
await check('flag off, tag as sent (no edge weakening): Best saves. The defect needs the altered tag; flag off is what it was', async () => {
  const rt = await mountSlider({ edge: 'clean' }); await rt.open(); await rt.commit('best')
  eq(rt.gaugeLabel(), 'Model: Best'); deep(rt.router.kept(DECK_PATH), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best' }); eq(rt.note('save'), NOTES.account)
})
await check('flag on, tag weakened on its way: Best saves in the account, the popover says so once it has, the gauge shows it, and a reload (a new page over the same router) reads it back', async () => {
  const router = modelRouter(), rt = await mountSlider({ flag: 'true', edge: 'weaken', router }); await rt.open()
  eq(rt.note('save'), null, 'before any save the popover claims nothing'); eq(rt.gaugeLabel(), 'Model: Auto')
  await rt.commit('best')
  eq(rt.gaugeLabel(), 'Model: Best'); eq(rt.note('save'), NOTES.account); eq(rt.note('status'), ''); deep(router.kept(DECK_PATH), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best' })
  await rt.commit('balanced') // the tag that came back from the save is the next If-Match
  eq(rt.gaugeLabel(), 'Model: Balanced'); deep(router.kept(DECK_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced']))); eq(rt.patches().length, 2)
  ok(/^W\//.test(rt.patches()[1].headers['If-Match']) && rt.patches()[1].headers['If-Match'] !== weak(EMPTY_ETAG), 'the second save carries the first save\'s new (weakened) tag')
  const again = await mountSlider({ flag: 'true', edge: 'weaken', router }); eq(again.gaugeLabel(), 'Model: Balanced'); await again.open(); eq(again.note('save'), null, 'nothing is claimed after a reload either')
})
await check('flag on: a real concurrent change is refused, the popover says so in the existing words and not "Saved", and the gauge shows what is really stored; the next save works and says Saved again', async () => {
  const router = modelRouter(), rt = await mountSlider({ flag: 'true', edge: 'weaken', router }); await rt.open()
  await rt.commit('best'); eq(rt.note('save'), NOTES.account)
  router.seed(DECK_PATH, { planning_strategy: { preset: 'economy' }, content_writing: { preset: 'economy' }, research_analysis: { preset: 'economy' } }) // another tab
  await rt.commit('balanced')
  eq(rt.note('save'), WORDS.conflict); eq(rt.note('status'), WORDS.conflict); eq(rt.gaugeLabel(), 'Model: Fast', 'what the account holds'); eq(rt.patches().length, 2)
  deep(router.kept(DECK_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'economy'])), 'nothing of the refused save was written')
  await rt.commit('balanced'); eq(rt.note('save'), NOTES.account); eq(rt.gaugeLabel(), 'Model: Balanced'); deep(router.kept(DECK_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced'])))
})
await check('flag on: every kind of failed save says its own (existing) words and never "Saved": refused, the deck scope gone, the router failing, Studio not answering', async () => {
  const kinds = [
    ['the router refuses the choice (422)', async rt => rt.router.state.refuse.push('best'), WORDS.refused, 'account'],
    ['the deck scope is gone (R3 404)', async rt => { rt.router.state.deckScope = false }, WORDS.deckUnavailable, 'account'],
    ['the router fails the write (5xx)', async rt => { rt.router.state.putStatus = 500 }, NOTES.unreachable, 'device'],
    ['Studio does not answer', async rt => { rt.world.studio = 'down' }, NOTES.unreachable, 'device'],
  ]
  for (const [label, arrange, words, mode] of kinds) {
    const rt = await mountProbe({ flag: 'true', edge: 'weaken' }); eq(rt.api().saveNote, '', `${label}: nothing before a save`)
    await arrange(rt)
    const outcome = await rt.api().select(deckOf('best')); await rt.settle()
    ok(rt.api().saveNote !== NOTES.account, `${label}: never the success words`); eq(rt.api().saveNote, words, label); eq(rt.api().mode, mode, label)
    ok(['conflict', 'refused', 'deck-unavailable', 'saved'].includes(outcome.kind), label)
  }
  const rt = await mountProbe({ flag: 'true' }); await rt.api().select(deckOf('best')); await rt.settle(); eq(rt.api().saveNote, NOTES.account)
  rt.router.state.deckScope = false; await rt.api().select(deckOf('economy')); await rt.settle(); eq(rt.api().saveNote, WORDS.deckUnavailable, 'a save that worked and then one that did not: the later one speaks')
})
await check('flag on: the note is about the visit\'s last save only: it is gone when the deck changes, and the compact picker shows the same', async () => {
  const rt = await mountProbe({ flag: 'true', edge: 'weaken' }); await rt.api().select(deckOf('best')); await rt.settle(); eq(rt.api().saveNote, NOTES.account)
  await rt.setProps({ sessionId: SESSION_2 }); eq(rt.api().saveNote, '', 'another presentation: no save yet'); eq(rt.api().feedback, '')
  const picker = await mount({ flag: 'true', edge: 'weaken', probe: false, props: { sessionId: SESSION } }); await picker.open(); eq(picker.note('save'), null)
})
await check('one failed save is one PATCH and one re-read: nothing is sent again by itself, however long it waits (the weakened tag flag off; a real change flag on)', async () => {
  const sentAfter = async (rt, choice) => { const before = rt.fetchLog.length; await rt.api().select(choice); for (let i = 0; i < 40; i++) await tick(); return rt.fetchLog.slice(before).map(entry => `${entry.method} ${entry.url.replace(SESSION, 'S')}`) }
  const flagOff = await mountProbe({ edge: 'weaken' })
  deep(await sentAfter(flagOff, deckOf('best')), ['PATCH /api/model-choice/prefs/deck/S', 'GET /api/model-choice/prefs/deck/S'], 'flag off: refused, re-read, done'); eq(flagOff.router.writes().length, 0)
  const flagOn = await mountProbe({ flag: 'true', edge: 'weaken' }); flagOn.router.seed(DECK_PATH, { content_writing: { preset: 'economy' } })
  deep(await sentAfter(flagOn, deckOf('best')), ['PATCH /api/model-choice/prefs/deck/S', 'GET /api/model-choice/prefs/deck/S'], 'flag on, a real change: refused, re-read, done'); eq(flagOn.router.writes().length, 0)
})
await check('a tag per scope: the deck PATCH carries the deck\'s tag and the user PATCH the user\'s, even when they differ', async () => {
  for (const flag of [undefined, 'true']) {
    const router = modelRouter(); router.seed(USER_PATH, { planning_strategy: { preset: 'balanced' } })
    const userTag = routerEtag(router.store.get(USER_PATH))
    const deckRt = await mountProbe({ flag, router }); await deckRt.api().select(deckOf('best')); await deckRt.settle()
    eq(lastPatch(deckRt).url, `/api/model-choice/prefs/deck/${SESSION}`); eq(lastPatch(deckRt).headers['If-Match'], EMPTY_ETAG, 'the deck\'s own tag, not the user map\'s')
    const userRt = await mountProbe({ flag, router, props: { sessionId: null } }); eq(userRt.api().scope, 'user'); await userRt.api().select(deckOf('economy')); await userRt.settle()
    eq(lastPatch(userRt).url, '/api/model-choice/prefs'); eq(lastPatch(userRt).headers['If-Match'], userTag, 'the user map\'s tag')
  }
})

// ================================================================ D. user scope
console.log('D. The reusable defaults (the user scope)')
const userOps = [
  ['GET', null, null, null],
  ['PATCH', 'tag', { planning_strategy: { preset: 'best' } }, 'strong'],
  ['PATCH', 'tag', { planning_strategy: { preset: 'best' } }, 'weak'],
  ['PATCH', 'tag', { planning_strategy: { preset: 'best' } }, 'other'],
  ['PATCH', 'tag', { planning_strategy: { preset: 'best' } }, 'unquoted'],
  ['PATCH', 'tag', { planning_strategy: { preset: 'best' } }, 'none'],
  ['PATCH', 'tag', { planning_strategy: { auto: true } }, 'strong'],
  ['PATCH', 'tag', { imagery: { preset: 'best' } }, 'strong'],
  ['PATCH', 'tag', {}, 'strong'],
]
async function userMatrix(server, flag) {
  const out = []
  for (const [method, , changes, tagKind] of userOps) {
    const router = modelRouter(), tag = routerEtag({})
    const sent = { strong: tag, weak: weak(tag), other: '"deadbeefdeadbeefdeadbeefdeadbeef"', unquoted: 'deadbeef', none: null }[tagKind] ?? null
    const outcome = method === 'GET' ? await server.handlePrefs('GET', null, { ifMatch: null }, routeDeps(router, flag)) : await server.handlePrefs('PATCH', null, { ifMatch: sent, body: async () => ({ preferences: changes }) }, routeDeps(router, flag))
    out.push({ method, tagKind, status: outcome.status, body: outcome.body, etag: outcome.etag ?? null, calls: router.log.map(entry => `${entry.method} ${entry.url} ${entry.headers['If-Match'] ?? '-'}`), kept: router.kept(USER_PATH) })
  }
  out.push({ unconfigured: await server.handlePrefs('GET', null, { ifMatch: null }, { ...routeDeps(modelRouter(), flag), env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', ...flagEnv(flag) } }) })
  out.push({ off: await server.handlePrefs('GET', null, { ifMatch: null }, { ...routeDeps(modelRouter(), flag), env: flagEnv(flag) }) })
  out.push({ signedOut: await server.handlePrefs('GET', null, { ifMatch: null }, { ...routeDeps(modelRouter(), flag), getSessionUser: async () => null }) })
  return out
}
await check('the user routes answer as the base does with the flag off; with it on, a request differs only when it carries the router\'s own tag weakened (saved, the router given its strong tag), and everything else (GET, strong, other, unquoted or no tag, auto, an unchosen group, an empty body, unconfigured, off, signed out) is the same', async () => {
  const off = await userMatrix(head), on = await userMatrix(head, 'true')
  deep(off, await userMatrix(base), 'flag off is the base')
  deep(on.map((o, i) => (JSON.stringify(o) === JSON.stringify(off[i]) ? null : `${o.method} ${o.tagKind}`)).filter(Boolean), ['PATCH weak'], 'flag on changes the weakened-tag request and no other')
  const weakOff = off.find(o => o.tagKind === 'weak'), weakOn = on.find(o => o.tagKind === 'weak')
  eq(weakOff.status, 412); eq(weakOn.status, 200); deep(weakOn.kept, { planning_strategy: 'best' })
  ok(weakOn.calls.some(call => call.startsWith('PATCH') && call.endsWith(` ${EMPTY_ETAG}`)), 'the router is sent its own strong tag'); ok(off.some(o => o.tagKind === 'strong' && o.status === 200))
})
await check('a browser save on the reusable default (E2E-2 capture: its GET comes back weakened too): flag off, the router\'s tag saves and the weakened one is refused 412 with the popover still saying "Saved"; flag on, both save, "Saved" comes only after a save, and a real concurrent change is refused in the existing words', async () => {
  for (const flag of [undefined, 'true']) {
    const clean = await mountProbe({ flag, props: { sessionId: null } }); eq(clean.api().scope, 'user'); eq(clean.api().saveNote, flag === 'true' ? '' : NOTES.account)
    deep(await clean.api().select(deckOf('best')), { kind: 'saved', choice: deckOf('best') }); await clean.settle(); deep(clean.router.kept(USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))); eq(clean.api().saveNote, NOTES.account)
    const altered = await mountProbe({ flag, edge: 'weaken', props: { sessionId: null } })
    const outcome = await altered.api().select(deckOf('best')); await altered.settle()
    eq(lastPatch(altered).url, '/api/model-choice/prefs'); eq(lastPatch(altered).headers['If-Match'], CAPTURE.user_get_etag, 'the browser sends the weakened tag it was given')
    if (flag === 'true') {
      eq(outcome.kind, 'saved'); deep(altered.router.kept(USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))); eq(altered.api().saveNote, NOTES.account); eq(altered.router.writes()[0].headers['If-Match'], EMPTY_ETAG)
    } else {
      eq(outcome.kind, 'conflict'); eq(altered.router.writes().length, 0); eq(altered.api().saveNote, NOTES.account, 'today: refused, and the note still says Saved'); eq(altered.api().feedback, WORDS.conflict)
    }
  }
  const rt = await mountProbe({ flag: 'true', edge: 'weaken', props: { sessionId: null } }); rt.router.seed(USER_PATH, Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'economy' }]))) // another tab
  eq((await rt.api().select(deckOf('best'))).kind, 'conflict'); await rt.settle()
  eq(rt.api().saveNote, WORDS.conflict); eq(rt.api().choice.tier, 'economy', 'the gauge shows what is stored'); eq(rt.router.writes().length, 0); eq(rt.patches().length, 1)
  deep(rt.router.kept(USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'economy'])))
  await rt.api().select(deckOf('balanced')); await rt.settle(); eq(rt.api().saveNote, NOTES.account, 'a later save that works says Saved again')
  rt.router.state.refuse.push('balanced'); await rt.api().select(deckOf('balanced')); await rt.settle(); eq(rt.api().saveNote, WORDS.refused, 'and a refused one says so')
})

// ================================================================ E. flag off is the base
console.log('E. Flag off is the base')
await check('the strip gives each edited file its base back, byte for byte; a file the change does not own comes back untouched; the flag is named only on marked lines and read in these two files only', () => {
  for (const rel of MODEL_CHOICE_DECK_SAVE_FILES) {
    eq(stripModelChoiceDeckSave(rel, read(rel)), baseFile(rel), `${rel}: without its marked lines the file is the base's`)
    ok(read(rel).split('\n').filter(line => line.includes('STUDIO_MODEL_CHOICE_DECK_SAVE')).every(line => MODEL_CHOICE_DECK_SAVE_MARKER_RE.test(line)), `${rel}: names the flag only on marked lines`)
    ok(!stripModelChoiceDeckSave(rel, read(rel)).includes('STUDIO_MODEL_CHOICE_DECK_SAVE'), rel)
  }
  eq(stripModelChoiceDeckSave('hooks/use-deckster-websocket-v2.ts', 'x'), 'x')
  for (const rel of stripModule.MODEL_CHOICE_DECK_SAVE_PIN_FILES) {
    eq(stripModelChoiceDeckSave(rel, read(rel)), baseFile(rel), `${rel}: the taught proof without this change's line is the base's, byte for byte`)
    for (const [has] of stripModule.MODEL_CHOICE_DECK_SAVE_PIN_EDITS[rel]) { eq(read(rel).split(has).length, 2, `${rel}: the taught line is there once`); ok(has.includes(stripModule.MODEL_CHOICE_DECK_SAVE_PIN_MARK) && has.endsWith('\n'), 'and carries the mark') }
  }
  eq(registry.stripLaterChanges(SERVER, read(SERVER)), registry.stripLaterChanges(SERVER, baseFile(SERVER)), 'through the registry the file is the base')
  const readers = git('grep', '-l', 'STUDIO_MODEL_CHOICE_DECK_SAVE', '--', 'app', 'lib', 'hooks', 'components', 'types', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).sort()
  deep(readers, [...MODEL_CHOICE_DECK_SAVE_FILES].sort(), 'no other source file reads or names the flag')
  ok(!MODEL_CHOICE_DECK_SAVE_FILES.some(rel => /^import /m.test(read(rel).split('\n').filter(line => MODEL_CHOICE_DECK_SAVE_MARKER_RE.test(line)).join('\n'))), 'no marked import: the older loaders hand these modules the imports they had')
})
const requests = [
  ['deck GET', 'GET', SESSION, null, null], ['user GET', 'GET', null, null, null],
  ['deck first save, strong', 'PATCH', SESSION, 'strong', BEST3], ['deck first save, weakened', 'PATCH', SESSION, 'weak', BEST3], ['deck first save, no tag', 'PATCH', SESSION, 'none', BEST3],
  ['deck save, another tag', 'PATCH', SESSION, 'other', BEST3], ['deck save, unquoted', 'PATCH', SESSION, 'unquoted', BEST3],
  ['deck auto', 'PATCH', SESSION, 'strong', { planning_strategy: { auto: true } }], ['deck, an unchosen group', 'PATCH', SESSION, 'strong', { imagery: { preset: 'best' } }],
  ['deck of another person', 'PATCH', 'sess-other', 'strong', BEST3], ['deck not saved yet', 'PATCH', 'sess-unknown', 'strong', BEST3],
  ['user save, strong', 'PATCH', null, 'strong', { content_writing: { preset: 'best' } }], ['user save, weakened', 'PATCH', null, 'weak', { content_writing: { preset: 'best' } }],
]
async function requestMatrix(server, flag, { concurrent = false } = {}) {
  const out = []
  for (const [label, method, deckKey, tagKind, changes] of requests) {
    const router = modelRouter(), tag = routerEtag({})
    if (concurrent) router.seed(deckKey ? `/v1/prefs/${ME.id}/sessions/${deckKey}` : USER_PATH, { content_writing: { preset: 'economy' } })
    const sent = { strong: tag, weak: weak(tag), other: '"deadbeefdeadbeefdeadbeefdeadbeef"', unquoted: 'deadbeef', none: null }[tagKind] ?? null
    const outcome = await server.handlePrefs(method, deckKey, { ifMatch: method === 'GET' ? null : sent, body: async () => ({ preferences: changes }) }, routeDeps(router, flag))
    out.push({ label, status: outcome.status, body: outcome.body, etag: outcome.etag ?? null, calls: router.log.map(entry => `${entry.method} ${entry.url} ${entry.headers['If-Match'] ?? '-'}`) })
  }
  return out
}
await check('flag off (unset, "", "false", "TRUE", "1"): the route answers a matrix of deck and user requests exactly as the base does (same hash), with and without a concurrent change; flag on differs only on the weakened tag of either scope', async () => {
  const want = sha(JSON.stringify(await requestMatrix(base, undefined))), wantConcurrent = sha(JSON.stringify(await requestMatrix(base, undefined, { concurrent: true })))
  for (const value of [undefined, '', 'false', 'TRUE', '1', ' true']) {
    eq(sha(JSON.stringify(await requestMatrix(head, value))), want, `flag ${JSON.stringify(value)}`); eq(sha(JSON.stringify(await requestMatrix(head, value, { concurrent: true }))), wantConcurrent, `flag ${JSON.stringify(value)}, concurrent`)
  }
  const on = await requestMatrix(head, 'true'), off = await requestMatrix(base, undefined)
  deep(on.map((o, i) => (JSON.stringify(o) === JSON.stringify(off[i]) ? null : o.label)).filter(Boolean), ['deck first save, weakened', 'user save, weakened'], 'flag on changes these two requests and no other')
  eq(sha(JSON.stringify(await requestMatrix(head, 'true', { concurrent: true }))), wantConcurrent, 'and a real concurrent change is answered as the base answers it')
})
/** One fixed script over the hook: the transcript is what the picker shows after each step. */
async function hookTranscript(rd, flag) {
  const steps = []
  const snap = (label, rt) => { const api = rt.api(); steps.push({ label, scope: api.scope, mode: api.mode, choice: api.choice ?? null, state: api.state, deckOwn: api.deckOwn ?? null, feedback: api.feedback, saveNote: api.saveNote, saving: api.saving, ready: api.ready, reason: api.reason }) }
  for (const edge of ['clean', 'weaken']) {
    const rt = await mountProbe({ read: rd, flag, edge }); snap(`${edge}: loaded`, rt)
    for (const choice of [deckOf('best'), deckOf('economy'), { auto: true }, null]) { const out = await rt.api().select(choice); await rt.settle(); steps.push({ label: `${edge}: select`, out }); snap(`${edge}: after ${JSON.stringify(choice)}`, rt) }
    rt.router.seed(DECK_PATH, { content_writing: { preset: 'max' } }); const out = await rt.api().select(deckOf('best')); await rt.settle(); steps.push({ label: `${edge}: concurrent`, out }); snap(`${edge}: after the concurrent change`, rt)
    steps.push({ writes: rt.router.writes().map(w => `${w.method} ${w.url} ${w.body}`), patches: rt.patches().map(p => p.headers['If-Match'] ?? '-') })
  }
  const refused = await mountProbe({ read: rd, flag, props: { sessionId: SESSION } }); refused.router.state.refuse.push('best'); steps.push({ label: 'refused', out: await refused.api().select(deckOf('best')) }); await refused.settle(); snap('refused', refused)
  const gone = await mountProbe({ read: rd, flag }); gone.router.state.deckScope = false; steps.push({ label: 'gone', out: await gone.api().select(deckOf('best')) }); await gone.settle(); snap('gone', gone)
  const down = await mountProbe({ read: rd, flag }); down.world.studio = 'down'; steps.push({ label: 'down', out: await down.api().select(deckOf('best')) }); await down.settle(); snap('down', down)
  const user = await mountProbe({ read: rd, flag, props: { sessionId: null }, edge: 'weaken' }); steps.push({ label: 'user', out: await user.api().select(deckOf('best')) }); await user.settle(); snap('user, weakened', user)
  const slider = await mountSlider({ read: rd, flag }); await slider.open(); steps.push({ label: 'slider', note: slider.note('save'), scope: slider.note('scope'), gauge: slider.gaugeLabel() }); await slider.commit('best'); steps.push({ label: 'slider after', note: slider.note('save'), gauge: slider.gaugeLabel() })
  return steps
}
await check('flag off (unset, "false", "1"): the hook shows the same after every step of a fixed script as the base does (same hash), the weakened-tag steps included; flag on differs', async () => {
  const want = sha(JSON.stringify(await hookTranscript(baseRead, undefined)))
  for (const value of [undefined, 'false', '1']) eq(sha(JSON.stringify(await hookTranscript(read, value))), want, `flag ${JSON.stringify(value)}`)
  ok(sha(JSON.stringify(await hookTranscript(read, 'true'))) !== want, 'the script is sensitive to the flag')
})

// ================================================================ F. scope over the committed diff, gate-safe
console.log('F. Scope over the committed diff (BASE..HEAD, gate-safe)')
const parentsOf = ref => git('rev-list', '--parents', '-n', '1', ref).trim().split(' ').slice(1)
const firstParentOwn = ref => git('rev-list', '--first-parent', '--no-merges', `${BASE}..${ref}`).split('\n').filter(Boolean)
const subjectOf = commit => git('log', '-1', '--format=%s', commit).trim()
/** The commit own-commit queries start from. On the gate's merge (HEAD^1 = BASE, HEAD^2 = this branch's head) a first-parent walk from HEAD finds nothing, so every own-commit query starts from HEAD^2. A merge whose first parent
 * is not BASE but whose first-parent line holds no commit of this change (dev moved on before the gate) is read the same way. Anything else (the branch itself, or the branch with dev merged into it) starts from the ref. */
function ownRef(ref) {
  const parents = parentsOf(ref)
  if (parents.length === 2 && parents[0] === BASE) return parents[1]
  if (parents.length === 2 && !firstParentOwn(ref).some(commit => subjectOf(commit).startsWith(MODEL_CHOICE_DECK_SAVE_SUBJECT))) return parents[1]
  return ref
}
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'proof', GIT_AUTHOR_EMAIL: 'proof@example.test', GIT_COMMITTER_NAME: 'proof', GIT_COMMITTER_EMAIL: 'proof@example.test', GIT_AUTHOR_DATE: '2026-10-27T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T00:00:00Z' }
/** The gate's merge of `head` onto BASE: `git commit-tree $(git merge-tree --write-tree BASE head) -p BASE -p head`. */
function gateMerge(headRef) {
  const tree = git('merge-tree', '--write-tree', BASE, headRef).split('\n')[0].trim()
  return execFileSync('git', ['commit-tree', tree, '-p', BASE, '-p', headRef, '-m', 'gate-style merge (proof)'], { cwd: root, encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
const SECRETS = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-|Bearer [A-Za-z0-9._-]{16,})/
const EXPECTED_MARKED = { [SERVER]: 6, [HOOK]: 6 }
async function scopeChecks(ref, title) {
  const R = ownRef(ref), own = firstParentOwn(R), at = rel => git('show', `${ref}:${rel}`)
  await check(`${title}: this change's own commits (read from ${R === ref ? 'the ref' : 'its second parent'}; first-parent, no merges, subject "${MODEL_CHOICE_DECK_SAVE_SUBJECT}") exist, every one is, with the co-author line`, () => {
    ok(own.length >= 1, 'no own commit yet')
    for (const c of own) {
      ok(subjectOf(c).startsWith(MODEL_CHOICE_DECK_SAVE_SUBJECT), `subject of ${c.slice(0, 8)}`)
      assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
    }
  })
  await check(`${title}: the files the own commits touch are exactly this change's; every line added to an existing file is a pure insertion that carries the marker; the strip gives each its base back`, () => {
    const touched = new Set(); for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
    deep([...touched].filter(rel => MODEL_CHOICE_DECK_SAVE_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort(), [...MODEL_CHOICE_DECK_SAVE_SCOPE_FILES].sort())
    for (const rel of MODEL_CHOICE_DECK_SAVE_FILES) {
      const diff = git('diff', '-U0', BASE, ref, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      for (const line of diff) { ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, MODEL_CHOICE_DECK_SAVE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
      eq(diff.length, EXPECTED_MARKED[rel], `${rel}: the marked lines`)
      eq(stripModelChoiceDeckSave(rel, at(rel)), baseFile(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
    }
    for (const rel of MODEL_CHOICE_DECK_SAVE_NEW_FILES) eq(git('cat-file', '-t', `${ref}:${rel}`).trim(), 'blob', rel)
    for (const rel of stripModule.MODEL_CHOICE_DECK_SAVE_PIN_FILES) {
      const diff = git('diff', '-U0', BASE, ref, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line)), edits = stripModule.MODEL_CHOICE_DECK_SAVE_PIN_EDITS[rel]
      const lines = text => text.split('\n').length - 1
      eq(diff.filter(line => line.startsWith('+')).length, edits.reduce((n, [has]) => n + lines(has), 0), `${rel}: the lines the taught proof has now`); eq(diff.filter(line => line.startsWith('-')).length, edits.reduce((n, [, was]) => n + lines(was), 0), `${rel}: the lines it had`)
      for (const line of diff.filter(line => line.startsWith('+'))) ok(line.includes(stripModule.MODEL_CHOICE_DECK_SAVE_PIN_MARK), `${rel}: every line added carries the mark`)
      eq(stripModelChoiceDeckSave(rel, at(rel)), baseFile(rel), `${rel}: the taught proof is the base's without the lines`)
    }
  })
  await check(`${title}: .env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files`, () => {
    eq(registry.stripLaterEnvBlocks(ENV, at(ENV)), registry.stripLaterEnvBlocks(ENV, `${baseFile(ENV)}\n${MODEL_CHOICE_DECK_SAVE_ENV_BLOCK}`))
    ok(at(ENV).includes(`\n\n${MODEL_CHOICE_DECK_SAVE_ENV_BLOCK}`), 'a blank line before the block')
    const diff = git('diff', '-U0', BASE, ref, '--', REGISTRY).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    eq(diff.length, 3); for (const line of diff) ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-model-choice-deck-save-strip.mjs'), line.slice(0, 140))
    for (const rel of MODEL_CHOICE_DECK_SAVE_NEW_FILES) assert.doesNotMatch(at(rel).replace(/Bearer \$\{KEY\}/g, ''), SECRETS, rel)
  })
}
await scopeChecks('HEAD', 'HEAD')
let mineHead = 'HEAD'
await check('the gate-style merge is built the way the gate builds it (git merge-tree --write-tree BASE head; git commit-tree -p BASE -p head), and the old first-parent query finds nothing on it while HEAD^2 finds the branch', () => {
  mineHead = ownRef('HEAD')
  const merge = gateMerge(mineHead)
  deep(parentsOf(merge), [BASE, git('rev-parse', mineHead).trim()]); eq(git('rev-parse', `${merge}^{tree}`).trim(), git('rev-parse', `${mineHead}^{tree}`).trim(), 'its tree is the branch\'s tree')
  deep(firstParentOwn(merge), [], 'a walk from the merge along first parents finds no commit of this change')
  ok(firstParentOwn(ownRef(merge)).length >= 1, 'the walk from HEAD^2 does')
})
{
  const merge = gateMerge(mineHead)
  await scopeChecks(merge, 'on a gate-style merge')
}
await check('and a merge the gate makes after dev moved on (a later commit on BASE\'s side) is read from its second parent too', () => {
  const tip = execFileSync('git', ['commit-tree', git('rev-parse', `${BASE}^{tree}`).trim(), '-p', BASE, '-m', 'dev moved on (proof)'], { cwd: root, encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const tree = git('merge-tree', '--write-tree', tip, mineHead).split('\n')[0].trim()
  const merge = execFileSync('git', ['commit-tree', tree, '-p', tip, '-p', mineHead, '-m', 'gate-style merge, dev moved (proof)'], { cwd: root, encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  eq(ownRef(merge), git('rev-parse', mineHead).trim()); ok(firstParentOwn(ownRef(merge)).every(c => subjectOf(c).startsWith(MODEL_CHOICE_DECK_SAVE_SUBJECT)))
})

// ================================================================ G. mutants
if (process.env.MODEL_CHOICE_DECK_SAVE_NO_MUTANTS === '1') { console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed (mutants skipped)`); process.exit(failed ? 1 : 0) }
console.log('G. Mutants (each must make the expectations fail)')
const serverText = read(SERVER), hookText = read(HOOK)
const mutate = (text, from, to, label) => { assert.equal(text.split(from).length, 2, `mutant "${label}": the anchor must be there exactly once: ${from.slice(0, 80)}`); return text.replace(from, () => to) }
/** The core expectations, short: the route and the hook against the behaviour the fix promises, run over whatever sources `overrides` holds. */
async function expectations() {
  const rd = read, server = loadServer(rd)
  { // the route
    const router = modelRouter(), tag = await getTag(server, router, SESSION, 'true')
    eq((await patchOf(server, router, SESSION, weak(tag), BEST3, 'true')).status, 200, 'flag on, weakened: written')
    for (const value of [undefined, 'false']) { const off = modelRouter(); eq((await patchOf(server, off, SESSION, weak(await getTag(server, off, SESSION)), BEST3, value)).status, 412, `flag ${value}, weakened: today's 412`) }
    const concurrent = modelRouter(), seen = await getTag(server, concurrent, SESSION, 'true'); concurrent.seed(DECK_PATH, { content_writing: { preset: 'economy' } })
    eq((await patchOf(server, concurrent, SESSION, weak(seen), BEST3, 'true')).status, 412, 'flag on, a real change: refused'); eq(concurrent.writes().length, 0)
    const user = modelRouter(), userTag = await getTag(server, user, null, 'true')
    eq((await userPatchOf(server, user, weak(userTag), BEST_WRITING, 'true')).status, 200, 'flag on, user scope, weakened: written'); deep(user.writes().map(w => w.headers['If-Match']), [EMPTY_ETAG], 'the router is sent its own strong tag')
    for (const value of [undefined, 'false']) { const userOff = modelRouter(); eq((await userPatchOf(server, userOff, weak(await getTag(server, userOff, null, value)), BEST_WRITING, value)).status, 412, `flag ${value}, user scope, weakened: today's 412`) }
    const userChanged = modelRouter(), seenUser = await getTag(server, userChanged, null, 'true'); userChanged.seed(USER_PATH, { planning_strategy: { preset: 'economy' } })
    eq((await userPatchOf(server, userChanged, weak(seenUser), BEST_WRITING, 'true')).status, 412, 'flag on, user scope, a real change: refused'); eq(userChanged.writes().length, 0)
    const race = modelRouter(), raceTag = await getTag(server, race, null, 'true'); race.state.race = () => race.seed(USER_PATH, { planning_strategy: { preset: 'economy' } })
    eq((await userPatchOf(server, race, weak(raceTag), BEST_WRITING, 'true')).status, 412, 'a racing write is refused by the router\'s own precondition'); eq(race.kept(USER_PATH).content_writing, undefined)
  }
  { // the hook
    const on = await mountProbe({ read: rd, flag: 'true', edge: 'weaken' }); eq(on.api().saveNote, '', 'nothing before a save')
    eq((await on.api().select(deckOf('best'))).kind, 'saved'); await on.settle(); eq(on.api().saveNote, NOTES.account, 'saved')
    await on.setProps({ sessionId: SESSION_2 }); eq(on.api().saveNote, '', 'a new presentation: nothing yet')
    const refused = await mountProbe({ read: rd, flag: 'true', edge: 'weaken' }); await refused.api().select(deckOf('best')); await refused.settle()
    refused.router.seed(DECK_PATH, { content_writing: { preset: 'economy' } }); await refused.api().select(deckOf('balanced')); await refused.settle(); eq(refused.api().saveNote, WORDS.conflict, 'a refused save speaks')
    const user = await mountProbe({ read: rd, flag: 'true', edge: 'weaken', props: { sessionId: null } }); eq(user.api().saveNote, '', 'user scope: nothing before a save')
    eq((await user.api().select(deckOf('best'))).kind, 'saved'); await user.settle(); eq(user.api().saveNote, NOTES.account, 'user scope: saved'); user.router.seed(USER_PATH, Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'economy' }])))
    await user.api().select(deckOf('balanced')); await user.settle(); eq(user.api().saveNote, WORDS.conflict, 'user scope: a refused save speaks')
    const device = await mountProbe({ read: rd, flag: 'true' }); device.router.state.putStatus = 500; await device.api().select(deckOf('best')); await device.settle(); eq(device.api().saveNote, NOTES.unreachable, 'the device note')
    for (const value of [undefined, 'false']) {
      const off = await mountProbe({ read: rd, flag: value, edge: 'weaken' }); eq(off.api().saveNote, NOTES.account, `flag ${value}: the standing note`); await off.api().select(deckOf('best')); await off.settle(); eq(off.api().saveNote, NOTES.account, `flag ${value}: unchanged after a failed save`)
      const offDevice = await mountProbe({ read: rd, flag: value }); offDevice.router.state.putStatus = 500; await offDevice.api().select(deckOf('best')); await offDevice.settle(); eq(offDevice.api().saveNote, NOTES.unreachable)
    }
  }
}
await check('the expectations pass on the real files (so a mutant failing them is the mutant\'s doing)', async () => { overrides = {}; await expectations() })
const mutants = [
  ['server: the weak mark counts as part of the value', SERVER, ".replace(/^W\\//, '')", ''],
  ['server: any two tags are the same read (a concurrent change is accepted)', SERVER, 'return sent !== null && current !== null && opaque(sent) === opaque(current)', 'return sent !== null && current !== null'],
  ['server: the user scope\'s compare is dropped (only the deck scope is normalised)', SERVER, 'if (deckSaveOn(deps.env) && sameEntityTag(', 'if (deck && deckSaveOn(deps.env) && sameEntityTag('],
  ['server: the deck scope\'s compare is dropped (only the user scope is normalised)', SERVER, 'if (deckSaveOn(deps.env) && sameEntityTag(', 'if (!deck && deckSaveOn(deps.env) && sameEntityTag('],
  ['server: the flag is ignored', SERVER, 'if (deckSaveOn(deps.env) && sameEntityTag(', 'if (sameEntityTag('],
  ['server: the router gets no If-Match on the user PATCH (its precondition is dropped)', SERVER, "{ preferences: changes }, current.etag)", '{ preferences: changes })'],
  ['server: the router gets the browser\'s tag on the user PATCH', SERVER, "{ preferences: changes }, current.etag)", '{ preferences: changes }, request.ifMatch)'],
  ['server: the flag is loose', SERVER, "export const deckSaveOn = (env: Env) => env[MODEL_CHOICE_DECK_SAVE_FLAG] === 'true'", 'export const deckSaveOn = (env: Env) => Boolean(env[MODEL_CHOICE_DECK_SAVE_FLAG])'],
  ['hook: the flag is ignored', HOOK, 'DECK_SAVE_ON && meta.mode === "account"', 'meta.mode === "account"'],
  ['hook: the success note stands before any save', HOOK, '(confirmed ? saveNote(meta.mode, meta.reason, true) : "")', 'saveNote(meta.mode, meta.reason, true)'],
  ['hook: a failed save says nothing', HOOK, '{ saveNote: feedback || (confirmed', '{ saveNote: (confirmed'],
  ['hook: no save is ever confirmed', HOOK, 'setConfirmed(outcome.kind === "saved" && result.mode === "account")', 'setConfirmed(false)'],
  ['hook: a success survives a change of presentation', HOOK, '    setConfirmed(false) // MODEL-CHOICE-DECK-SAVE\n', ''],
  ['hook: the note is replaced on the device modes too', HOOK, 'DECK_SAVE_ON && meta.mode === "account" && (loaded', 'DECK_SAVE_ON && (loaded'],
  ['hook: the flag is loose', HOOK, 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)'],
]
for (const [label, rel, from, to] of mutants) await check(`mutant caught: ${label}`, async () => {
  overrides = { [rel]: mutate(rel === SERVER ? serverText : hookText, from, to, label) }
  try { await assert.rejects(() => expectations(), undefined, 'the expectations must fail on this mutant') } finally { overrides = {} }
})
await check('mutant caught: an unmarked line added to either file is not stripped, so the strip no longer gives the base back; #521\'s marker is not this one', async () => {
  for (const [rel, text, anchor] of [[SERVER, serverText, 'export const notFound = '], [HOOK, hookText, 'const CATALOGUE_ROUTE_ON = ']]) {
    const mutated = mutate(text, anchor, `const extra = 1\n${anchor}`, 'unmarked')
    assert.notEqual(stripModelChoiceDeckSave(rel, mutated), stripModelChoiceDeckSave(rel, text))
  }
  const { MODEL_CHOICE_MARKER_RE } = await import('./studio-model-choice-strip.mjs')
  eq(MODEL_CHOICE_MARKER_RE.test('x // MODEL-CHOICE-DECK-SAVE'), false); eq(MODEL_CHOICE_DECK_SAVE_MARKER_RE.test('x // MODEL-CHOICE'), false); eq(MODEL_CHOICE_DECK_SAVE_MARKER_RE.test('x // MODEL-CHOICE-DECK-SAVE'), true); eq(MODEL_CHOICE_DECK_SAVE_MARKER_RE.test('x // MODEL-CHOICE-DECK-SAVE-X'), false)
})
await check('mutant caught: the old scope query (first-parent from HEAD) finds no own commit on a gate-style merge, so a proof that used it would fail there', () => {
  const merge = gateMerge(mineHead)
  eq(firstParentOwn(merge).length, 0)
})

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
