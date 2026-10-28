// FRONTEND-2 (B37 follow-up; E2E-2's capture of 28 Oct 02:15-02:17Z on Studio dev with #542 merged at 88c59f3c and DECK_SAVE on): proof of NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION (exact "true", default off, build-time).
//
// THE DEFECT: after #542 a save PERSISTS (the GET shows it, it survives a reload) but EVERY PATCH answers 412 with a Vercel HTML error page ("An error occurred · PRECONDITION_FAILED · iad1::..."), not Studio's JSON. The 1st PATCH sent
// If-Match W/"4f53...", the 2nd W/"ce6f..." (after a GET). Studio's route passes its own check and writes; Vercel's edge then applies the request's If-Match to the function's RESPONSE, whose ETag changed with the write, and swaps in its own 412.
// The popover then says "Your choices changed elsewhere ..." for a save that worked (scripts/fixtures/studio-model-choice-prefs-version/e2e2-edge-412-recorded.json, "E2E-2 capture 28 Oct 02:15-02:17Z").
//
// THE FIX (flag on, both scopes): (1) the browser sends the read's version in X-Prefs-Version and never If-Match (routeFetch in the hook and in the Intelligence page, lib/studio-model-choice.ts versionRequest), so the edge has nothing conditional
// to evaluate; (2) the routes read X-Prefs-Version first (If-Match still accepted), compare it as an opaque tag, send the version back in X-Prefs-Version on every answer (ETag stays on a read), and a really stale read is still Studio's JSON 412;
// the router call is unchanged (Studio's own strong current.etag as If-Match); (3) a 412 that is not Studio's own JSON no longer reads as "changed elsewhere": the adapter reads the choices again, saved if they are what was asked for, else the
// stored choice with the existing refusal words.
// THE READ PATH needs nothing: the hook fetches with cache "no-store" (components/model-choice/use-model-choice.ts routeFetch), so a read carries no If-None-Match or If-Modified-Since for the edge to turn into a 304, and the routes answer
// Cache-Control: no-store (app/api/model-choice/prefs/route.ts reply). A browser that did revalidate would be handed its cached copy for a 304 anyway. Checked below (F).
//
//   A. the capture   the edge model (If-Match applied to the response) over the REAL routes, server, adapter, hook and slider, and a router built from its handlers: flag off reproduces E2E-2's run
//   B. flag on       no If-Match leaves the browser; the save succeeds, no conflict note, "Saved" after it; the router is sent its strong tag; both scopes; the version comes back in X-Prefs-Version
//   C. stale reads   a really stale read is still Studio's JSON 412, both scopes, flag on and off, and the picker says what it says
//   D. the routes    X-Prefs-Version first, If-Match still accepted, opaque compare, a bad version is 400; flag off ignores the header
//   E. error pages   a 412 that is not Studio's JSON: written -> saved, not written -> refusal words and the stored choice, never "changed elsewhere"
//   F. the read path no conditional header on a read, no-store, a 304 is transparent
//   G. flag off      the base: the strip gives each file's base back byte for byte; routes and hook answer the same hashes as the base
//   H. scope         the COMMITTED diff, gate-safe (HEAD^2 when HEAD is the gate's merge), proven on a gate-style merge
//   I. mutants       each one must make the expectations fail
//
//   node scripts/test-studio-model-choice-prefs-version.mjs        (MODEL_CHOICE_PREFS_VERSION_NO_MUTANTS=1 skips I)
//
// Offline: no socket, fetch or real timer; the router is an in-process fake built from the router's own handler code; git is read for G and H (and H writes unreachable commit objects for the gate-style merges).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { FILES, loadPicker, root, runModule } from './studio-model-picker-kit.mjs'

const nodeRequire = createRequire(path.join(root, 'package.json'))
const nextServer = nodeRequire('next/server')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const eq = assert.equal, ok = assert.ok
const deep = (a, b, message) => { const x = JSON.parse(JSON.stringify(a)), y = JSON.parse(JSON.stringify(b)); if (message === undefined) assert.deepStrictEqual(x, y); else assert.deepStrictEqual(x, y, message) }

const PV = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION', DS = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE'
const SERVER = 'lib/studio-model-choice-server.ts', LIB = FILES.choice, HOOK = FILES.hook, CHOOSER = 'components/studio-personal/intelligence-model-choice.tsx'
const USER_ROUTE = 'app/api/model-choice/prefs/route.ts', DECK_ROUTE = 'app/api/model-choice/prefs/deck/[deckKey]/route.ts'
const REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
const FIX = 'scripts/fixtures/studio-model-choice', DFIX = 'scripts/fixtures/studio-model-choice-deck-save', PFIX = 'scripts/fixtures/studio-model-choice-prefs-version'

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n       ')}`) }
}

let overrides = {}
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const json = rel => JSON.parse(read(rel))
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-model-choice-prefs-version-strip.mjs')
const {
  stripModelChoicePrefsVersion, BASE_COMMIT: BASE, MODEL_CHOICE_PREFS_VERSION_FILES: STRIPPED_FILES, MODEL_CHOICE_PREFS_VERSION_SCOPE_FILES: SCOPE_FILES, MODEL_CHOICE_PREFS_VERSION_NEW_FILES: NEW_FILES,
  MODEL_CHOICE_PREFS_VERSION_ENV_BLOCK: ENV_BLOCK, MODEL_CHOICE_PREFS_VERSION_SUBJECT: SUBJECT, MODEL_CHOICE_PREFS_VERSION_MARKER_RE: MARKER_RE,
} = stripModule
const baseFile = rel => git('show', `${BASE}:${rel}`)
const baseRead = rel => (STRIPPED_FILES.includes(rel) ? baseFile(rel) : read(rel))
/** What a file is with the strips of every change registered AFTER this one applied first: a later change's marked lines are its own (the pattern of #532 for #522's pins). Applying mine on top gives the base. */
const laterStrips = () => registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(stripModelChoicePrefsVersion) + 1)
const afterLater = (rel, text) => laterStrips().reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
/** The lines `b` has that `a` has not, "+", and the lines it lost, "-" (a multiset difference: these changes only insert lines). */
const lineDiff = (a, b) => { const count = new Map(); for (const line of a.split('\n')) count.set(line, (count.get(line) ?? 0) - 1); for (const line of b.split('\n')) count.set(line, (count.get(line) ?? 0) + 1); return [...count].flatMap(([line, n]) => Array(Math.abs(n)).fill(`${n > 0 ? '+' : '-'}${line}`)) }
/** The registry lines of every change registered after this one, read from the registry text: whatever sits below this change's own line in each list, in the registered shape. */
const laterRegistryLines = text => { const later = new Set(); let after = false; for (const line of text.split('\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-model-choice-prefs-version-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later }

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
}
const CAPTURE = json(`${PFIX}/e2e2-edge-412-recorded.json`).observed // E2E-2 capture 28 Oct 02:15-02:17Z
const EARLIER = json(`${DFIX}/e2e2-f8-recorded.json`)
const EMPTY_ETAG = EARLIER.empty_deck_etag
const CATALOGUE_VERSION = json(`${DFIX}/router-session-get-empty-200.json`).catalogue_version
const BEST3 = Object.fromEntries(TEXT_GROUPS.map(group => [group, { preset: 'best' }]))
const weak = tag => `W/${tag}`
const opaque = tag => String(tag).trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1')

// ---------------------------------------------------------------- the router, from its own code (app/read_api.py at c19a384f), as in #542's proof
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


// ---------------------------------------------------------------- the real routes and server, the real browser code, and the edge between them
const flagEnv = ({ ds, pv } = {}) => ({ ...(ds === undefined ? {} : { [DS]: ds }), ...(pv === undefined ? {} : { [PV]: pv }) })
const DEV = { ds: 'true' } // Studio dev as E2E-2 found it: #542's flag on, this change's off
const ON = { ds: 'true', pv: 'true' }
/** The server stack (the adapter lib, the server lib) and the two real route modules, over a router, all reading `env` as process.env. */
function loadRoutes(rd, env, router) {
  const opts = { read: rd, context: { process: { env } } }
  const p2 = runModule(FILES.p2, {}, opts), cat = runModule(FILES.catalog, {}, opts)
  const choice = runModule(FILES.choice, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat }, opts)
  const server = runModule(SERVER, { '@/lib/studio-model-choice': choice }, opts)
  const deps = { 'next/server': nextServer, 'next-auth': { getServerSession: async () => ({ user: ME }) }, '@/lib/auth-options': { authOptions: {} }, '@/lib/studio-model-choice-server': server, '@/lib/prisma': { prisma: { chatSession: { findUnique: async ({ where }) => OWNED[where.id] ?? null } } } }
  const route = rel => runModule(rel, deps, { read: rd, context: { process: { env }, fetch: router.fetch, console } })
  return { server, user: route(USER_ROUTE), deck: route(DECK_ROUTE) }
}
const asRequest = (path, { method = 'GET', headers = {}, body } = {}) => new nextServer.NextRequest(`https://studio.example.test${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
/** One call of a real route function: status, headers (lower-cased), the text and the parsed body (null when it is not JSON). */
async function callRoute(routes, scope, method, { headers = {}, body, deckKey = SESSION } = {}) {
  const path = scope === 'deck' ? `/api/model-choice/prefs/deck/${deckKey}` : '/api/model-choice/prefs'
  const response = await routes[scope][method](asRequest(path, { method, headers, body }), { params: Promise.resolve(scope === 'deck' ? { deckKey } : {}) })
  const text = await response.text()
  let parsed = null; try { parsed = JSON.parse(text) } catch { parsed = null }
  return { status: response.status, headers: new Map([...response.headers].map(([k, v]) => [k.toLowerCase(), v])), text, body: parsed }
}
/** Vercel's edge, as E2E-2 captured it (27 Oct 22:49Z and 28 Oct 02:15-02:17Z): it compresses a 200, so its strong ETag goes on as W/"..." (weaken); it applies a request's If-Match to the RESPONSE and, when the response's ETag is not
 * the one asked for, swaps in its own 412 HTML error page (ifMatch); it answers a revalidating read with a 304 (ifNoneMatch). failBefore / failAfter force that error page before / after the function ran (an edge failure of any kind). */
const VERCEL = { weaken: true, ifMatch: true, ifNoneMatch: true }

const tick = () => new Promise(resolve => setImmediate(resolve))
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree, ...walk(tree.props?.children)]
const textOf = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : tree && typeof tree === 'object' ? textOf(tree.props?.children ?? '') : ''
function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)) }, removeItem: key => { map.delete(key) } }
}

/** The picker / slider / a probe of useModelChoice under a small hook runtime, with the real routes behind its fetch, the edge between, and the fake router behind that. */
async function mount({ read: rd = read, flags = DEV, edge = VERCEL, router = modelRouter(), storage = makeStorage(), props = { sessionId: null }, probe = true } = {}) {
  const hookEnv = { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true', ...flagEnv(flags) }
  const routeEnv = { ...CONFIGURED, ...flagEnv(flags) }
  const world = { studio: 'up', edge: { ...edge }, fetchLog: [], responses: [], swaps: [], failRead: false, storage, router, cache: new Map(), routes: loadRoutes(rd, routeEnv, router) }
  const plain = (status, text, headers = new Map()) => ({ status, headers: { get: name => headers.get(name.toLowerCase()) ?? null }, json: async () => JSON.parse(text) })
  const errorPage = (why, status = world.edge.failStatus ?? 412) => { world.swaps.push(why); if (world.edge.failReadAfter) world.failRead = true; const headers = new Map([['content-type', CAPTURE.every_patch_content_type]]); world.responses.push({ status, headers: Object.fromEntries(headers), text: CAPTURE.every_patch_body_text, page: true }); return plain(status, CAPTURE.every_patch_body_text, headers) }
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET', headers = { ...(init.headers ?? {}) }
    const entry = { url: String(url), method, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), body: init.body ?? null, cache: init.cache, credentials: init.credentials }
    world.fetchLog.push(entry)
    if (url === '/api/models/catalogue') return plain(200, JSON.stringify(json(`${FIX}/catalogue-live-shape.json`)))
    if (world.studio === 'down') throw new TypeError('Failed to fetch')
    if (!String(url).startsWith('/api/model-choice/prefs')) throw new Error(`the browser asked for ${url}`)
    const scope = String(url).startsWith('/api/model-choice/prefs/deck/') ? 'deck' : 'user'
    const deckKey = scope === 'deck' ? decodeURIComponent(String(url).slice('/api/model-choice/prefs/deck/'.length)) : undefined
    const sent = { ...headers }
    const cached = world.cache.get(String(url))
    if (method === 'GET' && init.cache !== 'no-store' && cached) sent['If-None-Match'] = cached.etag // the browser's HTTP cache revalidates a read it may keep
    if (world.failRead && method === 'GET') { world.failRead = false; world.responses.push({ status: 502, page: true }); return plain(502, 'Bad Gateway', new Map([['content-type', 'text/html']])) }
    if (world.edge.failBefore && method === 'PATCH') return errorPage('before')
    const out = await callRoute(world.routes, scope, method, { headers: sent, body: init.body, deckKey })
    if (world.edge.weaken && out.status === 200 && out.headers.get('etag') && !out.headers.get('etag').startsWith('W/')) out.headers.set('etag', weak(out.headers.get('etag')))
    const ifMatch = sent['If-Match'] ?? sent['if-match']
    if (world.edge.ifMatch && ifMatch && out.headers.get('etag') && opaque(ifMatch) !== opaque(out.headers.get('etag'))) return errorPage('if-match')
    if (world.edge.failAfter && method === 'PATCH') return errorPage('after')
    const ifNoneMatch = sent['If-None-Match']
    if (world.edge.ifNoneMatch && ifNoneMatch && out.headers.get('etag') && opaque(ifNoneMatch) === opaque(out.headers.get('etag'))) { world.swaps.push('304'); return plain(cached.status, cached.text, cached.headers) } // a 304 is served from the cache, as a browser does
    if (method === 'GET' && out.status === 200 && out.headers.get('etag')) world.cache.set(String(url), { etag: out.headers.get('etag'), status: 200, text: out.text, headers: out.headers })
    world.responses.push({ method, url: String(url), status: out.status, headers: Object.fromEntries(out.headers), text: out.text, body: out.body })
    return plain(out.status, out.text, out.headers)
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
const lastPatch = rt => rt.patches().at(-1)
const KEPT_BEST3 = Object.fromEntries(TEXT_GROUPS.map(g => [g, 'best']))

/** The copy of routeFetch in `source` (the hook's, the Intelligence page's), run with a stand-in fetch: flag off it sends what it was given and reads ETag; flag on it moves If-Match to X-Prefs-Version and reads X-Prefs-Version. */
async function routeFetchChecks(rel, source) {
  const start = source.indexOf('const routeFetch: RouteFetch = async (url, init) => {'), text = source.slice(start, source.indexOf('\n}\n', start) + 3)
  ok(text.includes('versionRequest(init)'), `${rel}: the move is there`)
  const js = ts.transpileModule(`${text}\nmodule.exports = routeFetch`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  for (const on of [false, true]) {
    const calls = []
    const sandbox = { module: { exports: null }, PREFS_VERSION_ON: on, versionRequest: init => (init.headers && 'If-Match' in init.headers ? (({ 'If-Match': tag, ...rest }) => ({ ...init, headers: { ...rest, 'X-Prefs-Version': tag } }))(init.headers) : init), fetch: async (url, init) => { calls.push(init); return { status: 200, json: async () => ({}), headers: { get: n => ({ 'x-prefs-version': '"v2"', etag: 'W/"e1"' })[n] ?? null } } } }
    vm.runInNewContext(js, sandbox)
    const answer = await sandbox.module.exports('/x', { method: 'PATCH', headers: { 'If-Match': '"v1"' }, body: '{}' })
    eq(answer.etag, on ? '"v2"' : 'W/"e1"', `${rel}: the version read, flag ${on}`); eq('If-Match' in calls[0].headers, !on, `${rel}: If-Match, flag ${on}`); eq(calls[0].headers['X-Prefs-Version'], on ? '"v1"' : undefined, `${rel}: X-Prefs-Version, flag ${on}`); eq(calls[0].cache, 'no-store', `${rel}: no-store`)
  }
}
/** keep() of the Intelligence page, cut out of the source and run with stand-ins: an unconfirmed save (the adapter's result for a 412 that was not Studio's JSON) shows the stored choice and answers a refusal; flag off the page is as it was. */
async function keepChecks(source) {
  const at = source.indexOf('async function keep(next: ModelChoices)'), keep = source.slice(at, source.indexOf('\n  }\n', at) + 5)
  ok(keep.includes('PREFS_VERSION_ON') && keep.includes('save_unconfirmed'), 'the branch is there')
  const js = ts.transpileModule(`${keep}\nmodule.exports = keep`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  for (const on of [false, true]) {
    const set = [], stored = { planning_strategy: 'economy' }
    const sandbox = { module: { exports: null }, PREFS_VERSION_ON: on, scope: { kind: 'user' }, raw: { planning_strategy: 'default' }, storage: 'ok', setFor: (target, value) => set.push(value), store: { saveChoices: async () => ({ mode: 'account', reason: null, conflict: stored, unconfirmed: true }), mode: () => 'account', reason: () => null }, setMode() {}, setReason() {}, setStorage() {}, setDeckState() {}, setScopeKind() {} }
    vm.runInNewContext(js, sandbox); const result = await sandbox.module.exports({ planning_strategy: 'best' })
    deep(set.at(-1), stored, `flag ${on}: the stored choice is shown`)
    if (on) { eq(result.refused, true); eq(result.refusedCode, 'save_unconfirmed'); ok(!result.conflict) } else ok(result.conflict, 'flag off: as a conflict, as today')
  }
}

const prefsResponses = rt => rt.world.responses.filter(r => r.url?.startsWith('/api/model-choice/prefs'))
const BEST_KEPT = KEPT_BEST3
const gaugeBest = 'Model: Best'

// ================================================================ A. the capture, reproduced
console.log('A. E2E-2\'s capture, reproduced (this flag off)')
await check('E2E-2 capture 28 Oct 02:15-02:17Z, deck: the first PATCH sends If-Match W/"4f53...", Studio writes, Vercel swaps in its HTML 412, and the popover says "changed elsewhere"; the second PATCH, after a GET, fails the same way', async () => {
  const rt = await mountSlider(); await rt.open(); eq(rt.gaugeLabel(), 'Model: Auto')
  await rt.commit('best')
  eq(rt.patches()[0].headers['if-match'], CAPTURE.first_patch_if_match, 'the captured If-Match')
  deep(rt.router.kept(DECK_PATH), BEST_KEPT, 'the save was written (it persists)'); deep(rt.world.swaps, ['if-match'], 'and the edge swapped in its page')
  const page = rt.world.responses.find(r => r.page); eq(page.status, 412); eq(page.text, CAPTURE.every_patch_body_text); eq(page.headers['content-type'], CAPTURE.every_patch_content_type)
  eq(rt.note('save'), WORDS.conflict, 'the popover: "changed elsewhere", for a save that worked'); eq(rt.gaugeLabel(), gaugeBest, 'the re-read shows what is stored')
  await rt.commit('balanced')
  const second = rt.patches()[1].headers['if-match']; ok(/^W\/"[0-9a-f]{32}"$/.test(second) && second !== CAPTURE.first_patch_if_match, 'the second If-Match is the new tag as a GET gave it, weakened'); ok(/^W\/"[0-9a-f]{32}"$/.test(CAPTURE.second_patch_if_match))
  deep(rt.world.swaps, ['if-match', 'if-match'], 'every PATCH')
})
await check('the same for the reusable defaults (E2E-2 did not PATCH them, to keep decksterqa\'s): the user GET is weakened too, and the PATCH is swapped the same way', async () => {
  const rt = await mountProbe({ props: { sessionId: null } }); eq(rt.api().scope, 'user')
  await rt.api().select(deckOf('best')); await rt.settle()
  eq(lastPatch(rt).url, '/api/model-choice/prefs'); ok(/^W\//.test(lastPatch(rt).headers['if-match'])); deep(rt.router.kept(USER_PATH), BEST_KEPT); deep(rt.world.swaps, ['if-match']); eq(rt.api().saveNote, WORDS.conflict)
})

// ================================================================ B. flag on
console.log('B. Flag on: the version travels in its own header')
for (const scope of ['deck', 'user']) await check(`${scope} scope: no If-Match leaves the browser, the save succeeds with no conflict note and "Saved" after it, the version comes back in X-Prefs-Version, and the router is sent its own strong tag`, async () => {
  const rt = await mountProbe({ flags: ON, props: { sessionId: scope === 'deck' ? SESSION : null } }); eq(rt.api().scope, scope); eq(rt.api().saveNote, '', 'nothing before a save')
  for (const read of rt.fetchLog.filter(e => e.url.startsWith('/api/model-choice/prefs'))) ok(!('if-match' in read.headers), 'a read carries no If-Match')
  eq((await rt.api().select(deckOf('best'))).kind, 'saved'); await rt.settle()
  const first = lastPatch(rt); ok(!('if-match' in first.headers), 'no If-Match on the PATCH'); eq(first.headers['x-prefs-version'], EMPTY_ETAG, 'the version the read gave (X-Prefs-Version, strong: the edge weakens ETag only)')
  deep(rt.world.swaps, [], 'nothing for the edge to turn into a 412'); eq(rt.api().feedback, ''); eq(rt.api().saveNote, NOTES.account); deep(rt.router.kept(scope === 'deck' ? DECK_PATH : USER_PATH), BEST_KEPT)
  const write = rt.router.writes().at(-1); eq(write.method, scope === 'deck' ? 'PUT' : 'PATCH'); eq(write.headers['If-Match'], EMPTY_ETAG, 'the router is sent its own strong tag')
  const answer = prefsResponses(rt).filter(r => r.method === 'PATCH').at(-1); ok(answer.headers['x-prefs-version'] && answer.headers['x-prefs-version'] !== EMPTY_ETAG, 'the new version comes back in X-Prefs-Version'); eq(answer.status, 200)
  await rt.api().select(deckOf('balanced')); await rt.settle()
  eq(lastPatch(rt).headers['x-prefs-version'], answer.headers['x-prefs-version'], 'the next save sends the version the last answer gave'); eq(rt.api().saveNote, NOTES.account)
  deep(rt.router.kept(scope === 'deck' ? DECK_PATH : USER_PATH), Object.fromEntries(TEXT_GROUPS.map(g => [g, 'balanced']))); deep(rt.world.swaps, [])
  for (const write of rt.router.writes()) ok(/^"[0-9a-f]{32}"$/.test(write.headers['If-Match']), `the router is sent a strong tag: ${write.headers['If-Match']}`)
})
await check('the slider: Best on a saved presentation says "Saved to your account", the gauge shows it, a reload (a new page over the same router) keeps it, and "Use my default" (Auto) clears it', async () => {
  const router = modelRouter(), rt = await mountSlider({ flags: ON, router }); await rt.open(); eq(rt.note('save'), null)
  await rt.commit('best'); eq(rt.gaugeLabel(), gaugeBest); eq(rt.note('save'), NOTES.account); eq(rt.note('status'), ''); deep(router.kept(DECK_PATH), BEST_KEPT)
  const again = await mountSlider({ flags: ON, router }); eq(again.gaugeLabel(), gaugeBest, 'it survives a reload')
  const probe = await mountProbe({ flags: ON, router }); eq((await probe.api().select(null)).kind, 'saved'); await probe.settle(); deep(router.kept(DECK_PATH), {}); eq(probe.api().saveNote, NOTES.account)
})

// ================================================================ C. stale reads
console.log('C. A really stale read is still Studio\'s JSON 412')
for (const scope of ['deck', 'user']) await check(`${scope} scope, flag on: another tab saved first, so the save is refused with Studio's JSON preferences_modified (not an error page), the picker says what it says, shows what is stored, and nothing is written`, async () => {
  const path = scope === 'deck' ? DECK_PATH : USER_PATH
  const rt = await mountProbe({ flags: ON, props: { sessionId: scope === 'deck' ? SESSION : null } })
  rt.router.seed(path, Object.fromEntries(TEXT_GROUPS.map(g => [g, { preset: 'economy' }]))) // the other tab
  eq((await rt.api().select(deckOf('best'))).kind, 'conflict'); await rt.settle()
  const answer = prefsResponses(rt).filter(r => r.method === 'PATCH').at(-1); eq(answer.status, 412); eq(answer.body.code, 'preferences_modified'); eq(answer.body.error, 'Your choices changed elsewhere. Read them again and retry.'); eq(answer.headers['content-type'].split(';')[0], 'application/json')
  deep(rt.world.swaps, [], 'the edge had nothing to act on'); eq(rt.router.writes().length, 0); eq(rt.api().saveNote, WORDS.conflict); eq(rt.api().choice.tier, 'economy', 'what is stored'); ok(answer.headers['x-prefs-version'], 'the current version comes back')
  eq((await rt.api().select(deckOf('best'))).kind, 'saved'); await rt.settle(); eq(rt.api().saveNote, NOTES.account, 'and the retry with the fresh version saves')
})
await check('flag off, the same stale read: 412 too (the edge\'s page), nothing written, the same words', async () => {
  for (const scope of ['deck', 'user']) {
    const rt = await mountProbe({ props: { sessionId: scope === 'deck' ? SESSION : null } }); rt.router.seed(scope === 'deck' ? DECK_PATH : USER_PATH, { content_writing: { preset: 'economy' } })
    eq((await rt.api().select(deckOf('best'))).kind, 'conflict'); await rt.settle(); eq(rt.router.writes().length, 0, scope); eq(rt.api().saveNote, WORDS.conflict, scope)
  }
})

// ================================================================ D. the routes
console.log('D. The routes (the real route modules)')
const routesFor = (flags, rd = read, router = modelRouter()) => ({ routes: loadRoutes(rd, { ...CONFIGURED, ...flagEnv(flags) }, router), router })
const body3 = { preferences: BEST3 }
for (const scope of ['deck', 'user']) await check(`${scope} scope, flag on: X-Prefs-Version is read first, If-Match is still accepted, both as opaque tags; a different version, a bad one and the wrong one against a good If-Match are refused; none at all writes as today; the router is sent its strong tag`, async () => {
  const cases = [
    ['X-Prefs-Version strong', { 'x-prefs-version': EMPTY_ETAG }, 200], ['X-Prefs-Version weakened', { 'x-prefs-version': weak(EMPTY_ETAG) }, 200], ['If-Match weakened (an older client)', { 'if-match': weak(EMPTY_ETAG) }, 200],
    ['neither', {}, 200], ['X-Prefs-Version good, If-Match stale', { 'x-prefs-version': EMPTY_ETAG, 'if-match': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, 200],
    ['X-Prefs-Version stale, If-Match good', { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"', 'if-match': EMPTY_ETAG }, 412], ['X-Prefs-Version another tag', { 'x-prefs-version': weak('"deadbeefdeadbeefdeadbeefdeadbeef"') }, 412],
    ['X-Prefs-Version without quotes', { 'x-prefs-version': '4f53cda18c2baa0c0354bb5f9a3ecbe5' }, 400], ['X-Prefs-Version *', { 'x-prefs-version': '*' }, 400],
  ]
  for (const [label, headers, status] of cases) {
    const { routes, router } = routesFor(ON), out = await callRoute(routes, scope, 'PATCH', { headers, body: body3 })
    eq(out.status, status, label)
    if (status === 200) { eq(router.writes().length, 1, label); eq(router.writes()[0].headers['If-Match'], EMPTY_ETAG, `${label}: the router's own strong tag`); ok(out.headers.get('x-prefs-version') && out.headers.get('x-prefs-version') !== EMPTY_ETAG, `${label}: the new version`) }
    else { eq(router.writes().length, 0, label); eq(out.body.code, status === 412 ? 'preferences_modified' : 'invalid_request', label); if (status === 412) eq(out.headers.get('x-prefs-version'), EMPTY_ETAG, `${label}: the current version comes back`) }
  }
})
await check('flag on: every answer carries X-Prefs-Version (a read keeps its ETag, and it is the same tag); flag off: no answer carries it, and a read answers as it did', async () => {
  for (const scope of ['deck', 'user']) {
    const on = routesFor(ON), get = await callRoute(on.routes, scope, 'GET'); eq(get.headers.get('etag'), EMPTY_ETAG); eq(get.headers.get('x-prefs-version'), EMPTY_ETAG); eq(get.headers.get('cache-control'), 'no-store')
    const off = routesFor(DEV), plain = await callRoute(off.routes, scope, 'GET'); eq(plain.headers.get('etag'), EMPTY_ETAG); eq(plain.headers.get('x-prefs-version'), undefined); deep(plain.body, get.body)
    for (const [flags, label] of [[DEV, 'off'], [{ ds: 'true', pv: 'false' }, 'false'], [{ ds: 'true', pv: '1' }, '1'], [{ ds: 'true', pv: 'TRUE' }, 'TRUE']]) {
      const { routes, router } = routesFor(flags), out = await callRoute(routes, scope, 'PATCH', { headers: { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, body: body3 })
      eq(out.status, 200, `flag ${label}: the header is not read, so no stale read is found, as today`); eq(out.headers.get('x-prefs-version'), undefined, label); eq(router.writes().length, 1, label)
    }
  }
})

// ================================================================ E. error pages
console.log('E. A 412 that is not Studio\'s JSON')
for (const scope of ['deck', 'user']) await check(`${scope} scope, flag on: the edge's page after the write landed is a saved save (the read shows what was asked), and one before it is not: the stored choice and the refusal words, never "changed elsewhere"`, async () => {
  const path = scope === 'deck' ? DECK_PATH : USER_PATH, props = { sessionId: scope === 'deck' ? SESSION : null }
  const landed = await mountProbe({ flags: ON, edge: { ...VERCEL, failAfter: true }, props })
  eq((await landed.api().select(deckOf('best'))).kind, 'saved'); await landed.settle(); deep(landed.router.kept(path), BEST_KEPT); deep(landed.world.swaps, ['after'])
  eq(landed.api().saveNote, NOTES.account); eq(landed.api().feedback, ''); eq(landed.api().choice.tier, 'best'); eq(landed.patches().length, 1, 'one PATCH, one re-read, nothing resent')
  const lost = await mountProbe({ flags: ON, edge: { ...VERCEL, failBefore: true }, props })
  const outcome = await lost.api().select(deckOf('best')); await lost.settle(); ok(['conflict', 'refused'].includes(outcome.kind))
  eq(lost.api().saveNote, WORDS.refused); ok(lost.api().saveNote !== WORDS.conflict); eq(lost.api().feedback, WORDS.refused); eq(lost.api().choice, null, 'the stored choice (Auto)'); deep(lost.router.kept(path), {}); eq(lost.patches().length, 1)
  const blind = await mountProbe({ flags: ON, edge: { ...VERCEL, failBefore: true, failReadAfter: true }, props })
  eq((await blind.api().select(deckOf('best'))).kind, 'refused'); await blind.settle(); eq(blind.api().saveNote, WORDS.refused, 'and when the read fails too'); eq(blind.api().choice, null)
})
await check('flag off, the same pages: "changed elsewhere" (today), whether the write landed or not', async () => {
  for (const edge of [{ ...VERCEL, failAfter: true }, { ...VERCEL, failBefore: true }]) { const rt = await mountProbe({ flags: DEV, edge }); eq((await rt.api().select(deckOf('best'))).kind, 'conflict'); await rt.settle(); eq(rt.api().saveNote, WORDS.conflict) }
})
await check('an error page that is not a 412 (a 502 page) is what it was, flag on or off: the account is not reached, the choice is kept on this device', async () => {
  const results = []
  for (const flags of [DEV, ON]) { const rt = await mountProbe({ flags, edge: { ...VERCEL, failBefore: true, failStatus: 502 } }); const out = await rt.api().select(deckOf('best')); await rt.settle(); results.push([out.kind, rt.api().mode, rt.api().saveNote]) }
  deep(results[1], results[0]); deep(results[0], ['saved', 'device', NOTES.unreachable])
})
await check('the Intelligence page: its routeFetch moves the header and reads the version like the hook\'s, and its keep() shows the stored choice with the refusal words for an unconfirmed save', async () => {
  await routeFetchChecks(HOOK, read(HOOK)); await routeFetchChecks(CHOOSER, read(CHOOSER)); await keepChecks(read(CHOOSER))
})

// ================================================================ F. the read path
console.log('F. The read path needs nothing')
await check('every read the browser makes is fetched no-store with no If-None-Match or If-Modified-Since, flag on or off, even when it reads again after a refusal; the route answers Cache-Control: no-store; a 304 would be served from the browser\'s cache anyway', async () => {
  for (const flags of [DEV, ON]) {
    const rt = await mountProbe({ flags, edge: { ...VERCEL, failBefore: true } }); await rt.api().select(deckOf('best')); await rt.settle()
    const reads = rt.fetchLog.filter(e => e.method === 'GET' && e.url.startsWith('/api/model-choice/prefs'))
    ok(reads.length >= 3, 'the loads and the re-read'); eq(new Set(reads.map(e => e.url)).size, 2, 'the deck is read more than once')
    for (const e of reads) { eq(e.cache, 'no-store', e.url); ok(!('if-none-match' in e.headers) && !('if-modified-since' in e.headers), `${e.url}: no conditional header`) }
    for (const r of prefsResponses(rt).filter(r => r.method === 'GET')) eq(r.headers['cache-control'], 'no-store')
    ok(!rt.world.swaps.includes('304'))
  }
})

// ================================================================ G. flag off is the base
console.log('G. Flag off is the base')
await check('the strip gives each edited file its base back, byte for byte; the flag is named only on marked lines, read in the adapter and the two routes only; the server lib has no NEXT_PUBLIC_ name on its marked line', () => {
  for (const rel of STRIPPED_FILES) {
    eq(stripModelChoicePrefsVersion(rel, afterLater(rel, read(rel))), baseFile(rel), `${rel}: without its marked lines (and the lines of any change registered after this one) the file is the base's`)
    ok(read(rel).split('\n').filter(line => line.includes('PREFS_VERSION')).every(line => MARKER_RE.test(line)), `${rel}: names it only on marked lines`)
    ok(!stripModelChoicePrefsVersion(rel, afterLater(rel, read(rel))).includes('PREFS_VERSION'), rel)
  }
  eq(stripModelChoicePrefsVersion('hooks/use-deckster-websocket-v2.ts', 'x'), 'x')
  eq(registry.stripLaterChanges(SERVER, read(SERVER)), registry.stripLaterChanges(SERVER, baseFile(SERVER)), 'through the registry the server lib is the base')
  for (const rel of STRIPPED_FILES) eq(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseFile(rel)), `${rel}: through the registry (every strip) it is the base's`)
  deep(git('grep', '-l', 'STUDIO_MODEL_CHOICE_PREFS_VERSION', '--', 'app', 'lib', 'hooks', 'components', 'types', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).sort(), [USER_ROUTE, DECK_ROUTE, LIB].sort())
  ok(!read(SERVER).split('\n').filter(line => MARKER_RE.test(line)).join('\n').includes('NEXT_PUBLIC_'))
})
const matrixRequests = [
  ['deck GET', 'deck', 'GET', {}, null], ['user GET', 'user', 'GET', {}, null],
  ['deck first save, If-Match strong', 'deck', 'PATCH', { 'if-match': EMPTY_ETAG }, body3], ['deck first save, If-Match weakened', 'deck', 'PATCH', { 'if-match': weak(EMPTY_ETAG) }, body3], ['deck save, no header', 'deck', 'PATCH', {}, body3],
  ['deck save, another tag', 'deck', 'PATCH', { 'if-match': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, body3], ['deck save, unquoted', 'deck', 'PATCH', { 'if-match': 'deadbeef' }, body3],
  ['deck save, X-Prefs-Version only', 'deck', 'PATCH', { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, body3], ['deck save, X-Prefs-Version unquoted', 'deck', 'PATCH', { 'x-prefs-version': 'deadbeef' }, body3],
  ['user save, If-Match strong', 'user', 'PATCH', { 'if-match': EMPTY_ETAG }, { preferences: { content_writing: { preset: 'best' } } }], ['user save, If-Match weakened', 'user', 'PATCH', { 'if-match': weak(EMPTY_ETAG) }, { preferences: { content_writing: { preset: 'best' } } }],
  ['user save, X-Prefs-Version only', 'user', 'PATCH', { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, { preferences: { content_writing: { preset: 'best' } } }], ['user save, invalid body', 'user', 'PATCH', {}, { preferences: {} }],
]
async function routeMatrix(rd, flags, { concurrent = false } = {}) {
  const out = []
  for (const [label, scope, method, headers, body] of matrixRequests) {
    const { routes, router } = routesFor(flags, rd)
    if (concurrent) router.seed(scope === 'deck' ? DECK_PATH : USER_PATH, { content_writing: { preset: 'economy' } })
    const answer = await callRoute(routes, scope, method, { headers, body: body ?? undefined })
    out.push({ label, status: answer.status, headers: [...answer.headers].sort(), text: answer.text, calls: router.log.map(entry => `${entry.method} ${entry.url} ${entry.headers['If-Match'] ?? '-'}`) })
  }
  return out
}
await check('flag off (unset, "false", "1", "TRUE", "") and #542\'s flag either way: the routes answer a matrix of requests, headers included, exactly as the base does (same hash), with and without a concurrent change; flag on differs only where the version header is used', async () => {
  for (const ds of [undefined, 'true']) {
    const want = sha(JSON.stringify(await routeMatrix(baseRead, { ds }))), wantConcurrent = sha(JSON.stringify(await routeMatrix(baseRead, { ds }, { concurrent: true })))
    for (const pv of [undefined, 'false', '1', 'TRUE', '']) { eq(sha(JSON.stringify(await routeMatrix(read, { ds, pv }))), want, `ds ${ds} pv ${JSON.stringify(pv)}`); eq(sha(JSON.stringify(await routeMatrix(read, { ds, pv }, { concurrent: true }))), wantConcurrent, `ds ${ds} pv ${JSON.stringify(pv)}, concurrent`) }
  }
  const off = await routeMatrix(baseRead, DEV), on = await routeMatrix(read, ON)
  deep(on.map((o, i) => (JSON.stringify(o) === JSON.stringify(off[i]) ? null : o.label)).filter(Boolean).length > 0, true, 'flag on is not the base')
  const same = on.map((o, i) => (o.status === off[i].status ? null : o.label)).filter(Boolean)
  ok(same.every(label => /X-Prefs-Version/.test(label)), `statuses differ only where the header is used: ${same}`)
  const concurrentOn = await routeMatrix(read, ON, { concurrent: true }), concurrentOff = await routeMatrix(baseRead, DEV, { concurrent: true })
  deep(concurrentOn.filter(o => !/X-Prefs-Version/.test(o.label)).map(o => o.status), concurrentOff.filter(o => !/X-Prefs-Version/.test(o.label)).map(o => o.status), 'and with a concurrent change every status is the base\'s, bar the requests that use the version header (a stale read is 412 either way)')
})
async function hookTranscript(rd, flags, edge) {
  const steps = []
  const snap = (label, rt) => { const api = rt.api(); steps.push({ label, scope: api.scope, mode: api.mode, choice: api.choice ?? null, state: api.state, deckOwn: api.deckOwn ?? null, feedback: api.feedback, saveNote: api.saveNote, saving: api.saving, ready: api.ready, reason: api.reason }) }
  for (const sessionId of [SESSION, null]) {
    const rt = await mountProbe({ read: rd, flags, edge, props: { sessionId } }); snap(`${sessionId}: loaded`, rt)
    for (const choice of [deckOf('best'), deckOf('economy'), null]) { const out = await rt.api().select(choice); await rt.settle(); steps.push({ label: 'select', out }); snap(`${sessionId}: after ${JSON.stringify(choice)}`, rt) }
    rt.router.seed(sessionId ? DECK_PATH : USER_PATH, { content_writing: { preset: 'max' } }); const out = await rt.api().select(deckOf('best')); await rt.settle(); steps.push({ label: 'concurrent', out }); snap(`${sessionId}: after the concurrent change`, rt)
    steps.push({ requests: rt.fetchLog.filter(e => e.url.startsWith('/api/model-choice/prefs')).map(e => `${e.method} ${e.url} ${JSON.stringify(e.headers)} ${e.cache}`), writes: rt.router.writes().map(w => `${w.method} ${w.url} ${w.body}`), swaps: rt.world.swaps })
  }
  const slider = await mountSlider({ read: rd, flags, edge }); await slider.open(); steps.push({ label: 'slider', note: slider.note('save'), gauge: slider.gaugeLabel() }); await slider.commit('best'); steps.push({ label: 'slider after', note: slider.note('save'), status: slider.note('status'), gauge: slider.gaugeLabel() })
  return steps
}
await check('flag off (unset, "false", "1"): the hook shows and sends the same after every step of a fixed script as the base does (same hash), through Vercel\'s edge or not; flag on differs', async () => {
  for (const edge of [{}, VERCEL]) {
    const want = sha(JSON.stringify(await hookTranscript(baseRead, DEV, edge)))
    for (const pv of [undefined, 'false', '1']) eq(sha(JSON.stringify(await hookTranscript(read, { ds: 'true', pv }, edge))), want, `pv ${JSON.stringify(pv)}`)
    ok(sha(JSON.stringify(await hookTranscript(read, ON, edge))) !== want, 'the script is sensitive to the flag')
  }
})

// ================================================================ H. scope over the committed diff, gate-safe
console.log('H. Scope over the committed diff (BASE..HEAD, gate-safe, and after a later change)')
const parentsOf = ref => git('rev-list', '--parents', '-n', '1', ref).trim().split(' ').slice(1)
const firstParentOwn = ref => git('rev-list', '--first-parent', '--no-merges', `${BASE}..${ref}`).split('\n').filter(Boolean)
const subjectOf = commit => git('log', '-1', '--format=%s', commit).trim()
/** This change's own commits: those whose subject starts "Model choice prefs version:", across every parent (`rev-list --no-merges BASE..ref`), so a branch that has a later change on it, or dev merged into it, still finds them. */
const ownCommits = ref => git('rev-list', '--no-merges', `${BASE}..${ref}`).split('\n').filter(Boolean).filter(commit => subjectOf(commit).startsWith(SUBJECT))
/** The commit own-commit queries start from. On the gate's merge (HEAD^1 = BASE, HEAD^2 = this branch's head) a first-parent walk from HEAD finds nothing, so every own-commit query starts from HEAD^2; a merge whose first parent
 * is not BASE but whose first-parent line holds no commit of this change (dev moved on before the gate) is read the same way. Anything else (the branch itself, the branch with dev merged into it, or with a later change on it) starts from the ref. */
function ownRef(ref) {
  const parents = parentsOf(ref)
  if (parents.length === 2 && parents[0] === BASE) return parents[1]
  if (parents.length === 2 && !firstParentOwn(ref).some(commit => subjectOf(commit).startsWith(SUBJECT))) return parents[1]
  return ref
}
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'proof', GIT_AUTHOR_EMAIL: 'proof@example.test', GIT_COMMITTER_NAME: 'proof', GIT_COMMITTER_EMAIL: 'proof@example.test', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
const gitIn = (env, input, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env, input, maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'pipe'] })
/** The gate's merge of `head` onto BASE: `git commit-tree $(git merge-tree --write-tree BASE head) -p BASE -p head`. */
function gateMerge(headRef) {
  const tree = git('merge-tree', '--write-tree', BASE, headRef).split('\n')[0].trim()
  return gitIn(gitEnv, undefined, 'commit-tree', tree, '-p', BASE, '-p', headRef, '-m', 'gate-style merge (proof)').trim()
}
/** A commit on `parent` with `edits` ({ path: text }) applied, made with git plumbing in a throwaway index (no checkout, nothing in the working tree). */
function commitOn(parent, subject, edits, { coAuthor = true } = {}) {
  const index = git('rev-parse', '--git-path', `proof-index-${crypto.randomBytes(4).toString('hex')}`).trim(), env = { ...gitEnv, GIT_INDEX_FILE: path.resolve(root, index) }
  try {
    gitIn(env, undefined, 'read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) gitIn(env, undefined, 'update-index', '--add', '--cacheinfo', `100644,${gitIn(env, text, 'hash-object', '-w', '--stdin').trim()},${rel}`)
    return gitIn(env, undefined, 'commit-tree', gitIn(env, undefined, 'write-tree').trim(), '-p', parent, '-m', `${subject}${coAuthor ? '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' : ''}`).trim()
  } finally { fs.rmSync(path.resolve(root, index), { force: true }) }
}
const SECRETS = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-|Bearer [A-Za-z0-9._-]{16,})/
const EXPECTED_MARKED = { [USER_ROUTE]: 4, [DECK_ROUTE]: 4, [SERVER]: 1, [LIB]: 14, [HOOK]: 4, [CHOOSER]: 4 }
const at = (ref, rel) => git('show', `${ref}:${rel}`)
function ownAssertions(ref) {
  const own = ownCommits(ownRef(ref))
  ok(own.length >= 1, 'no own commit yet')
  for (const c of own) {
    ok(subjectOf(c).startsWith(SUBJECT), `subject of ${c.slice(0, 8)}`)
    assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  }
  return own
}
function fileAssertions(ref) {
  const own = ownCommits(ownRef(ref)), touched = new Set(); for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  deep([...touched].filter(rel => SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort(), [...SCOPE_FILES].sort())
  for (const rel of STRIPPED_FILES) {
    const stripped = afterLater(rel, at(ref, rel)), diff = lineDiff(baseFile(rel), stripped) // the file with the strips of any later change applied first, against the base
    for (const line of diff) { ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    eq(diff.length, EXPECTED_MARKED[rel], `${rel}: the marked lines`)
    eq(stripModelChoicePrefsVersion(rel, stripped), baseFile(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of NEW_FILES) eq(git('cat-file', '-t', `${ref}:${rel}`).trim(), 'blob', rel)
  for (const rel of stripModule.MODEL_CHOICE_PREFS_VERSION_PIN_FILES) eq(stripModelChoicePrefsVersion(rel, afterLater(rel, at(ref, rel))), baseFile(rel), `${rel}: the taught proof is the base's without the lines`)
}
function registryAssertions(ref) {
  eq(registry.stripLaterEnvBlocks(ENV, at(ref, ENV)), registry.stripLaterEnvBlocks(ENV, `${baseFile(ENV)}\n${ENV_BLOCK}`)) // every registered block, this change's and a later change's alike, comes out first
  ok(at(ref, ENV).includes(`\n\n${ENV_BLOCK}`), 'a blank line before the block')
  const later = laterRegistryLines(at(ref, REGISTRY)), diff = git('diff', '-U0', BASE, ref, '--', REGISTRY).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && later.has(line.slice(1))))
  eq(diff.length, 3); for (const line of diff) ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-model-choice-prefs-version-strip.mjs'), line.slice(0, 140))
  for (const rel of NEW_FILES) assert.doesNotMatch(at(ref, rel).replace(/Bearer \$\{KEY\}/g, ''), SECRETS, rel)
}
async function scopeChecks(ref, title) {
  await check(`${title}: this change's own commits (by subject "${SUBJECT}", across every parent of BASE..ref; read from ${ownRef(ref) === ref ? 'the ref' : 'its second parent'}) exist, each with the co-author line`, () => { ownAssertions(ref) })
  await check(`${title}: the files the own commits touch are exactly this change's; every line it adds to an existing file (read past the strips of any later change) is a pure insertion that carries the marker; the strip gives each its base back`, () => { fileAssertions(ref) })
  await check(`${title}: .env.example is the base plus the block (after one blank line, any later block read past); the registry gains exactly its three marked lines and loses none (any later change's lines read past); no secret-shaped literal in the new files`, () => { registryAssertions(ref) })
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
  const tip = gitIn(gitEnv, undefined, 'commit-tree', git('rev-parse', `${BASE}^{tree}`).trim(), '-p', BASE, '-m', 'dev moved on (proof)').trim()
  const tree = git('merge-tree', '--write-tree', tip, mineHead).split('\n')[0].trim()
  const merge = gitIn(gitEnv, undefined, 'commit-tree', tree, '-p', tip, '-p', mineHead, '-m', 'gate-style merge, dev moved (proof)').trim()
  eq(ownRef(merge), git('rev-parse', mineHead).trim()); ok(firstParentOwn(ownRef(merge)).every(c => subjectOf(c).startsWith(SUBJECT)))
})
await check('after a later change: a commit "Later change: x" on the gate-style merge that adds a correctly shaped registered line to each list and a new file leaves the own-commit and file checks passing, and the registry check reads past its lines; a "Model choice prefs version:" commit that touches a foreign file, or has no co-author line, or adds an unregistered registry line still fails', () => {
  const gate = gateMerge(mineHead), registryText = at(gate, REGISTRY), MARKER = '  // one line per later change, above this comment\n'
  const shaped = `  (await import('./studio-later-x-strip.mjs')).LATER_X, // LATER-CHANGE: SOMEONE, a later change (NEXT_PUBLIC_LATER_X)\n`
  const withLater = registryText.split(MARKER).join(`${shaped}${MARKER}`)
  const later = commitOn(gate, 'Later change: x', { [REGISTRY]: withLater, 'scripts/studio-later-x-strip.mjs': 'export const LATER_X = 1\n' })
  ownAssertions(later); fileAssertions(later)
  eq(ownCommits(later).length, ownCommits(gate).length, 'a later change\'s commit is not one of ours')
  const laterDiff = git('diff', '-U0', BASE, later, '--', REGISTRY).split('\n').filter(line => /^\+[^+]/.test(line)); eq(laterDiff.length, 6, 'the raw registry diff has the later lines too')
  const lines = laterRegistryLines(withLater); eq(lines.size, 3, 'read as the later change\'s three lines'); for (const line of lines) ok(line.includes('studio-later-x-strip.mjs'))
  // the registry check on that branch, without the .env half (the working tree's registry does not know the later block)
  const diff = git('diff', '-U0', BASE, later, '--', REGISTRY).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && lines.has(line.slice(1)))); eq(diff.length, 3)
  const stray = commitOn(later, `${SUBJECT} a stray`, { 'README.md': `${git('show', 'HEAD:README.md')}\nstray\n` })
  assert.throws(() => fileAssertions(stray), undefined, 'a foreign file in a commit of ours is a stray')
  const unsigned = commitOn(later, `${SUBJECT} no co-author`, {}, { coAuthor: false }); assert.throws(() => ownAssertions(unsigned), undefined, 'a commit of ours without the co-author line')
  const unregistered = commitOn(later, `${SUBJECT} a stray registry line`, { [REGISTRY]: withLater.split(MARKER).join(`  // a stray line nobody registered\n${MARKER}`) })
  const strayLater = laterRegistryLines(at(unregistered, REGISTRY)), strayDiff = git('diff', '-U0', BASE, unregistered, '--', REGISTRY).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && strayLater.has(line.slice(1))))
  eq(strayDiff.length, 4, 'an unregistered line is not read past')
})

// ================================================================ I. mutants
if (process.env.MODEL_CHOICE_PREFS_VERSION_NO_MUTANTS === '1') { console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed (mutants skipped)`); process.exit(failed ? 1 : 0) }
console.log('I. Mutants (each must make the expectations fail)')
const mutate = (text, from, to, label) => { assert.equal(text.split(from).length, 2, `mutant "${label}": the anchor must be there exactly once: ${from.slice(0, 80)}`); return text.replace(from, () => to) }
/** The core expectations, short: the flag on through Vercel's edge on both scopes, a real stale read, the flag off as it was, the error pages, the routes, the read path and the Intelligence page's copies. */
async function expectations() {
  for (const scope of ['deck', 'user']) {
    const path = scope === 'deck' ? DECK_PATH : USER_PATH, props = { sessionId: scope === 'deck' ? SESSION : null }
    const on = await mountProbe({ flags: ON, props }); eq((await on.api().select(deckOf('best'))).kind, 'saved', `${scope}: saved`); await on.settle()
    ok(!('if-match' in lastPatch(on).headers), `${scope}: no If-Match leaves the browser`); deep(on.world.swaps, [], `${scope}: the edge has nothing to act on`); eq(on.api().saveNote, NOTES.account, scope)
    eq(on.router.writes().at(-1).headers['If-Match'], EMPTY_ETAG, `${scope}: the router is sent its strong tag`); ok(prefsResponses(on).filter(r => r.method === 'PATCH').at(-1).headers['x-prefs-version'], `${scope}: the version comes back`)
    const stale = await mountProbe({ flags: ON, props }); stale.router.seed(path, { content_writing: { preset: 'economy' } })
    eq((await stale.api().select(deckOf('best'))).kind, 'conflict', `${scope}: a stale read`); await stale.settle(); eq(prefsResponses(stale).filter(r => r.method === 'PATCH').at(-1).body?.code, 'preferences_modified', `${scope}: Studio's JSON`); eq(stale.router.writes().length, 0, scope); eq(stale.api().saveNote, WORDS.conflict, scope)
    for (const pv of [undefined, 'false']) { const off = await mountProbe({ flags: { ds: 'true', pv }, props }); await off.api().select(deckOf('best')); await off.settle(); deep(off.world.swaps, ['if-match'], `${scope}, flag ${pv}: today's swap`); eq(off.api().saveNote, WORDS.conflict, `${scope}, flag ${pv}`); ok('if-match' in lastPatch(off).headers, `${scope}, flag ${pv}: If-Match, as before`) }
    const landed = await mountProbe({ flags: ON, edge: { ...VERCEL, failAfter: true }, props }); eq((await landed.api().select(deckOf('best'))).kind, 'saved', `${scope}: the page after the write`); await landed.settle(); eq(landed.api().saveNote, NOTES.account, scope)
    const lost = await mountProbe({ flags: ON, edge: { ...VERCEL, failBefore: true }, props }); await lost.api().select(deckOf('best')); await lost.settle(); eq(lost.api().saveNote, WORDS.refused, `${scope}: the page before the write`)
    const blind = await mountProbe({ flags: ON, edge: { ...VERCEL, failBefore: true, failReadAfter: true }, props }); eq((await blind.api().select(deckOf('best'))).kind, 'refused', `${scope}: the read fails too`)
    const reads = await mountProbe({ flags: ON, edge: { ...VERCEL, failBefore: true }, props }); await reads.api().select(deckOf('best')); await reads.settle()
    for (const e of reads.fetchLog.filter(e => e.method === 'GET' && e.url.startsWith('/api/model-choice/prefs'))) { eq(e.cache, 'no-store', `${scope}: ${e.url}`); ok(!('if-none-match' in e.headers), `${scope}: no conditional read`) }
    // the routes themselves
    const { routes, router } = routesFor(ON); eq((await callRoute(routes, scope, 'PATCH', { headers: { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, body: body3 })).status, 412, `${scope}: X-Prefs-Version is read`); eq(router.writes().length, 0)
    const get = await callRoute(routes, scope, 'GET'); eq(get.headers.get('x-prefs-version'), EMPTY_ETAG, scope); eq(get.headers.get('etag'), EMPTY_ETAG, scope)
    eq((await callRoute(routes, scope, 'PATCH', { headers: { 'x-prefs-version': weak(EMPTY_ETAG) }, body: body3 })).status, 200, `${scope}: compared as an opaque tag`)
    eq(router.writes().at(-1).headers['If-Match'], EMPTY_ETAG, `${scope}: whatever the browser sent, the router gets its own strong tag`)
    const alone = routesFor({ pv: 'true' }); eq((await callRoute(alone.routes, scope, 'PATCH', { headers: { 'x-prefs-version': weak(EMPTY_ETAG) }, body: body3 })).status, 200, `${scope}: this flag compares as an opaque tag on its own, without #542's`); eq(alone.router.writes().at(-1).headers['If-Match'], EMPTY_ETAG, scope)
    for (const pv of [undefined, 'false']) { const plain = routesFor({ ds: 'true', pv }); const out = await callRoute(plain.routes, scope, 'GET'); eq(out.headers.get('x-prefs-version'), undefined, `${scope}: flag ${pv} sends no X-Prefs-Version`); eq((await callRoute(plain.routes, scope, 'PATCH', { headers: { 'x-prefs-version': '"deadbeefdeadbeefdeadbeefdeadbeef"' }, body: body3 })).status, 200, `${scope}: flag ${pv} does not read it`) }
  }
  await routeFetchChecks(HOOK, read(HOOK)); await routeFetchChecks(CHOOSER, read(CHOOSER)); await keepChecks(read(CHOOSER))
}
await check('the expectations pass on the real files (so a mutant failing them is the mutant\'s doing)', async () => { overrides = {}; await expectations() })
const texts = Object.fromEntries([LIB, SERVER, HOOK, CHOOSER, USER_ROUTE, DECK_ROUTE].map(rel => [rel, read(rel)]))
const PVL = "process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION"
const mutants = [
  ['the browser still sends If-Match (the move does nothing)', LIB, "if (tag === undefined) return init;", 'return init;'],
  ['the browser sends X-Prefs-Version and If-Match both', LIB, 'headers: { ...rest, [PREFS_VERSION_HEADER]: tag }', 'headers: { ...init.headers, [PREFS_VERSION_HEADER]: tag }'],
  ['the hook does not move the header', HOOK, 'if (PREFS_VERSION_ON) init = versionRequest(init)', 'void 0'],
  ['the Intelligence page does not move the header', CHOOSER, 'if (PREFS_VERSION_ON) init = versionRequest(init)', 'void 0'],
  ['the deck route ignores X-Prefs-Version', DECK_ROUTE, "req.headers.get('x-prefs-version') ?? req.headers.get('if-match')", "req.headers.get('if-match')"],
  ['the user route ignores X-Prefs-Version', USER_ROUTE, "req.headers.get('x-prefs-version') ?? req.headers.get('if-match')", "req.headers.get('if-match')"],
  ['the deck route does not send the version back', DECK_ROUTE, "response.headers.set('X-Prefs-Version', outcome.etag)", "response.headers.set('X-Version', outcome.etag)"],
  ['the user route does not send the version back', USER_ROUTE, "response.headers.set('X-Prefs-Version', outcome.etag)", "response.headers.set('X-Version', outcome.etag)"],
  ['the version is compared as a plain string (no opaque compare)', SERVER, '(request as { opaqueTag?: boolean }).opaqueTag === true &&', 'false &&'],
  ['the browser\'s tag is forwarded to the router on the user PATCH', SERVER, '{ preferences: changes }, current.etag)', '{ preferences: changes }, request.ifMatch)'],
  ['the browser\'s tag is forwarded to the router on the deck PUT', SERVER, '{ preferences: merged }, current.etag)', '{ preferences: merged }, request.ifMatch)'],
  ['an error page is read as "changed elsewhere"', LIB, "&& codeOf(answer.body) !== 'preferences_modified') {", '&& false) {'],
  ['a save the read shows as landed is not recognised', LIB, "if (serializeChoices(scope, stored) === serializeChoices(scope, choices)) return { mode: 'account', reason: null }", "if (false) return { mode: 'account', reason: null }"],
  ['an unreadable re-read is not a refusal', LIB, "if (fresh.status !== 200) return { mode: 'account', reason: null, refused: true, refusedCode: 'save_unconfirmed' }", 'if (false) return { mode: \'account\', reason: null, refused: true, refusedCode: \'save_unconfirmed\' }'],
  ['the unconfirmed save keeps the "changed elsewhere" words in the hook', HOOK, '.unconfirmed) words = MODEL_CHOICE_REFUSED', '.unconfirmed) void 0'],
  ['the Intelligence page does not show the stored choice for an unconfirmed save', CHOOSER, 'setFor(target, result.conflict ?? before); return {', 'void 0; return {'],
  ['the flag is ignored in the adapter', LIB, `export const PREFS_VERSION_ON = ${PVL} === 'true'`, 'export const PREFS_VERSION_ON = true'],
  ['the flag is loose in the adapter', LIB, `export const PREFS_VERSION_ON = ${PVL} === 'true'`, `export const PREFS_VERSION_ON = Boolean(${PVL})`],
  ['the flag is ignored in the deck route', DECK_ROUTE, `const prefsVersionOn = () => ${PVL} === 'true'`, 'const prefsVersionOn = () => true'],
  ['the flag is loose in the user route', USER_ROUTE, `const prefsVersionOn = () => ${PVL} === 'true'`, `const prefsVersionOn = () => Boolean(${PVL})`],
  ['the hook\'s reads are no longer no-store', HOOK, 'body: init.body, credentials: "same-origin", cache: "no-store" })', 'body: init.body, credentials: "same-origin", cache: "default" })'],
]
for (const [label, rel, from, to] of mutants) await check(`mutant caught: ${label}`, async () => {
  overrides = { [rel]: mutate(texts[rel], from, to, label) }
  try { await assert.rejects(() => expectations(), undefined, 'the expectations must fail on this mutant') } finally { overrides = {} }
})
await check('mutant caught: an unmarked line added to any of the six files is not stripped, so the strip no longer gives the base back; the other changes\' markers are not this one\'s', async () => {
  for (const rel of STRIPPED_FILES) {
    const text = read(rel), anchor = text.split('\n').find(line => line.trim() !== '' && !MARKER_RE.test(line))
    const mutated = text.replace(anchor, () => `const extra = 1\n${anchor}`)
    assert.notEqual(stripModelChoicePrefsVersion(rel, mutated), stripModelChoicePrefsVersion(rel, text), rel)
  }
  const { MODEL_CHOICE_MARKER_RE } = await import('./studio-model-choice-strip.mjs'), { MODEL_CHOICE_DECK_SAVE_MARKER_RE } = await import('./studio-model-choice-deck-save-strip.mjs')
  eq(MODEL_CHOICE_MARKER_RE.test('x // MODEL-CHOICE-PREFS-VERSION'), false); eq(MODEL_CHOICE_DECK_SAVE_MARKER_RE.test('x // MODEL-CHOICE-PREFS-VERSION'), false); eq(MARKER_RE.test('x // MODEL-CHOICE-DECK-SAVE'), false); eq(MARKER_RE.test('x // MODEL-CHOICE'), false); eq(MARKER_RE.test('x // MODEL-CHOICE-PREFS-VERSION'), true); eq(MARKER_RE.test('x // MODEL-CHOICE-PREFS-VERSION-X'), false)
})
await check('mutant caught: the old scope query (first-parent from HEAD) finds no own commit on a gate-style merge, so a proof that used it would fail there', () => { eq(firstParentOwn(gateMerge(mineHead)).length, 0) })

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
