// PL-60 (ARCH-PLATFORM card 12:27Z, after PL-46): the Studio's OTHER live Layout frames (the rail's live preview, the Present view-only frame, the template workspace) ask for a VIEW ticket, so they keep
// working when Layout's capability strip and auth go on. Same flag, same base as PL-46: NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED (exact "true", default off): off, every frame is exactly the iframe it was.
//   node scripts/test-studio-pl60-view-tickets.mjs      (plain node, offline: the REAL helper, hooks and component transpiled and run; fetch, timers, document and the toast are fakes; React is real for the markup
//   checks and a small hook runner for the clock checks). Mutants change the sources in memory only.
// Proves: the presentation id read from a viewer URL; a ticketed frame with the flag off is BYTE FOR BYTE the bare iframe at each call site's props; with the flag on it asks scope=view (never edit),
// loads with ?t=<ticket> (query and slide hash kept), renews by message at 75% of the life; a refusal draws NOTHING and is logged, not toasted (the editing frame still toasts); a URL with no deck id loads as it is;
// and WHICH raw <iframe>s are left in app/ and components/ (each ticketed, or on the documented exclusion list).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const ts = nodeRequire('typescript')
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const LIB = 'lib/studio-layout-viewer-ticket.ts', HOOK = 'lib/studio-layout-viewer-ticket-client.ts', WRAP = 'components/layout-viewer-ticketed-iframe.tsx', ROUTE = 'app/api/presentations/[id]/viewer-ticket/route.ts'
const real = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
let checks = 0
const check = (name, fn) => { checks++; const r = fn(); return r && typeof r.then === 'function' ? r.then(() => console.log(`PASS ${name}`)) : (console.log(`PASS ${name}`), r) }

// ---------------------------------------------------------------------------------------------------------- the world (as PL-46's test): stubs, loader, fake clock, a tiny hook runner
const env = {}
const state = { fetches: [], reply: { status: 200, body: '{}' }, replies: [], toasts: [], warns: [], posted: [], frameSrc: null, gate: null }
class FakeRes { constructor({ status, body }) { this.status = status; this.ok = status >= 200 && status < 300; this._body = body } async json() { return JSON.parse(this._body) } }
const fakeFetch = async (url, init) => { state.fetches.push({ url: String(url), init }); if (state.gate) await state.gate; const r = state.replies.length ? state.replies.shift() : state.reply; if (r instanceof Error) throw r; return new FakeRes(r) }
let curRunner = null
// the Studio's Layout origin policy: the REAL policy module (import-free), built for one approved origin, handed to the wrapper in place of lib/layout-service-client (which reads the environment)
const policyModule = (() => { const m = { exports: {} }; new Function('module', 'exports', ts.transpileModule(real('lib/layout-viewer-url-policy.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(m, m.exports); return m.exports })()
const LAYOUT_POLICY = policyModule.createLayoutViewerUrlPolicy('https://layout.test')
const STUBS_BASE = { '@/hooks/use-toast': { toast: t => state.toasts.push(t) }, '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') }, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: LAYOUT_POLICY }, '@/hooks/use-rail-live-preview': { useRailLivePreview: () => ({ hostRef: { current: null }, mounted: true }), useRailPendingGrace: () => true } }
const sourceOf = (rel, overrides) => (rel in overrides ? overrides[rel] : real(rel))
function load(rel, overrides = {}, { realReact = false } = {}) {
  const cache = new Map()
  const stubs = { ...STUBS_BASE, ...(realReact ? {} : { react: { useState: i => curRunner.useState(i), useEffect: (f, d) => curRunner.useEffect(f, d), useRef: i => curRunner.useRef(i), forwardRef: fn => ({ render: fn }) } }) }
  const get = r => {
    if (cache.has(r)) return cache.get(r).exports
    const module = { exports: {} }; cache.set(r, module)
    const code = ts.transpileModule(sourceOf(r, overrides), { fileName: r, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const req = spec => spec in stubs ? stubs[spec] : spec.startsWith('@/') ? get(`${spec.slice(2)}${fs.existsSync(path.join(repoRoot, `${spec.slice(2)}.tsx`)) ? '.tsx' : '.ts'}`) : nodeRequire(spec)
    new Function('module', 'exports', 'require', 'process', code)(module, module.exports, req, { env })
    return module.exports
  }
  return get(rel)
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)) }
function fakeClock() {
  let now = 0, seq = 0; const timers = new Map()
  return { setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id }, clearTimeout: id => { timers.delete(id) }, pending: () => [...timers.values()].map(t => t.at - now).sort((a, b) => a - b),
    async tick(ms) { const end = now + ms; for (;;) { const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle() } now = end } }
}
function createRunner(callFn, { nullRef } = {}) {
  const slots = []; let idx = 0, dirty = false, effects = [], value
  const runner = {
    useState(init) { const i = idx++; if (!(i in slots)) slots[i] = { v: typeof init === 'function' ? init() : init }; const slot = slots[i]; return [slot.v, nv => { const next = typeof nv === 'function' ? nv(slot.v) : nv; if (!Object.is(next, slot.v)) { slot.v = next; dirty = true } }] },
    useRef(init) { const i = idx++; if (!(i in slots)) slots[i] = { v: init === null && nullRef ? nullRef : { current: init } }; return slots[i].v },
    useEffect(fn, deps) { const i = idx++; const prev = slots[i]; const changed = !prev || !deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps[k])); if (!changed) return; const holder = { deps, cleanup: prev ? prev.cleanup : undefined }; slots[i] = holder; effects.push(() => { if (holder.cleanup) holder.cleanup(); holder.cleanup = fn() }) },
  }
  const render = () => { const outer = curRunner; for (let n = 0; n < 20; n++) { curRunner = runner; idx = 0; dirty = false; effects = []; value = callFn(); for (const e of effects) e(); curRunner = outer; if (!dirty) break } return value }
  return { render, get: () => { if (dirty) render(); return value }, unmount: () => { for (const s of slots) if (s && typeof s.cleanup === 'function') s.cleanup() } }
}
const clone = x => JSON.parse(JSON.stringify(x))
const resetState = () => { state.fetches = []; state.reply = { status: 200, body: '{}' }; state.replies = []; state.toasts = []; state.warns = []; state.posted = []; state.frameSrc = null; state.gate = null }
const ticketReply = (ticket, expires_in = 600) => ({ status: 200, body: JSON.stringify({ ticket, expires_in, url: `/p/deck-1?t=${ticket}` }) })
async function withFakes(overrides, fn) {
  resetState()
  const mods = { lib: load(LIB, overrides), hook: load(HOOK, overrides), wrap: load(WRAP, overrides) }
  const clock = fakeClock(), saved = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document }, savedWarn = console.warn
  console.warn = (...a) => { state.warns.push(a.join(' ')) }
  globalThis.fetch = fakeFetch; globalThis.setTimeout = clock.setTimeout; globalThis.clearTimeout = clock.clearTimeout
  globalThis.document = { querySelectorAll: sel => (sel === 'iframe' ? [{ getAttribute: n => (n === 'src' ? state.frameSrc : null), contentWindow: { postMessage: (m, o) => state.posted.push([clone(m), o]) } }] : []) }
  const rejections = [], onRejection = e => rejections.push(e); process.on('unhandledRejection', onRejection)
  try { const out = await fn({ ...mods, clock }); await settle(); if (rejections.length) throw rejections[0]; return out }
  finally { process.off('unhandledRejection', onRejection); console.warn = savedWarn; Object.assign(globalThis, saved); if (saved.document === undefined) delete globalThis.document }
}
const scopeOf = url => new URL(url, 'https://studio.test').searchParams.getAll('scope')
const FRAME_URL = 'https://layout.test/p/deck-1?viewOnly=true#/3'
const renderWrap = (m, props) => m.wrap.ViewTicketedIframe.render(props, null)   // the forwardRef stub exposes the render function: the element it returns (or null)

const PRESENT = 'components/present-view-only-frame.tsx'
const RAIL = 'components/rail-live-preview.tsx'
/** The REAL Present frame with the REAL ViewTicketedIframe (and hook), composed by two runners: the Present frame's iframe ref reads whether the wrapper currently draws a frame. */
function mountPresent(overrides, flagOn) {
  env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = flagOn ? 'true' : undefined
  const mod = load(PRESENT, overrides), ev = { failed: 0, slides: [] }, frameRef = { current: null }, frameNode = { focus() {} }
  const sendCommand = async (iframe, action) => { if (!iframe) throw new Error('no frame'); return { success: true, action, data: { index: 4, total: 9 } } }
  let presentRunner, wrapperRunner
  const nullRef = { get current() { return presentRunner.get() && wrapperRunner.get() ? frameNode : null }, set current(_v) {} }
  presentRunner = createRunner(() => mod.PresentViewOnlyFrame({ baseUrl: 'https://layout.test/p/deck-1', startIndex: 4, sendCommand, frameRef, onSlideIndex: i => ev.slides.push(i), onFailed: () => { ev.failed += 1 } }), { nullRef })
  wrapperRunner = createRunner(() => { const tree = presentRunner.get(); if (!tree) return null; const el = tree.props.children; return el.type.render(el.props, null) })
  presentRunner.render(); wrapperRunner.render()
  return { ev, frameRef, frameNode, overlay: () => presentRunner.get() !== null, unmount: () => { presentRunner.unmount(); wrapperRunner.unmount() } }
}

// ---------------------------------------------------------------------------------------------------------- the suites, as functions of in-memory overrides (so the mutants reuse them)
const SUITE = {
  async idFromUrl(m) {
    const f = m.lib.presentationIdFromViewerUrl
    for (const [url, id] of [['https://layout.test/p/deck-1', 'deck-1'], ['https://layout.test/p/deck-1?viewOnly=true#/3', 'deck-1'], ['https://layout.test/p/deck-1/', 'deck-1'], ['https://layout.test/p/AbC.d_e:f-1?studio_build_snapshot=4&viewOnly=true#/0', 'AbC.d_e:f-1'], ['http://localhost:3000/p/7f9c1e', '7f9c1e']]) assert.equal(f(url), id, url)
    for (const url of [null, undefined, '', 'not a url', 'https://layout.test/', 'https://layout.test/p/', 'https://layout.test/p/a/b', 'https://layout.test/q/deck-1', 'https://layout.test/api/p/deck-1', 'https://layout.test/p/a b', 'https://layout.test/p/%E0%A4%A', 'https://layout.test/p/-deck', 'https://layout.test/p/.deck', `https://layout.test/p/${'a'.repeat(256)}`]) assert.equal(f(url), null, String(url))
    assert.equal(f(`https://layout.test/p/${'a'.repeat(255)}`), 'a'.repeat(255), 'the longest id the route accepts')
  },
  /** With the flag OFF the ticketed frame is BYTE FOR BYTE the bare iframe, at each call site's own props (and in the same attribute order). */
  async flagOffIdentity(_m, overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined
    const Wrapper = load(WRAP, overrides, { realReact: true }).ViewTicketedIframe
    const SITES = {
      'the rail live preview': { src: FRAME_URL, title: 'Live slide preview', 'aria-hidden': 'true', tabIndex: -1, 'data-studio-rail-live-frame': 'loading', style: { position: 'absolute', top: 0, left: 0, width: 1920, height: 1080, border: 0, opacity: 0 } },
      'the Present view-only frame': { src: 'https://layout.test/p/deck-1?viewOnly=true#/4', title: 'Presentation (view only)', allow: 'fullscreen', className: 'h-full w-full border-0 transition-opacity duration-200 opacity-0' },
      'the template workspace': { src: 'https://layout.test/p/deck-1', title: 'Slide 2 of the as-is deck' },
    }
    for (const [site, props] of Object.entries(SITES)) assert.equal(renderToStaticMarkup(React.createElement(Wrapper, props)), renderToStaticMarkup(React.createElement('iframe', props)), `${site}: the same markup as the bare iframe`)
  },
  async flagOnMarkup(_m, overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    const Wrapper = load(WRAP, overrides, { realReact: true }).ViewTicketedIframe
    const html = renderToStaticMarkup(React.createElement(Wrapper, { src: FRAME_URL, title: 'x' })); assert.equal(html, '', `a deck frame is not mounted until its ticket (${html})`)
    const other = renderToStaticMarkup(React.createElement(Wrapper, { src: 'https://layout.test/not-a-deck', title: 'x' })); assert.ok(/src="https:\/\/layout\.test\/not-a-deck"/.test(other), 'a URL with no deck id loads as it is')
  },
  async viewMintAndRenew(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.replies = [ticketReply('tk1'), ticketReply('tk2')]
    const runner = createRunner(() => renderWrap(m, { src: FRAME_URL, title: 'Live slide preview' })); runner.render(); await settle()
    assert.equal(state.fetches.length, 1); assert.deepEqual(scopeOf(state.fetches[0].url), ['view'], 'a preview asks VIEW, never edit'); assert.match(state.fetches[0].url, /\/api\/presentations\/deck-1\/viewer-ticket\?scope=view$/)
    const el = runner.get(); assert.equal(el.type, 'iframe'); assert.equal(el.props.src, 'https://layout.test/p/deck-1?viewOnly=true&t=tk1#/3', 'the ticket joins the query; the slide hash is kept'); assert.equal(el.props.title, 'Live slide preview'); state.frameSrc = el.props.src
    assert.deepEqual(m.clock.pending(), [450_000]); await m.clock.tick(449_999); assert.equal(state.fetches.length, 1); await m.clock.tick(1)
    assert.equal(state.fetches.length, 2); assert.deepEqual(scopeOf(state.fetches[1].url), ['view'], 'the renewal asks view too'); assert.deepEqual(state.posted, [[{ type: 'deckster:viewer-ticket', ticket: 'tk2' }, 'https://layout.test']]); assert.equal(runner.get().props.src, el.props.src, 'not reloaded')
    runner.unmount()
  },
  async viewRefusal(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = { status: 403, body: '{}' }
    const runner = createRunner(() => renderWrap(m, { src: FRAME_URL, title: 'x' })); runner.render(); await settle()
    assert.equal(runner.get(), null, 'a refused frame draws NOTHING (no blank page)'); assert.deepEqual(state.toasts, [], 'a background frame is not toasted'); assert.equal(state.warns.length, 1); assert.match(state.warns[0], /view/); assert.match(state.warns[0], /403/)
    assert.deepEqual(m.clock.pending(), []); await m.clock.tick(5_000_000); assert.equal(state.fetches.length, 1, 'no loop'); assert.deepEqual(state.fetches.map(f => scopeOf(f.url)), [['view']], 'never asks edit'); runner.unmount()
  },
  async noIdNoTicket(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    const runner = createRunner(() => renderWrap(m, { src: 'https://layout.test/not-a-deck', title: 'x' })); runner.render(); await settle()
    assert.equal(runner.get().props.src, 'https://layout.test/not-a-deck'); assert.equal(state.fetches.length, 0, 'no deck id: no ticket asked'); assert.deepEqual(m.clock.pending(), []); runner.unmount()
  },
  /** REVIEW-CX P2: the id of a viewer URL only when its FULL URL is on the approved Layout origin list. */
  async approvedOrigin(m) {
    const f = m.lib.approvedPresentationIdFromViewerUrl
    for (const url of ['https://layout.test/p/deck-1', 'https://layout.test/p/deck-1?viewOnly=true#/3', 'https://layout.test/p/deck-1?studio_build_snapshot=4&viewOnly=true#/0']) assert.equal(f(url, LAYOUT_POLICY), 'deck-1', url)
    for (const url of ['https://evil.test/p/deck-1', 'https://layout.test.evil.test/p/deck-1', 'https://layout-test.com/p/deck-1', 'https://sub.layout.test/p/deck-1', 'https://evil.layout.test.evil/p/deck-1',
      'http://layout.test/p/deck-1', 'ftp://layout.test/p/deck-1', 'https://layout.test:8443/p/deck-1', 'https://layout.test@evil.test/p/deck-1', 'https://user:pw@layout.test/p/deck-1', 'https://layout.test/not-a-deck', '//evil.test/p/deck-1', null, undefined, '']) assert.equal(f(url, LAYOUT_POLICY), null, String(url))
    assert.equal(f('https://layout.test/p/deck-1', policyModule.createLayoutViewerUrlPolicy('')), null, 'no approved origin configured: no ticket')
    assert.equal(f('https://other.test/p/deck-1', policyModule.createLayoutViewerUrlPolicy('https://layout.test', 'https://other.test')), 'deck-1', 'an origin the environment lists is approved')
  },
  /** With the flag on, a URL outside the approved origins FAILS CLOSED (ARCH-PLATFORM 16:00Z): no request, no timer, no frame, one log line naming the origin (never the URL); flag off it loads as before. */
  async unapprovedMintsNothing(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    for (const url of ['https://evil.test/p/deck-1?secret=abc#/2', 'https://layout.test.evil.test/p/deck-1?secret=abc', 'http://layout.test/p/deck-1?secret=abc', 'https://user:pw@layout.test/p/deck-1?secret=abc', 'https://evil.test/not-a-deck?secret=abc', 'ftp://layout.test/p/deck-1?secret=abc']) {
      resetState()
      const runner = createRunner(() => renderWrap(m, { src: url, title: 'x' })); runner.render(); await settle(); runner.render(); await settle()
      assert.equal(runner.get(), null, `${url}: draws NOTHING`); assert.equal(state.fetches.length, 0, `${url}: no request`); assert.deepEqual(m.clock.pending(), [], `${url}: no timer`); assert.deepEqual(state.toasts, [])
      assert.equal(state.warns.length, 1, `${url}: logged ONCE (two renders)`); assert.match(state.warns[0], /not an approved Layout origin/); assert.ok(!/secret|abc|user:pw/.test(state.warns[0]), 'the log names the origin, never the URL'); runner.unmount()
    }
    resetState()
    for (const url of ['https://layout.test/p/deck-1', 'https://layout.test/not-a-deck']) { const ok = createRunner(() => renderWrap(m, { src: url, title: 'x' })); ok.render(); await settle(); assert.deepEqual(state.warns, [], `${url}: an approved origin is not logged`); ok.unmount() }
    resetState(); env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined
    for (const url of ['https://evil.test/p/deck-1', 'https://evil.test/not-a-deck']) { const off = createRunner(() => renderWrap(m, { src: url, title: 'x' })); off.render(); await settle(); assert.equal(off.get().props.src, url, `${url}: flag off loads as before`); off.unmount() }
    assert.deepEqual(state.warns, [], 'flag off: silent'); assert.equal(state.fetches.length, 0)
  },
  /** REVIEW-CX P3: the rail stays LOADING until a viewer source loads: no frame exists while the first ticket is pending (so no empty about:blank `load` can raise it), none after a refusal, and the load of the ticketed src raises it. */
  async railStaysLoading(m, overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    const rail = load(RAIL, overrides)
    const mount = () => {
      let railRunner, frameRunner, wrapperRunner
      railRunner = createRunner(() => rail.RailLivePreview({ viewerUrl: 'https://layout.test/p/deck-1', slideIndex: 2, status: 'none' }))
      frameRunner = createRunner(() => { const el = railRunner.get().props.children; return el.type(el.props) })
      wrapperRunner = createRunner(() => { const el = frameRunner.get(); return el.type.render(el.props, null) })
      railRunner.render(); frameRunner.render(); wrapperRunner.render()
      return { iframe: () => wrapperRunner.get(), live: () => frameRunner.get(), load: () => { const f = wrapperRunner.get(); if (!f) return false; frameRunner.get().props.onLoad(); return true }, unmount: () => { railRunner.unmount(); frameRunner.unmount(); wrapperRunner.unmount() } }
    }
    let release; state.gate = new Promise(r => { release = r }); state.replies = [ticketReply('tk1')]
    const a = mount(); await settle()
    assert.equal(a.iframe(), null, 'no frame exists while the first ticket is pending'); assert.equal(a.load(), false, 'so no load can happen'); assert.equal(a.live().props['data-studio-rail-live-frame'], 'loading'); assert.equal(a.live().props.style.opacity, 0)
    release(); await settle()
    const f = a.iframe(); assert.ok(f && /[?&]t=tk1/.test(f.props.src) && f.props.src.startsWith('https://layout.test/p/deck-1'), 'the frame mounts with its ticketed viewer src'); assert.equal(a.live().props['data-studio-rail-live-frame'], 'loading', 'still loading until the viewer loads')
    assert.equal(a.load(), true); assert.equal(a.live().props['data-studio-rail-live-frame'], 'ready'); assert.equal(a.live().props.style.opacity, 1); a.unmount()
    resetState(); state.reply = { status: 403, body: '{}' }
    const b = mount(); await settle(); assert.equal(b.iframe(), null, 'a refused first ticket: no frame'); assert.equal(b.load(), false); assert.equal(b.live().props['data-studio-rail-live-frame'], 'loading'); b.unmount()
  },
  /** REVIEW-CX P2: a view frame that was READY and is then refused at a renewal is a failure: one failure callback, a null frame ref, no pending poll, no overlay. */
  async presentRefusedRenewal(m, overrides) {
    state.replies = [ticketReply('tk1')]; state.reply = { status: 403, body: '{}' }
    const p = mountPresent(overrides, true); await settle()
    await m.clock.tick(400); await settle()
    assert.equal(p.frameRef.current, p.frameNode, 'ready: the frame is handed to the parent'); assert.deepEqual(p.ev.slides, [4]); assert.equal(p.ev.failed, 0)
    await m.clock.tick(449_000); assert.equal(p.ev.failed, 0, 'before the renewal nothing fails'); assert.equal(state.fetches.length, 1)
    await m.clock.tick(1_000); await m.clock.tick(800); await settle()
    assert.equal(state.fetches.length, 2, 'the renewal was asked'); assert.deepEqual(scopeOf(state.fetches[1].url), ['view'])
    assert.equal(p.ev.failed, 1, 'ONE failure callback'); assert.equal(p.frameRef.current, null, 'the parent no longer forwards keys to a detached frame'); assert.equal(p.overlay(), false, 'no overlay')
    assert.deepEqual(m.clock.pending(), [], 'no poll left running'); await m.clock.tick(120_000); assert.equal(p.ev.failed, 1, 'still one'); assert.equal(state.fetches.length, 2, 'no loop'); p.unmount()
  },
  /** Flag off the frame is never unmounted: the poll runs on, the frame stays handed to the parent, nothing fails. */
  async presentFlagOffStays(m, overrides) {
    const p = mountPresent(overrides, false); await settle()
    await m.clock.tick(400); await settle(); assert.equal(p.frameRef.current, p.frameNode)
    await m.clock.tick(900_000); assert.equal(p.ev.failed, 0); assert.equal(p.frameRef.current, p.frameNode); assert.equal(p.overlay(), true); assert.equal(state.fetches.length, 0); assert.ok(m.clock.pending().length > 0, 'the poll keeps running'); p.unmount()
  },
  async toastOnlyForEditByDefault(m) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'; state.reply = { status: 403, body: '{}' }
    const run = async call => { resetState(); state.reply = { status: 403, body: '{}' }; const r = createRunner(call); r.render(); await settle(); const out = { toasts: state.toasts.length, warns: state.warns.length, src: r.get().src }; r.unmount(); return out }
    const base = 'https://layout.test/p/deck-1'
    assert.deepEqual(await run(() => m.hook.useLayoutViewerTicket(base, 'deck-1', 'edit')), { toasts: 1, warns: 1, src: 'about:blank' }, 'the EDITING frame is still toasted')
    assert.deepEqual(await run(() => m.hook.useLayoutViewerTicket(base, 'deck-1', 'view')), { toasts: 0, warns: 1, src: 'about:blank' }, 'a view frame is silent by default')
    assert.deepEqual(await run(() => m.hook.useLayoutViewerTicket(base, 'deck-1', 'view', { notify: true })), { toasts: 1, warns: 1, src: 'about:blank' }, 'notify: true toasts a view frame')
    assert.deepEqual(await run(() => m.hook.useLayoutViewerTicket(base, 'deck-1', 'edit', { notify: false })), { toasts: 0, warns: 1, src: 'about:blank' }, 'notify: false silences an edit frame')
  },
}
/** The raw <iframe>s in app/ and components/: each is ticketed (the wrapper) or on the documented exclusion list. */
const EXCLUDED = { 'components/layout-viewer-ticketed-iframe.tsx': 'the wrapper itself', 'components/presentation-viewer.tsx': "the Builder's editing frame (edit ticket, PL-46)",
  'components/published-viewer.tsx': 'the published snapshot viewer (viewOnly; ARCH-RENDER: snapshots stay open without a ticket)', 'app/(app)/dashboard/page.tsx': 'the dashboard deck cards (one iframe per card: awaiting ARCH-PLATFORM\'s ruling on how many tickets that mints)' }
const TICKETED = ['components/rail-live-preview.tsx', 'components/present-view-only-frame.tsx', 'components/studio-template-workspace/shared.tsx']
function iframeFailures(overrides = {}) {
  const out = [], files = ['app', 'components'].flatMap(function walk(dir) { return fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap(e => { const rel = path.posix.join(dir, e.name); return e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(rel)) : /\.(ts|tsx)$/.test(e.name) ? [rel] : [] }) })
  for (const rel of [...new Set([...files, ...Object.keys(overrides)])]) {
    if (!/\.(ts|tsx)$/.test(rel)) continue
    const text = sourceOf(rel, overrides), raw = /<iframe\b/.test(text), ticketed = /<ViewTicketedIframe\b/.test(text)
    if (raw && !(rel in EXCLUDED)) out.push(`C1 ${rel} has a raw <iframe> and is neither ticketed nor on the exclusion list`)
    if (TICKETED.includes(rel) && (raw || !ticketed || !text.includes("from '@/components/layout-viewer-ticketed-iframe'"))) out.push(`C2 ${rel} must use <ViewTicketedIframe> (imported from the component) and no raw <iframe>`)
    if (ticketed && !TICKETED.includes(rel) && rel !== WRAP) out.push(`C3 ${rel} uses <ViewTicketedIframe> but is not on the ticketed list`)
  }
  const w = sourceOf(WRAP, overrides); if (!/useLayoutViewerTicket\(src, presentationId, 'view'\)/.test(w)) out.push("C4 the wrapper does not ask the 'view' scope")
  if (!/approvedPresentationIdFromViewerUrl\(src, LAYOUT_VIEWER_URL_POLICY\)/.test(w)) out.push('C6 the wrapper takes the deck id only from an approved Layout origin')
  if (!sourceOf(ROUTE, overrides).includes(String(sourceOf(LIB, overrides).match(/VIEWER_PRESENTATION_ID_PATTERN = (\/[^\n]*\/)\n/)?.[1]))) out.push('C5 the id pattern differs from the route\'s')
  return out
}

// ---------------------------------------------------------------------------------------------------------- the real code
await check('ID the presentation id of a viewer URL (query and hash allowed; no id, an unaccepted id, or another path shape: null; the longest id the route accepts)', () => withFakes({}, SUITE.idFromUrl))
await check('MARKUP flag off: the ticketed frame is BYTE FOR BYTE the bare iframe at the rail preview\'s, the Present frame\'s and the template workspace\'s own props', () => withFakes({}, m => SUITE.flagOffIdentity(m, {})))
await check('MARKUP flag on: a deck frame is not mounted until its ticket (no empty frame); a URL with no deck id loads as it is', () => withFakes({}, m => SUITE.flagOnMarkup(m, {})))
await check('CLOCK flag on: asks scope=view (never edit), loads with ?t=<ticket> keeping ?viewOnly and the #/N slide, renews by message at 75% of the life (not before), same scope, not reloaded', () => withFakes({}, SUITE.viewMintAndRenew))
await check('REFUSAL a refused view ticket draws NOTHING (no blank page), is logged once and not toasted, never loops and never asks edit', () => withFakes({}, SUITE.viewRefusal))
await check('NO ID a URL with no deck id asks for no ticket and loads as it is', () => withFakes({}, SUITE.noIdNoTicket))
await check('TOAST the editing frame is still toasted on a refusal; a view frame is silent by default; the notify option turns either way', () => withFakes({}, SUITE.toastOnlyForEditByDefault))
await check('ORIGIN a ticket is only for an approved Layout origin: the id comes back for the approved origin only (foreign, look-alike, subdomain, non-https, port, credentials, no policy: none)', () => withFakes({}, SUITE.approvedOrigin))
await check('ORIGIN flag on, a URL outside the approved origins (foreign, look-alike, non-https, credentialed, non-viewer path, other scheme) FAILS CLOSED: no request, no timer, no frame, logged once with the origin only; an approved origin is not logged; flag off it loads as before and is silent', () => withFakes({}, SUITE.unapprovedMintsNothing))
await check('RAIL with view tickets on the rail stays loading until a viewer source loads: no frame while the first ticket is pending (so no empty about:blank load), none after a refusal, ready only after the ticketed src loads', () => withFakes({}, m => SUITE.railStaysLoading(m, {})))
await check('PRESENT a view frame that was ready and is refused at a renewal ends Present\'s view cleanly: one failure callback, a null frame ref, no overlay, no poll, no loop', () => withFakes({}, m => SUITE.presentRefusedRenewal(m, {})))
await check('PRESENT flag off the frame is never unmounted: ready stays, nothing fails, no ticket is asked, the poll runs on', () => withFakes({}, m => SUITE.presentFlagOffStays(m, {})))
await check('IFRAMES every raw <iframe> in app/ and components/ is ticketed or on the documented exclusion list; the three call sites use the wrapper; the wrapper asks view; the id pattern is the route\'s', () => assert.deepEqual(iframeFailures(), []))

// ---------------------------------------------------------------------------------------------------------- mutants (the sources change in memory only)
const MUTANTS = [
  ['the id helper accepts a longer path (no anchor)', { [LIB]: real(LIB).replace("/^\\/p\\/([^/]+)\\/?$/.exec", "/\\/p\\/([^/]+)/.exec") }, SUITE.idFromUrl],
  ['the id helper skips the id pattern', { [LIB]: real(LIB).replace('return VIEWER_PRESENTATION_ID_PATTERN.test(id) ? id : null', 'return id') }, SUITE.idFromUrl],
  ['the wrapper asks the edit scope', { [WRAP]: real(WRAP).replace("useLayoutViewerTicket(src, presentationId, 'view')", "useLayoutViewerTicket(src, presentationId, 'edit')") }, SUITE.viewMintAndRenew],
  ['the wrapper draws a blank frame on a refusal', { [WRAP]: real(WRAP).replace('  if (refusedStatus !== null) return null\n', '') }, SUITE.viewRefusal],
  ['the wrapper loads the ticketed src even without a deck id', { [WRAP]: real(WRAP).replace('presentationId ? ticketed ?? undefined : src', 'ticketed ?? undefined') }, SUITE.noIdNoTicket],
  ['the wrapper drops the rest of the props', { [WRAP]: real(WRAP).replace(' {...rest} />', ' />') }, SUITE.flagOffIdentity],
  ['the wrapper puts src after the other props (the attribute order changes)', { [WRAP]: real(WRAP).replace('<iframe ref={ref} src={presentationId ? ticketed ?? undefined : src} {...rest} />', '<iframe ref={ref} {...rest} src={presentationId ? ticketed ?? undefined : src} />') }, SUITE.flagOffIdentity],
  ['the wrapper adds a wrapping element', { [WRAP]: real(WRAP).replace('return <iframe ref={ref} src={presentationId ? ticketed ?? undefined : src} {...rest} />', 'return <div><iframe ref={ref} src={presentationId ? ticketed ?? undefined : src} {...rest} /></div>') }, SUITE.flagOffIdentity],
  ['a view frame is toasted by default', { [HOOK]: real(HOOK).replace("const notify = options?.notify ?? scope === 'edit'", 'const notify = options?.notify ?? true') }, SUITE.toastOnlyForEditByDefault],
  ['the editing frame is no longer toasted by default', { [HOOK]: real(HOOK).replace("const notify = options?.notify ?? scope === 'edit'", "const notify = options?.notify ?? false") }, SUITE.toastOnlyForEditByDefault],
  ['the notify option is ignored', { [HOOK]: real(HOOK).replace("const notify = options?.notify ?? scope === 'edit'", "const notify = scope === 'edit'") }, SUITE.toastOnlyForEditByDefault],
]
MUTANTS.push(
  ['the id helper skips the origin policy', { [LIB]: real(LIB).replace("return evaluateLayoutViewerUrl(viewerUrl, policy).status === 'allowed' ? id : null", 'return id') }, (m2) => SUITE.approvedOrigin(m2)],
  ['the id helper allows any https origin', { [LIB]: real(LIB).replace("evaluateLayoutViewerUrl(viewerUrl, policy).status === 'allowed'", "new URL(viewerUrl).protocol === 'https:'") }, (m2) => SUITE.approvedOrigin(m2)],
  ['the wrapper draws an unapproved frame (loads it bare)', { [WRAP]: real(WRAP).replace('  if (unapproved) return null\n', '') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper only fails closed for a deck-shaped URL', { [WRAP]: real(WRAP).replace("evaluateLayoutViewerUrl(src, LAYOUT_VIEWER_URL_POLICY).status === 'blocked'", "evaluateLayoutViewerUrl(src, LAYOUT_VIEWER_URL_POLICY).status === 'blocked' && /\\/p\\//.test(src)") }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper fails closed even with the flag off', { [WRAP]: real(WRAP).replace('isStudioLayoutTicketEnabled() && evaluateLayoutViewerUrl', 'evaluateLayoutViewerUrl') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper takes the id without the policy (the old behaviour)', { [WRAP]: real(WRAP).replace('approvedPresentationIdFromViewerUrl(src, LAYOUT_VIEWER_URL_POLICY)', 'presentationIdFromViewerUrl(src)') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper does not log an unapproved URL', { [WRAP]: real(WRAP).replace(/    if \(unapproved\) console\.warn\([^\n]*\n/, '') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper logs the whole URL', { [WRAP]: real(WRAP).replace('${safeOrigin(src)}', '${src}') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
  ['the wrapper logs on every render (no dependency list)', { [WRAP]: real(WRAP).replace('  }, [unapproved, src])', '  })') }, (m2) => SUITE.unapprovedMintsNothing(m2)],
)
MUTANTS.push(
  ['the wrapper mounts an empty frame while the first ticket is pending', { [WRAP]: real(WRAP).replace("  if (presentationId && ticketed === null) return null\n", '') }, (m2, o) => SUITE.railStaysLoading(m2, o)],
  ['the wrapper mounts the frame again after a refusal', { [WRAP]: real(WRAP).replace('  if (refusedStatus !== null) return null\n', '') }, (m2, o) => SUITE.railStaysLoading(m2, o)],
)
const PRESENT_BLOCK = real(PRESENT).match(/      \/\/ LAYOUT-TICKET \(PL-60, REVIEW-CX P2\)[\s\S]*?\n      }\n/)?.[0]
assert.ok(PRESENT_BLOCK, 'the Present frame carries the PL-60 failure block')
const presentMutant = text => ({ [PRESENT]: real(PRESENT).replace(PRESENT_BLOCK, text) })
MUTANTS.push(
  ['Present: a gone ready frame is not treated as a failure', presentMutant(''), (m, o) => SUITE.presentRefusedRenewal(m, o)],
  ['Present: the frame ref is not cleared', presentMutant(PRESENT_BLOCK.replace('        frameRef.current = null\n', '')), (m, o) => SUITE.presentRefusedRenewal(m, o)],
  ['Present: the failure callback is not called', presentMutant(PRESENT_BLOCK.replace('        latest.current.onFailed()\n', '')), (m, o) => SUITE.presentRefusedRenewal(m, o)],
  ['Present: the poll is not stopped', presentMutant(PRESENT_BLOCK.replace('        return\n', '')), (m, o) => SUITE.presentRefusedRenewal(m, o)],
  ['Present: the overlay stays up', presentMutant(PRESENT_BLOCK.replace('        setFailed(true)\n', '')), (m, o) => SUITE.presentRefusedRenewal(m, o)],
  ['Present: a flag-off frame is failed', presentMutant(PRESENT_BLOCK.replace('isReady && !iframeRef.current', 'isReady')), (m, o) => SUITE.presentFlagOffStays(m, o)],
)
for (const [name, overrides, suite] of MUTANTS) await check(`MUTANT is caught: ${name}`, async () => {
  for (const [rel, text] of Object.entries(overrides)) assert.notEqual(text, real(rel), `the mutation changed ${rel}`)
  let failed = false
  try { await withFakes(overrides, m => suite(m, overrides)) } catch (error) { failed = true; if (process.env.PL60_DEBUG) console.log(`     caught: ${String(error?.message).split('\n')[0].slice(0, 140)}`) }
  assert.ok(failed, 'the suite did not fail')
})
const IFRAME_MUTANTS = [
  ['a new component draws a raw iframe', { 'components/pl60-new-frame.tsx': '<iframe src={url} />\n' }, 'C1'],
  ['the rail preview goes back to a raw iframe', { 'components/rail-live-preview.tsx': real('components/rail-live-preview.tsx').replace('<ViewTicketedIframe', '<iframe') }, 'C2'],
  ['the Present frame loses its import of the wrapper', { 'components/present-view-only-frame.tsx': real('components/present-view-only-frame.tsx').replace("from '@/components/layout-viewer-ticketed-iframe'", "from '@/components/other'") }, 'C2'],
  ['a component uses the wrapper without being on the list', { 'components/pl60-new-frame.tsx': '<ViewTicketedIframe src={url} />\n' }, 'C3'],
  ['the id pattern drifts from the route\'s', { [LIB]: real(LIB).replace('{0,254}$/', '{0,200}$/') }, 'C5'],
  ['the wrapper takes the deck id without the approved-origin policy', { [WRAP]: real(WRAP).replace('approvedPresentationIdFromViewerUrl(src, LAYOUT_VIEWER_URL_POLICY)', 'presentationIdFromViewerUrl(src)') }, 'C6'],
]
for (const [name, overrides, tag] of IFRAME_MUTANTS) await check(`MUTANT is caught by ${tag}: ${name}`, () => {
  for (const [rel, text] of Object.entries(overrides)) if (fs.existsSync(path.join(repoRoot, rel))) assert.notEqual(text, real(rel), `the mutation changed ${rel}`)
  assert.ok(iframeFailures(overrides).some(x => x.startsWith(tag)), `${tag} did not fail`)
})
console.log(`\nFRAMES: ticketed (view): ${TICKETED.join(', ')}; the editing frame (edit, PL-46): components/presentation-viewer.tsx; NOT ticketed, on purpose: ${Object.entries(EXCLUDED).filter(([k]) => k !== WRAP && k !== 'components/presentation-viewer.tsx').map(([k, v]) => `${k} (${v})`).join('; ')}`)
console.log(`PASS: ${checks} checks passed, 0 failed (${MUTANTS.length + IFRAME_MUTANTS.length} mutants caught)`)
