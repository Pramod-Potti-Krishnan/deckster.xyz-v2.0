// PL-46 STUDIO-EDIT-SCOPE (ARCH-PLATFORM cards 07:50Z / 07:51Z / 07:54Z, CHIEF-ARCH CA-74): the Studio asks Layout for a viewer ticket WITH A SCOPE.
// Contract (ARCH-RENDER 07:52Z agreed): Layout's existing query parameter `scope` on POST /api/presentations/{id}/viewer-ticket, "edit" or "view", absent = view.
// Only the owner's editing frame asks "edit"; every other frame asks "view" or nothing. Layout alone decides (its owner check); the Studio never downgrades a refused
// edit to view and never loops on a refusal: it stops and tells the person. Everything here is behind NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED (exact "true", default off).
//   node scripts/test-studio-pl46-edit-scope.mjs      (plain node, offline: the REAL route, library and hook transpiled and run; fetch, timers, document, React and the toast are fakes)
// Proves: the route (scope validated, forwarded as Layout's own parameter, absent = nothing forwarded, Layout's answer passed through); the library (path, refusal vs try-again);
// the hook with a FAKE CLOCK (the first ticket, the deckster:viewer-ticket message at the renew time, the same scope on every renewal, retry on a failure, stop on a refusal, flag off);
// and WHICH CALLERS exist. Mutants change the sources in memory only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const ts = nodeRequire('typescript')
const ROUTE = 'app/api/presentations/[id]/viewer-ticket/route.ts', LIB = 'lib/studio-layout-viewer-ticket.ts', HOOK = 'lib/studio-layout-viewer-ticket-client.ts'
const VIEWER = 'components/presentation-viewer.tsx'
const real = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
let checks = 0
const check = (name, fn) => { checks++; const r = fn(); return r && typeof r.then === 'function' ? r.then(() => console.log(`PASS ${name}`)) : (console.log(`PASS ${name}`), r) }

// ---------------------------------------------------------------------------------------------------------- the world: stubs, loader, fake clock and hook runner
const env = {}
const state = { userId: 'user-1', fetches: [], reply: { status: 200, body: '{}' }, replies: [], toasts: [], warns: [], posted: [], frameSrc: null }
class FakeRes { constructor({ status, body }) { this.status = status; this.ok = status >= 200 && status < 300; this._body = body; this.headers = { get: n => (n.toLowerCase() === 'content-type' ? 'application/json' : null) } } async text() { return this._body } async json() { return JSON.parse(this._body) } }
const fakeFetch = async (url, init) => { state.fetches.push({ url: String(url), init }); const r = state.replies.length ? state.replies.shift() : state.reply; if (r instanceof Error) throw r; return new FakeRes(r) }
let curRunner = null
const STUBS = {
  'next/server': { NextResponse: class { static json(body, init) { return { body, status: init?.status ?? 200 } } } },
  '@/lib/publish/service-urls': { getLayoutServiceBaseUrl: () => 'https://layout.test' },
  '@/lib/studio-director-rest-sign': { dbVerifiedSessionUserId: async () => state.userId },
  '@/hooks/use-toast': { toast: t => state.toasts.push(t) },
  react: { useState: init => curRunner.useState(init), useEffect: (fn, deps) => curRunner.useEffect(fn, deps) },
}
const sourceOf = (rel, overrides) => (rel in overrides ? overrides[rel] : real(rel))
function load(rel, overrides = {}) {
  const cache = new Map()
  const get = r => {
    if (cache.has(r)) return cache.get(r).exports
    const module = { exports: {} }; cache.set(r, module)
    const code = ts.transpileModule(sourceOf(r, overrides), { fileName: r, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const require = spec => spec in STUBS ? STUBS[spec] : spec.startsWith('@/') ? get(`${spec.slice(2)}.ts`) : nodeRequire(spec)
    new Function('module', 'exports', 'require', 'process', code)(module, module.exports, require, { env })
    return module.exports
  }
  return get(rel)
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)) }
function fakeClock() {
  let now = 0, seq = 0; const timers = new Map()
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id },
    clearTimeout: id => { timers.delete(id) },
    pending: () => [...timers.values()].map(t => t.at - now).sort((a, b) => a - b),
    async tick(ms) { const end = now + ms; for (;;) { const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle() } now = end },
  }
}
/** A tiny hook runner: useState / useEffect with deps and cleanups, re-render when a state changes. */
function createRunner(callFn) {
  const slots = []; let idx = 0, dirty = false, effects = [], value
  const runner = {
    useState(init) { const i = idx++; if (!(i in slots)) slots[i] = { v: typeof init === 'function' ? init() : init }; const slot = slots[i]; return [slot.v, nv => { const next = typeof nv === 'function' ? nv(slot.v) : nv; if (!Object.is(next, slot.v)) { slot.v = next; dirty = true } }] },
    useEffect(fn, deps) { const i = idx++; const prev = slots[i]; const changed = !prev || !deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps[k])); if (!changed) return; const holder = { deps, cleanup: prev ? prev.cleanup : undefined }; slots[i] = holder; effects.push(() => { if (holder.cleanup) holder.cleanup(); holder.cleanup = fn() }) },
  }
  const render = () => { for (let n = 0; n < 20; n++) { curRunner = runner; idx = 0; dirty = false; effects = []; value = callFn(); for (const e of effects) e(); curRunner = null; if (!dirty) break } return value }
  return { render, get: () => { if (dirty) render(); return value }, unmount: () => { for (const s of slots) if (s && typeof s.cleanup === 'function') s.cleanup() } }
}
const clone = x => JSON.parse(JSON.stringify(x))
const resetState = () => { state.fetches = []; state.reply = { status: 200, body: '{}' }; state.replies = []; state.toasts = []; state.warns = []; state.posted = []; state.frameSrc = null; state.userId = 'user-1' }
const ticketReply = (ticket, expires_in = 600) => ({ status: 200, body: JSON.stringify({ ticket, expires_in, url: `/p/deck-1?t=${ticket}` }) })
const BASE = 'https://layout.test/p/deck-1'

/** Run `fn` with the fakes installed (globals patched, restored after), the modules loaded first. */
async function withFakes(overrides, fn) {
  resetState(); env.LAYOUT_SERVICE_TOKEN = 'lst-made-up'
  const mods = { route: load(ROUTE, overrides), lib: load(LIB, overrides), hook: load(HOOK, overrides) }
  const clock = fakeClock(), saved = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document }, savedWarn = console.warn
  console.warn = (...a) => { state.warns.push(a.join(' ')) }
  globalThis.fetch = fakeFetch; globalThis.setTimeout = clock.setTimeout; globalThis.clearTimeout = clock.clearTimeout
  globalThis.document = { querySelectorAll: sel => (sel === 'iframe' ? [{ getAttribute: n => (n === 'src' ? state.frameSrc : null), contentWindow: { postMessage: (m, o) => state.posted.push([clone(m), o]) } }] : []) }
  const rejections = [], onRejection = e => rejections.push(e); process.on('unhandledRejection', onRejection)   // a throw inside the hook's async run() is a failure of the suite, not a crash of the test
  try { const out = await fn({ ...mods, clock }); await settle(); if (rejections.length) throw rejections[0]; return out }
  finally { process.off('unhandledRejection', onRejection); console.warn = savedWarn; Object.assign(globalThis, saved); if (saved.document === undefined) delete globalThis.document }
}
const post = (route, query, id = 'deck-1') => route.POST({ url: `https://studio.test/api/presentations/${id}/viewer-ticket${query}` }, { params: Promise.resolve({ id }) })
const scopeOf = url => new URL(url, 'https://studio.test').searchParams.getAll('scope')

// ---------------------------------------------------------------------------------------------------------- the checks, as functions of in-memory overrides (so the mutants reuse them)
const SUITE = {
  async routeFlagOff(m) { env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined; const r = await post(m.route, '?scope=edit'); assert.equal(r.status, 404); assert.equal(r.body.error, 'not_enabled'); assert.equal(state.fetches.length, 0) },
  async routeAbsent(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = ticketReply('tk')
    const r = await post(m.route, ''); assert.equal(r.status, 200)
    assert.equal(state.fetches.length, 1); assert.equal(state.fetches[0].url, 'https://layout.test/api/presentations/deck-1/viewer-ticket', 'no scope asked: nothing forwarded, exactly the request of before')
    assert.deepEqual({ ...state.fetches[0].init.headers }, { 'X-Layout-Service-Token': 'lst-made-up', 'X-Deckster-User-Id': 'user-1' })
    state.fetches = []; const old = await m.route.POST({}, { params: Promise.resolve({ id: 'deck-1' }) }); assert.equal(old.status, 200, 'the old call shape (a request without a url) still works')
    assert.equal(state.fetches[0].url, 'https://layout.test/api/presentations/deck-1/viewer-ticket')
  },
  async routeForwards(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = ticketReply('tk')
    for (const scope of ['edit', 'view']) { state.fetches = []; const r = await post(m.route, `?scope=${scope}`); assert.equal(r.status, 200); assert.equal(state.fetches.length, 1); assert.equal(state.fetches[0].url, `https://layout.test/api/presentations/deck-1/viewer-ticket?scope=${scope}`, scope) }
  },
  async routeRefusesOthers(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = ticketReply('tk')
    for (const q of ['?scope=admin', '?scope=', '?scope=EDIT', '?scope=Edit', '?scope=edit&scope=view', '?scope=view&scope=view', '?scope=edit%20', '?scope=view,edit', '?scope=edit;view', '?scope=1']) {
      state.fetches = []; const r = await post(m.route, q); assert.equal(r.status, 400, q); assert.equal(r.body.error, 'invalid_scope', q); assert.equal(state.fetches.length, 0, `${q}: Layout is not called`)
    }
  },
  async routePassesLayoutsAnswer(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    state.reply = { status: 403, body: JSON.stringify({ detail: 'Deck has no verified owner' }) }
    const r = await post(m.route, '?scope=edit'); assert.equal(r.status, 403); assert.equal(await r.text(), JSON.stringify({ detail: 'Deck has no verified owner' }))
    assert.equal(state.fetches.length, 1, 'one request, never a second with another scope'); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['edit']])
  },
  async libPathAndOutcomes(m) {
    const { viewerTicketPath, fetchViewerTicketOutcome, fetchViewerTicket, isTicketRefusal } = m.lib
    assert.equal(viewerTicketPath('deck-1'), '/api/presentations/deck-1/viewer-ticket'); assert.equal(viewerTicketPath('deck-1', 'edit'), '/api/presentations/deck-1/viewer-ticket?scope=edit')
    assert.equal(viewerTicketPath('deck-1', 'view'), '/api/presentations/deck-1/viewer-ticket?scope=view'); assert.equal(viewerTicketPath('a b/c', 'edit'), '/api/presentations/a%20b%2Fc/viewer-ticket?scope=edit')
    for (const s of [400, 401, 403, 404, 409, 422]) { assert.equal(isTicketRefusal(s), true, `${s} is a refusal`); state.replies = [{ status: s, body: '{}' }]; assert.deepEqual(await fetchViewerTicketOutcome('deck-1', 'edit', fakeFetch), { kind: 'refused', status: s }) }
    for (const s of [408, 429, 500, 502, 503, 504]) { assert.equal(isTicketRefusal(s), false, `${s} is a try-again`); state.replies = [{ status: s, body: '{}' }]; assert.deepEqual(await fetchViewerTicketOutcome('deck-1', 'edit', fakeFetch), { kind: 'transient' }) }
    state.replies = [new Error('network')]; assert.deepEqual(await fetchViewerTicketOutcome('deck-1', 'view', fakeFetch), { kind: 'transient' })
    state.replies = [{ status: 200, body: '{}' }]; assert.deepEqual(await fetchViewerTicketOutcome('deck-1', 'view', fakeFetch), { kind: 'transient' }, 'a 200 without a ticket is a try-again')
    state.replies = [ticketReply('tk9', 300)]; assert.deepEqual(await fetchViewerTicketOutcome('deck-1', 'view', fakeFetch), { kind: 'ticket', ticket: { ticket: 'tk9', expiresIn: 300, url: '/p/deck-1?t=tk9' } })
    state.replies = [ticketReply('tk1')]; assert.equal((await fetchViewerTicket('deck-1', fakeFetch)).ticket, 'tk1', 'the old signature (id, fetch) still returns the ticket')
    state.fetches = []; state.replies = [ticketReply('tk2')]; await fetchViewerTicket('deck-1', fakeFetch, 'edit'); assert.deepEqual(scopeOf(state.fetches[0].url), ['edit'])
    state.fetches = []; state.replies = [ticketReply('tk3')]; await fetchViewerTicket('deck-1', fakeFetch); assert.deepEqual(scopeOf(state.fetches[0].url), [], 'no scope asked: none sent')
  },
  /** The hook, with a fake clock: first ticket, the message at the renew time, the same scope every time. */
  async hookMintAndRenew(m, { name = 'useLayoutViewerTicketSrc', scope = 'edit' } = {}) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.replies = [ticketReply('tk1'), ticketReply('tk2'), ticketReply('tk3')]
    const runner = createRunner(() => name === 'useLayoutViewerTicketSrc' ? { src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1') } : m.hook.useLayoutViewerTicket(BASE, 'deck-1', scope))
    runner.render(); await settle()
    assert.equal(state.fetches.length, 1); assert.equal(state.fetches[0].init.method, 'POST'); assert.deepEqual(scopeOf(state.fetches[0].url), [scope], 'the first request carries the scope')
    const first = runner.get().src; assert.equal(first, `${BASE}?t=tk1`, 'the frame loads with the first ticket'); state.frameSrc = first
    assert.deepEqual(m.clock.pending(), [450_000], 'the renewal is set for 75% of the 600 s lifetime')
    await m.clock.tick(449_999); assert.equal(state.fetches.length, 1, 'nothing before the renew time'); assert.deepEqual(state.posted, [])
    await m.clock.tick(1); assert.equal(state.fetches.length, 2); assert.deepEqual(scopeOf(state.fetches[1].url), [scope], 'the renewal carries the same scope')
    assert.deepEqual(state.posted, [[{ type: 'deckster:viewer-ticket', ticket: 'tk2' }, 'https://layout.test']], 'the message, the new ticket, to the viewer origin only')
    assert.equal(runner.get().src, first, 'the frame is not reloaded (src unchanged)')
    await m.clock.tick(450_000); assert.equal(state.fetches.length, 3); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [[scope], [scope], [scope]]); assert.equal(state.posted.at(-1)[0].ticket, 'tk3')
    runner.unmount(); const n = state.fetches.length; await m.clock.tick(2_000_000); assert.equal(state.fetches.length, n, 'unmounted: no further request')
  },
  async hookRenewTimes(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    for (const [expires, delay] of [[600, 450_000], [100, 75_000], [10, 15_000], [0, 450_000]]) {
      state.fetches = []; state.replies = [ticketReply('a', expires)]
      const runner = createRunner(() => ({ src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1') })); runner.render(); await settle()
      assert.deepEqual(m.clock.pending(), [delay], `expires_in ${expires}: renew in ${delay} ms`); runner.unmount()
    }
  },
  async hookRetriesFailures(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.replies = [{ status: 503, body: '{}' }, { status: 429, body: '{}' }, ticketReply('tk1')]
    const runner = createRunner(() => ({ src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1') })); runner.render(); await settle()
    assert.equal(runner.get().src, null); assert.deepEqual(m.clock.pending(), [15_000], 'a failure is tried again in 15 s')
    await m.clock.tick(14_999); assert.equal(state.fetches.length, 1); await m.clock.tick(1); assert.equal(state.fetches.length, 2); await m.clock.tick(15_000); assert.equal(state.fetches.length, 3)
    assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['edit'], ['edit'], ['edit']], 'every retry asks the same scope'); assert.equal(runner.get().src, `${BASE}?t=tk1`); assert.deepEqual(state.toasts, []); runner.unmount()
  },
  async hookStopsOnRefusal(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = { status: 403, body: '{}' }
    const runner = createRunner(() => ({ ...m.hook.useLayoutViewerTicket(BASE, 'deck-1', 'edit') })); runner.render(); await settle()
    const r = runner.get(); assert.equal(r.src, 'about:blank', 'the frame is cleared at the first mint'); assert.equal(r.refusedStatus, 403)
    assert.equal(state.toasts.length, 1); assert.deepEqual(state.toasts[0], { title: "This deck can't be opened for editing.", variant: 'destructive' }, 'plain title, no body line')
    assert.ok(!/layout|\d{3}|403/i.test(JSON.stringify(state.toasts[0])), 'no service name and no status code on screen')
    assert.equal(state.warns.length, 1, 'the status goes to the console, once'); assert.match(state.warns[0], /edit/); assert.match(state.warns[0], /403/)
    assert.deepEqual(m.clock.pending(), [], 'no retry timer'); await m.clock.tick(5_000_000)
    assert.equal(state.fetches.length, 1, 'no loop'); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['edit']], 'never downgraded to view'); assert.equal(state.toasts.length, 1, 'told once'); runner.unmount()
  },
  async hookRefusedRenewal(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.replies = [ticketReply('tk1'), { status: 403, body: '{}' }]
    const runner = createRunner(() => ({ src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1') })); runner.render(); await settle(); state.frameSrc = runner.get().src; const shown = runner.get().src; assert.equal(shown, `${BASE}?t=tk1`, 'before the refusal the frame shows the deck')
    await m.clock.tick(450_000); assert.equal(state.fetches.length, 2); assert.equal(runner.get().src, 'about:blank', 'the refused renewal CLEARS the frame (the UI state matches the words)'); assert.notEqual(runner.get().src, shown); assert.equal(state.toasts.length, 1); assert.equal(state.warns.length, 1); assert.deepEqual(state.posted, [], 'no message for a refusal'); assert.deepEqual(m.clock.pending(), [])
    await m.clock.tick(5_000_000); assert.equal(state.fetches.length, 2, 'no loop'); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['edit'], ['edit']]); runner.unmount()
  },
  async hookTransientRenewalKeepsFrame(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.replies = [ticketReply('tk1'), { status: 503, body: '{}' }, ticketReply('tk2')]
    const runner = createRunner(() => ({ src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1') })); runner.render(); await settle(); const shown = runner.get().src; state.frameSrc = shown
    await m.clock.tick(450_000); assert.equal(state.fetches.length, 2); assert.equal(runner.get().src, shown, 'a failed renewal keeps showing the current document'); assert.deepEqual(state.toasts, []); assert.deepEqual(m.clock.pending(), [15_000])
    await m.clock.tick(15_000); assert.equal(state.fetches.length, 3); assert.equal(runner.get().src, shown); assert.equal(state.posted.at(-1)[0].ticket, 'tk2'); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['edit'], ['edit'], ['edit']]); runner.unmount()
  },
  async hookFlagOff(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined
    const runner = createRunner(() => ({ src: m.hook.useLayoutViewerTicketSrc(BASE, 'deck-1'), full: m.hook.useLayoutViewerTicket(BASE, 'deck-1', 'view') })); runner.render(); await settle()
    assert.equal(runner.get().src, BASE, 'flag off: the base URL, unchanged'); assert.deepEqual(runner.get().full, { src: BASE, refusedStatus: null }); assert.equal(state.fetches.length, 0); assert.deepEqual(m.clock.pending(), []); assert.deepEqual(state.toasts, []); runner.unmount()
  },
}
/** The callers: where the hooks are used, in source (not tests). The editing frame's hook has ONE caller, the Builder's one iframe; any other caller must say 'view' explicitly. */
function scanCallers(overrides = {}) {
  const found = { editing: [], general: [], rawFetch: [] }
  const files = ['app', 'components', 'hooks', 'lib'].flatMap(function walk(dir) { return fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap(e => { const rel = path.posix.join(dir, e.name); return e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(rel)) : /\.(ts|tsx)$/.test(e.name) ? [rel] : [] }) })
  for (const rel of [...new Set([...files, ...Object.keys(overrides)])]) {
    if (rel === HOOK || rel === LIB) continue
    const text = sourceOf(rel, overrides)
    for (const m of text.matchAll(/\buseLayoutViewerTicketSrc\s*\(/g)) found.editing.push(rel)
    for (const m of text.matchAll(/\buseLayoutViewerTicket\s*\(([^)]*)\)/g)) found.general.push({ rel, args: m[1] })
    if (/\bfetchViewerTicket(Outcome)?\b/.test(text)) found.rawFetch.push(rel)
  }
  return found
}
function callerFailures(overrides = {}) {
  const f = scanCallers(overrides), out = []
  if (JSON.stringify(f.editing) !== JSON.stringify([VIEWER])) out.push(`C1 the editing frame's hook has callers ${JSON.stringify(f.editing)} (expected only ${VIEWER})`)
  for (const g of f.general) if (!/,\s*'view'\s*$/.test(g.args.trim())) out.push(`C2 ${g.rel} calls useLayoutViewerTicket without 'view': (${g.args.trim()})`)
  if (f.rawFetch.length) out.push(`C3 these call the fetch helpers directly, bypassing the hooks' scope: ${f.rawFetch.join(', ')}`)
  const viewer = sourceOf(VIEWER, overrides), at = viewer.indexOf('ticketedIframeSrc !== approvedIframeNavigationUrl')
  if (!(at > 0 && viewer.slice(Math.max(0, at - 400), at).includes('<iframe'))) out.push('C4 the editing frame no longer feeds its iframe src from the hook result')
  return out
}

// ---------------------------------------------------------------------------------------------------------- the real code
await check('ROUTE flag off: 404 not_enabled and nothing is sent (scope or not)', () => withFakes({}, SUITE.routeFlagOff))
await check('ROUTE no scope asked: nothing is forwarded, the request of before (headers unchanged; the old call shape with no url still works)', () => withFakes({}, SUITE.routeAbsent))
await check('ROUTE scope=edit and scope=view are forwarded as Layout\'s own `scope` query parameter', () => withFakes({}, SUITE.routeForwards))
await check('ROUTE anything else (admin, empty, other case, repeated, padded, list) is refused with 400 invalid_scope and Layout is not called', () => withFakes({}, SUITE.routeRefusesOthers))
await check('ROUTE Layout\'s answer is passed through (a 403 stays 403, body unchanged) and is never retried with another scope', () => withFakes({}, SUITE.routePassesLayoutsAnswer))
await check('LIB the path carries the scope (and an encoded id); 4xx answers are refusals (400 401 403 404 409 422), 408 429 5xx network and a ticketless 200 are try-agains; the old signature still works', () => withFakes({}, SUITE.libPathAndOutcomes))
await check('HOOK (the editing frame\'s) with a fake clock: first request scope=edit, frame loads with the ticket, the deckster:viewer-ticket message at 75% of the lifetime (not before), same scope every renewal, frame not reloaded, unmount stops it', () => withFakes({}, SUITE.hookMintAndRenew))
await check('HOOK (general, scope view) with a fake clock: the same, asking view throughout', () => withFakes({}, m => SUITE.hookMintAndRenew(m, { name: 'useLayoutViewerTicket', scope: 'view' })))
await check('HOOK renew times: 600 s -> 450 s, 100 s -> 75 s, a short life floors at 15 s, a missing life reads 600 s', () => withFakes({}, SUITE.hookRenewTimes))
await check('HOOK a failure (503, 429) is tried again in 15 s with the same scope until a ticket comes', () => withFakes({}, SUITE.hookRetriesFailures))
await check('HOOK a REFUSAL (403) stops it: no retry, no loop, never downgraded to view, the frame stays unloaded, the person is told once (a destructive toast with the pinned plain title, no body, no service name or code; the status in the console only)', () => withFakes({}, SUITE.hookStopsOnRefusal))
await check('HOOK a refusal of a RENEWAL stops it too and CLEARS the frame to about:blank (the same as at the first mint): no message, no loop, told once', () => withFakes({}, SUITE.hookRefusedRenewal))
await check('HOOK a failed RENEWAL (503) keeps showing the current document, no toast, and retries in 15 s with the same scope', () => withFakes({}, SUITE.hookTransientRenewalKeepsFrame))
await check('HOOK flag off: the base URL, no request, no timer, no toast', () => withFakes({}, SUITE.hookFlagOff))
await check('CALLERS the editing frame\'s hook has exactly one caller, the Builder\'s one iframe (components/presentation-viewer.tsx); any other must call useLayoutViewerTicket(..., \'view\'); nothing bypasses the hooks', () => assert.deepEqual(callerFailures(), []))

// ---------------------------------------------------------------------------------------------------------- mutants (the sources change in memory only)
const MUTANTS = [
  ['the route forwards any scope unvalidated', { [ROUTE]: real(ROUTE).replace("  if (scope === 'invalid') return refuse('invalid_scope', 400)\n", '') }, SUITE.routeRefusesOthers],
  ['the route drops the scope from the upstream URL', { [ROUTE]: real(ROUTE).replace("${scope ? `?scope=${scope}` : ''}", '') }, SUITE.routeForwards],
  ['the route always forwards a scope (view when none was asked)', { [ROUTE]: real(ROUTE).replace("${scope ? `?scope=${scope}` : ''}", '?scope=${scope ?? "view"}') }, SUITE.routeAbsent],
  ['the route hides Layout\'s refusal behind a 200', { [ROUTE]: real(ROUTE).replace('status: upstream.status,', 'status: 200,') }, SUITE.routePassesLayoutsAnswer],
  ['the route refuses an uppercase scope no longer (it lowercases it)', { [ROUTE]: real(ROUTE).replace("new URL(req.url, 'http://studio.invalid').searchParams.getAll('scope')", "new URL(req.url, 'http://studio.invalid').searchParams.getAll('scope').map(v => v.toLowerCase())") }, SUITE.routeRefusesOthers],
  ['the library drops the scope from the path', { [LIB]: real(LIB).replace("${scope ? `?scope=${scope}` : ''}`\n}\n\n/** What one", "`\n}\n\n/** What one") }, SUITE.libPathAndOutcomes],
  ['the library never reads a 4xx as a refusal', { [LIB]: real(LIB).replace('return status >= 400 && status < 500 && status !== 408 && status !== 429', 'return false') }, SUITE.hookStopsOnRefusal],
  ['the library reads 429 as a refusal', { [LIB]: real(LIB).replace('status !== 408 && status !== 429', 'status !== 408') }, SUITE.libPathAndOutcomes],
  ['the renew fraction is 1 (renewing at expiry)', { [LIB]: real(LIB).replace('VIEWER_TICKET_RENEW_FRACTION = 0.75', 'VIEWER_TICKET_RENEW_FRACTION = 1') }, SUITE.hookMintAndRenew],
  ['the message type is another word', { [LIB]: real(LIB).replace("VIEWER_TICKET_MESSAGE_TYPE = 'deckster:viewer-ticket'", "VIEWER_TICKET_MESSAGE_TYPE = 'deckster:ticket'") }, SUITE.hookMintAndRenew],
  ['the message goes to every origin', { [LIB]: real(LIB).replace('new URL(viewerUrl).origin)', "'*')") }, SUITE.hookMintAndRenew],
  ['the editing frame\'s hook asks view', { [HOOK]: real(HOOK).replace("useLayoutViewerTicket(baseUrl, presentationId, 'edit').src", "useLayoutViewerTicket(baseUrl, presentationId, 'view').src") }, SUITE.hookMintAndRenew],
  ['the hook drops the scope on renewals', { [HOOK]: real(HOOK).replace('fetchViewerTicketOutcome(presentationId, scope)', 'fetchViewerTicketOutcome(presentationId, first ? scope : undefined)') }, SUITE.hookMintAndRenew],
  ['the hook posts the old ticket in the message', { [HOOK]: real(HOOK).replace('postViewerTicket(findViewerFrame(loadedSrc), minted.ticket, baseUrl)', "postViewerTicket(findViewerFrame(loadedSrc), 'old-ticket', baseUrl)") }, SUITE.hookMintAndRenew],
  ['the hook reloads the frame at every renewal (sets a new src)', { [HOOK]: real(HOOK).replace('postViewerTicket(findViewerFrame(loadedSrc), minted.ticket, baseUrl)', 'setSrc(withViewerTicket(baseUrl, minted.ticket))') }, SUITE.hookMintAndRenew],
  ['the hook retries a refusal (a loop)', { [HOOK]: real(HOOK).replace("if (outcome.kind === 'refused') {", "if (false) {") }, SUITE.hookStopsOnRefusal],
  ['the hook downgrades a refused edit to view and asks again', { [HOOK]: real(HOOK).replace("        return\n      }\n      if (outcome.kind === 'transient')", "        const again = await fetchViewerTicketOutcome(presentationId, 'view'); if (again.kind === 'ticket') setSrc(withViewerTicket(baseUrl, again.ticket.ticket))\n        return\n      }\n      if (outcome.kind === 'transient')") }, SUITE.hookStopsOnRefusal],
  ['the hook says nothing about a refusal', { [HOOK]: real(HOOK).replace(/        toast\(\{[\s\S]*?\n        \}\)\n/, '') }, SUITE.hookStopsOnRefusal],
  ['the toast shows the service and the status again', { [HOOK]: real(HOOK).replace("          variant: 'destructive',\n", "          description: `Layout refused the ${scope} request (${outcome.status}).`,\n          variant: 'destructive',\n") }, SUITE.hookStopsOnRefusal],
  ['the toast loses its full stop (the pinned title)', { [HOOK]: real(HOOK).replace('This deck can\'t be opened for editing."', 'This deck can\'t be opened for editing"') }, SUITE.hookStopsOnRefusal],
  ['the status is no longer logged to the console', { [HOOK]: real(HOOK).replace(/        console\.warn\([^\n]*\n/, '') }, SUITE.hookStopsOnRefusal],
  ['a refusal leaves the frame showing the old document', { [HOOK]: real(HOOK).replace(/        setSrc\(VIEWER_REFUSED_FRAME_SRC\)[^\n]*\n/, '') }, SUITE.hookRefusedRenewal],
  ['a refusal clears the frame to an empty string', { [LIB]: real(LIB).replace("VIEWER_REFUSED_FRAME_SRC = 'about:blank'", "VIEWER_REFUSED_FRAME_SRC = ''") }, SUITE.hookRefusedRenewal],
  ['only a refused RENEWAL clears the frame (a first-mint refusal leaves it as it was)', { [HOOK]: real(HOOK).replace(/        setSrc\(VIEWER_REFUSED_FRAME_SRC\)[^\n]*\n/, '        if (!first) setSrc(VIEWER_REFUSED_FRAME_SRC)\n') }, SUITE.hookStopsOnRefusal],
  ['a failure (503) clears the frame as well', { [HOOK]: real(HOOK).replace("if (outcome.kind === 'transient') { timer = setTimeout(run, RETRY_MS); return }", "if (outcome.kind === 'transient') { setSrc(VIEWER_REFUSED_FRAME_SRC); timer = setTimeout(run, RETRY_MS); return }") }, SUITE.hookTransientRenewalKeepsFrame],
  ['the hook does not retry a failure', { [HOOK]: real(HOOK).replace("if (outcome.kind === 'transient') { timer = setTimeout(run, RETRY_MS); return }", "if (outcome.kind === 'transient') return") }, SUITE.hookRetriesFailures],
  ['the hook keeps its renewal timer after unmount', { [HOOK]: real(HOOK).replace('return () => { cancelled = true; if (timer) clearTimeout(timer) }', 'return () => { cancelled = true }') }, SUITE.hookMintAndRenew],
  ['the hook ignores the flag', { [HOOK]: real(HOOK).replace("const enabled = isStudioLayoutTicketEnabled()", "const enabled = true") }, SUITE.hookFlagOff],
]
for (const [name, overrides, suite] of MUTANTS) await check(`MUTANT is caught: ${name}`, async () => {
  for (const [rel, text] of Object.entries(overrides)) assert.notEqual(text, real(rel), `the mutation changed ${rel}`)
  let failed = false
  try { await withFakes(overrides, m => suite(m)) } catch { failed = true }
  assert.ok(failed, 'the suite did not fail')
})
const CALLER_MUTANTS = [
  ['a second component calls the editing frame\'s hook (a view frame asking edit)', { 'components/pl46-second-frame.tsx': 'const src = useLayoutViewerTicketSrc(url, id)\n' }, 'C1'],
  ['a second component calls the general hook without a scope', { 'components/pl46-second-frame.tsx': 'const r = useLayoutViewerTicket(url, id)\n' }, 'C2'],
  ['a second component calls the general hook asking edit', { 'components/pl46-second-frame.tsx': "const r = useLayoutViewerTicket(url, id, 'edit')\n" }, 'C2'],
  ['a component fetches a ticket itself, bypassing the scope', { 'components/pl46-second-frame.tsx': "const t = await fetchViewerTicket(id)\n" }, 'C3'],
  ['the editing frame stops using the hook result for its iframe', { [VIEWER]: real(VIEWER).replace('ticketedIframeSrc !== approvedIframeNavigationUrl', 'false') }, 'C4'],
  ['the editing frame\'s hook is no longer called by the viewer', { [VIEWER]: real(VIEWER).replace('useLayoutViewerTicketSrc(approvedIframeNavigationUrl, presentationId)', 'approvedIframeNavigationUrl') }, 'C1'],
]
for (const [name, overrides, tag] of CALLER_MUTANTS) await check(`MUTANT is caught by ${tag}: ${name}`, () => {
  for (const [rel, text] of Object.entries(overrides)) if (fs.existsSync(path.join(repoRoot, rel))) assert.notEqual(text, real(rel), `the mutation changed ${rel}`)
  assert.ok(callerFailures(overrides).some(x => x.startsWith(tag)), `${tag} did not fail`)
})
const callers = scanCallers()
console.log(`\nCALLERS on this branch: the editing frame's hook (useLayoutViewerTicketSrc, scope edit): ${callers.editing.join(', ')}; the general hook (useLayoutViewerTicket): ${callers.general.length ? callers.general.map(g => g.rel).join(', ') : 'none'}; direct users of the fetch helpers outside the hook module: ${callers.rawFetch.length ? callers.rawFetch.join(', ') : 'none'}`)
console.log(`PASS: ${checks} checks passed, 0 failed (${MUTANTS.length + CALLER_MUTANTS.length} mutants caught)`)
