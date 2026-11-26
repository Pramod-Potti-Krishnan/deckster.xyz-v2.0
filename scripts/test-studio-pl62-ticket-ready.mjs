// PL-62 (ARCH-PLATFORM card 15:27Z, from REVIEW-CX's finding on #654): with NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED on, the editing frame's `src` carries `?t=<ticket>`, and its load handler (handleIframeLoad in
// components/presentation-viewer.tsx) compared that real src to the approved URL with `===`: a successful mint made every load "not ready" and the waiting overlay stuck. The cure: the compare ignores ONLY the t
// parameter (same origin, path, hash and the other query parameters), behind the same flag; flag off, exactly `===`. What readiness and the native frame's source compare afterwards is the APPROVED url.
//   node scripts/test-studio-pl62-ticket-ready.mjs      (plain node, offline: the REAL helper transpiled and run; the REAL handleIframeLoad cut out of the component by brace matching and run against spies.)
// Mutants change the sources in memory only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const ts = nodeRequire('typescript')
const LIB = 'lib/studio-layout-viewer-ticket.ts', VIEWER = 'components/presentation-viewer.tsx'
const real = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
let checks = 0
const check = (name, fn) => { checks++; const r = fn(); if (r && typeof r.then === 'function') return r.then(() => console.log(`PASS ${name}`)); console.log(`PASS ${name}`) }

const env = {}
function loadLib(overrides = {}) {
  const cache = new Map()
  const get = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }; cache.set(rel, module)
    const code = ts.transpileModule(rel in overrides ? overrides[rel] : real(rel), { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    new Function('module', 'exports', 'require', 'process', code)(module, module.exports, spec => (spec.startsWith('@/') ? get(`${spec.slice(2)}.ts`) : nodeRequire(spec)), { env })
    return module.exports
  }
  return get(LIB)
}

/** The component's handleIframeLoad, cut out of the source (brace matching) and run with its free identifiers supplied. */
function cutHandleIframeLoad(text) {
  const start = text.indexOf('  const handleIframeLoad = useCallback(')
  assert.ok(start >= 0, 'handleIframeLoad is in the component')
  const open = text.indexOf('=> {', start) + 3
  let depth = 0, i = open
  for (; i < text.length; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break }
  const end = text.indexOf(')', i) + 1
  return text.slice(start, end)
}
function buildHandler(overrides, scopeExtra) {
  const lib = loadLib(overrides)
  const js = ts.transpileModule(cutHandleIframeLoad(overrides[VIEWER] ?? real(VIEWER)), { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText
  const calls = { ready: [], loaded: [], polling: [], other: [] }
  const base = {
    useCallback: f => f, debugLog: () => {}, viewerSrcMatchesApproved: lib.viewerSrcMatchesApproved,
    setIframeReady: v => calls.ready.push(v), setLoadedApprovedNavigationUrl: v => calls.loaded.push(v), setPollingFailureCount: v => calls.polling.push(v), lastSlideInfoRef: { current: 'x' },
    approvedIframeNavigationUrl: APPROVED, studioShell: false, ...scopeExtra,
  }
  const scope = new Proxy(base, { has: (t, k) => typeof k === 'string' && (k in t || !(k in globalThis)), get: (t, k) => (k === Symbol.unscopables ? undefined : t[k]) })
  const handler = new Function('scope', `with (scope) { ${js}; return handleIframeLoad }`)(scope)
  return { handler, calls, base }
}
const APPROVED = 'https://layout.test/p/deck-1?studio_build_snapshot=4#/0'
const ticketed = (url = APPROVED, t = 'tk1') => { const u = new URL(url); u.searchParams.set('t', t); return u.toString() }
const fire = (h, src) => h.handler({ currentTarget: { src, contentWindow: {} } })

const SUITE = {
  /** the pure compare, flag on: the ticket is ignored, nothing else. */
  helperOn(lib) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    const f = lib.viewerSrcMatchesApproved
    for (const loaded of [APPROVED, ticketed(), ticketed(APPROVED, 'a.b-c_d'), 'https://layout.test/p/deck-1?t=tk1&studio_build_snapshot=4#/0', 'https://layout.test/p/deck-1?studio_build_snapshot=4&t=tk1&t=tk2#/0']) assert.ok(f(loaded, APPROVED), `counts: ${loaded}`)
    const two = 'https://layout.test/p/deck-1?viewOnly=true&studio_build_snapshot=4#/0'
    assert.ok(f('https://layout.test/p/deck-1?studio_build_snapshot=4&viewOnly=true&t=tk1#/0', two), 'the other keys in another order still count')
    for (const loaded of ['https://layout.test/p/deck-2?studio_build_snapshot=4&t=tk1#/0', 'https://evil.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0', 'https://layout.test.evil.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0', 'http://layout.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0',
      'https://layout.test:8443/p/deck-1?studio_build_snapshot=4&t=tk1#/0', 'https://layout.test/p/deck-1/?studio_build_snapshot=4&t=tk1#/0', 'https://layout.test/p/deck-1?studio_build_snapshot=5&t=tk1#/0', 'https://layout.test/p/deck-1?t=tk1#/0',
      'https://layout.test/p/deck-1?studio_build_snapshot=4&extra=1&t=tk1#/0', 'https://layout.test/p/deck-1?studio_build_snapshot=4&t=tk1#/1', 'https://layout.test/p/deck-1?studio_build_snapshot=4&t=tk1', 'about:blank', '', 'not a url']) assert.ok(!f(loaded, APPROVED), `does not count: ${loaded}`)
    assert.ok(!f(ticketed(), 'not a url'), 'an unparseable approved url never matches a different string'); assert.ok(f('not a url', 'not a url'), 'the same string is the same string')
  },
  /** flag off (or anything but the exact string "true"): exactly `===`. */
  helperOff(lib) {
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true']) {
      env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = flag
      assert.equal(lib.viewerSrcMatchesApproved(APPROVED, APPROVED), true); assert.equal(lib.viewerSrcMatchesApproved(ticketed(), APPROVED), false, `flag ${JSON.stringify(flag)}: a ticketed src does not count`); assert.equal(lib.viewerSrcMatchesApproved('about:blank', APPROVED), false)
    }
  },
  /** the real load handler, not the studio shell: ready only for a src that matches; what is stored is the approved URL. */
  handlerPlain(overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    let h = buildHandler(overrides); fire(h, ticketed())
    assert.deepEqual(h.calls.ready, [true], 'a ticketed src is READY'); assert.deepEqual(h.calls.loaded, [APPROVED], 'the stored loaded URL is the approved one (what readiness compares)'); assert.deepEqual(h.calls.polling, [0])
    for (const bad of ['https://layout.test/p/deck-2?studio_build_snapshot=4&t=tk1#/0', 'https://evil.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0', 'https://layout.test/p/deck-1?studio_build_snapshot=9&t=tk1#/0', 'about:blank']) {
      h = buildHandler(overrides); fire(h, bad); assert.deepEqual(h.calls.ready, [false], `${bad}: not ready`); assert.deepEqual(h.calls.loaded, [null], `${bad}: nothing stored as loaded`) }
    h = buildHandler(overrides); fire(h, APPROVED); assert.deepEqual(h.calls.ready, [true]); assert.deepEqual(h.calls.loaded, [APPROVED], 'the plain approved src is ready too')
    h = buildHandler(overrides, { approvedIframeNavigationUrl: null }); fire(h, APPROVED); assert.deepEqual(h.calls.ready, [false], 'no approved URL: never ready')
  },
  handlerFlagOff(overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined
    let h = buildHandler(overrides); fire(h, ticketed()); assert.deepEqual(h.calls.ready, [false], 'flag off: a ticketed src is NOT ready (byte-identical to before)'); assert.deepEqual(h.calls.loaded, [null])
    h = buildHandler(overrides); fire(h, APPROVED); assert.deepEqual(h.calls.ready, [true]); assert.deepEqual(h.calls.loaded, [APPROVED])
  },
  /** studio shell: the native frame's source (compared later with the owner's source, which is the approved URL) is the approved URL, even for a ticketed src. */
  handlerShell(overrides) {
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    const noop = () => {}
    const iframeNode = { src: ticketed(), contentWindow: { w: 1 } }
    const spies = { toasts: 0 }
    const extra = {
      studioShell: true, iframeRef: { current: iframeNode }, studioComposeLoadedFrameRef: { current: null }, studioNativeMutationPublicationRef: { current: 'x' }, slideMutationRequestRef: { current: { reportUnconfirmed: () => { spies.toasts++ } } },
      slideMutationPendingRef: { current: true }, studioDeleteDialogRef: { current: 'x' }, studioManualSlideNavigationRef: { current: 'x' }, studioSaveRequestRef: { current: 'x' }, studioComposeLoadRevisionRef: { current: 4 },
      slideMutationOwnerRef: { current: { generation: 7, source: APPROVED } }, STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED: false, studioSlideDeleteRefresh: { frameLoaded: noop }, CHAT_STALE_VIEWER_GUARD_ENABLED: false,
      setIsSaving: noop, setSaveStatus: noop, setIsSlideMutationPending: noop, setIsDeleting: noop, setShowDeleteDialog: noop, setSlidesToDelete: noop, setNativeSnapshotSafetyRevision: noop,
    }
    const h = buildHandler(overrides, extra); h.handler({ currentTarget: iframeNode })
    assert.deepEqual(h.calls.ready, [true]); assert.deepEqual(h.calls.loaded, [APPROVED]); assert.equal(extra.studioComposeLoadedFrameRef.current?.source, APPROVED, "the native frame's source is the approved URL"); assert.equal(extra.studioComposeLoadedFrameRef.current?.iframe, iframeNode)
    assert.equal(extra.studioComposeLoadRevisionRef.current, 5, 'a fresh native frame lifetime, as before'); assert.equal(extra.slideMutationOwnerRef.current.generation, 8); assert.equal(spies.toasts, 1, 'the retired request is reported once, as before')
  },
}

const libReal = loadLib()
await check('HELPER flag on: a ticketed src counts as the approved URL (any ticket, any position); a different path, origin, scheme, port, other query value, extra or missing key, hash or garbage does not', () => SUITE.helperOn(libReal))
await check('HELPER flag off (anything but the exact "true"): exactly ===; a ticketed src never counts', () => SUITE.helperOff(libReal))
await check('LOAD the real handleIframeLoad, flag on: a ticketed src is READY and stores the APPROVED url; another path/origin/snapshot/blank is not ready and stores null; no approved URL is never ready', () => SUITE.handlerPlain({}))
await check('LOAD the real handleIframeLoad, flag off: a ticketed src is NOT ready (as before); the plain src is', () => SUITE.handlerFlagOff({}))
await check('LOAD the studio shell: the native frame source is the approved URL for a ticketed src; a fresh frame lifetime and the retired-request report happen as before', () => SUITE.handlerShell({}))
await check('SOURCE the component loads its helper from the ticket library, compares with it in the load handler and has no strict compare of the loaded src left there', () => {
  const v = real(VIEWER)
  assert.match(v, /import \{ viewerSrcMatchesApproved \} from '@\/lib\/studio-layout-viewer-ticket' \/\/ LAYOUT-TICKET-READY/)
  const handler = cutHandleIframeLoad(v)
  assert.match(handler, /!viewerSrcMatchesApproved\(loadedUrl, approvedIframeNavigationUrl\)/); assert.doesNotMatch(handler, /loadedUrl !== approvedIframeNavigationUrl/)
  assert.match(handler, /debugLog\('✅ Iframe loaded and ready'\)\n    loadedUrl = approvedIframeNavigationUrl \/\/ LAYOUT-TICKET-READY/)
  assert.equal((v.match(/LAYOUT-TICKET-READY/g) ?? []).length, 4, 'exactly the four marked lines')
})

await check('STRIP the registered strip takes the four marked lines out and puts the two rewritten lines back (the viewer is its base again); other files are untouched', async () => {
  const strip = await import('./studio-pl62-ticket-ready-strip.mjs')
  const out = strip.stripPl62TicketReady(VIEWER, real(VIEWER))
  assert.ok(!strip.PL62_MARKER_RE.test(out), 'no marker left'); assert.ok(out.includes('    const loadedUrl = event.currentTarget.src\n    if (!approvedIframeNavigationUrl || loadedUrl !== approvedIframeNavigationUrl) {\n'))
  assert.equal(real(VIEWER).split('\n').length - out.split('\n').length, strip.PL62_INSERTED_LINES.length); assert.equal(strip.stripPl62TicketReady('lib/x.ts', 'abc'), 'abc')
})

await check('TAUGHT each of the eight older proofs this change teaches carries its one marked line (registry read (PL-62)) and is registered in the scope; the registry names the scope files and the strip', async () => {
  const strip = await import('./studio-pl62-ticket-ready-strip.mjs'), registry = await import('./studio-later-changes.mjs')
  assert.equal(strip.PL62_TAUGHT_FILES.size, 8)
  for (const rel of strip.PL62_TAUGHT_FILES) { assert.ok(strip.PL62_SCOPE_FILES.has(rel), `${rel}: in the scope`); assert.ok(/registry read \(PL-62\)|registry read \(DECK-SAVE-REFUSED-NOTICE, PL-62\)/.test(real(rel)), `${rel}: names the marker`) }
  for (const rel of strip.PL62_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `registered: ${rel}`)
  assert.ok(registry.LATER_STRIPS.includes(strip.stripPl62TicketReady), 'the strip is registered'); assert.equal(registry.LATER_STRIPS.at(-1), strip.stripPl62TicketReady, 'and last (the newest change)')
  for (const rel of strip.PL62_TAUGHT_FILES) { const out = strip.stripPl62TicketReady(rel, real(rel)); assert.ok(!/registry read \(PL-62\)|, PL-62\)/.test(out), `${rel}: the strip puts its taught line back`); assert.ok(strip.PL62_REVERSE_HUNKS[rel]?.length >= 1, `${rel}: has reverse hunks`) }
})

// ---------------------------------------------------------------------------------------------------------- mutants (the sources change in memory only)
const rep = (rel, from, to) => { const t = real(rel); assert.ok(t.includes(from), `mutation target in ${rel}: ${from.slice(0, 60)}`); return { [rel]: t.replace(from, to) } }
const MUTANTS = [
  ['the helper is strict equality only', rep(LIB, "    if (loaded.origin !== approved.origin || loaded.pathname !== approved.pathname || loaded.hash !== approved.hash) return false\n", '    return false\n'), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores the origin', rep(LIB, 'loaded.origin !== approved.origin || ', ''), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores the path', rep(LIB, 'loaded.pathname !== approved.pathname || ', ''), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores the hash', rep(LIB, ' || loaded.hash !== approved.hash', ''), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores every query parameter', rep(LIB, 'return withoutTicket(loaded) === withoutTicket(approved)', 'return true'), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores only the first t (not a second one)', rep(LIB, "filter(([key]) => key !== 't')", "filter(([key], index, all) => !(key === 't' && all.findIndex(([k]) => k === 't') === index))"), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper ignores another parameter too', rep(LIB, "filter(([key]) => key !== 't')", "filter(([key]) => key !== 't' && key !== 'studio_build_snapshot')"), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the helper does not read the flag', rep(LIB, '  if (!isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', '  try {\n    const loaded'), (ov) => SUITE.helperOff(loadLib(ov))],
  ['the helper reads the flag loosely', rep(LIB, '  if (!isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', "  if (!process.env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED) return false\n  try {\n    const loaded"), (ov) => SUITE.helperOff(loadLib(ov))],
  ['the load handler is back to the strict compare', rep(VIEWER, '!viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)', 'loadedUrl !== approvedIframeNavigationUrl'), (ov) => SUITE.handlerPlain(ov)],
  ['the load handler stores the ticketed src', rep(VIEWER, '    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame\'s source compare is the approved URL, not the ticketed src\n', ''), (ov) => SUITE.handlerPlain(ov)],
  ['the native frame source is the ticketed src', rep(VIEWER, '    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame\'s source compare is the approved URL, not the ticketed src\n', ''), (ov) => SUITE.handlerShell(ov)],
  ['the load handler accepts any src', rep(VIEWER, '!viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)', 'false'), (ov) => SUITE.handlerPlain(ov)],
  ['the load handler ignores the flag-off identity (always tolerant)', rep(LIB, '  if (!isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', '  try {\n    const loaded'), (ov) => SUITE.handlerFlagOff(ov)],
]
for (const [name, overrides, suite] of MUTANTS) await check(`MUTANT is caught: ${name}`, async () => {
  let failed = false
  try { await suite(overrides) } catch (error) { failed = true; if (process.env.PL62_DEBUG) console.log(`     caught: ${String(error?.message).split('\n')[0].slice(0, 140)}`) }
  assert.ok(failed, 'the suite did not fail')
})
console.log(`PASS: ${checks} checks passed, 0 failed (${MUTANTS.length} mutants caught)`)
