// PL-62 (ARCH-PLATFORM card 15:27Z, from REVIEW-CX's finding on #654): with NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED on, the editing frame's `src` carries `?t=<ticket>`, and its load handler (handleIframeLoad in
// components/presentation-viewer.tsx) compared that real src to the approved URL with `===`: a successful mint made every load "not ready" and the waiting overlay stuck. The cure: the compare ignores ONLY the t
// parameter (same origin, path, hash and the other query parameters), behind the same flag; flag off, exactly `===`. What readiness and the native frame's source compare afterwards is the APPROVED url.
//   node scripts/test-studio-pl62-ticket-ready.mjs      (plain node, offline: the REAL helper transpiled and run; the REAL handleIframeLoad, the two report functions, captureStudioNativeSlideFrame and handleComposeCaptureSelectionContext cut out of the component by brace matching and run against spies.)
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
/** One arrow function (`const NAME = (...) => {...}`) cut out of the component by brace matching, with its free identifiers supplied as parameters. */
function cutConst(text, name) {
  const start = text.indexOf(`    const ${name} = `)
  assert.ok(start >= 0, `${name} is in the component`)
  const open = text.indexOf('=> {', start) + 3
  let depth = 0, i = open
  for (; i < text.length; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break }
  return text.slice(start, i + 1)
}
function buildReporter(overrides, name, scope, letVars) {
  const lib = loadLib(overrides), toasts = []
  const js = ts.transpileModule(cutConst(overrides[VIEWER] ?? real(VIEWER), name), { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText
  const names = [...Object.keys(scope), 'viewerSrcMatchesApproved', 'toast']
  const fn = new Function(...names, `${letVars}; ${js}; return ${name}`)(...Object.values(scope), lib.viewerSrcMatchesApproved, t => toasts.push(t))
  return { fn, toasts }
}
/** A `const NAME = useCallback(...)` of the component, cut out by brace matching and run with its free identifiers supplied (the same way as handleIframeLoad). */
function cutCallback(text, name) {
  const start = text.indexOf(`  const ${name} = useCallback(`)
  assert.ok(start >= 0, `${name} is in the component`)
  const open = text.indexOf('=> {', start) + 3
  let depth = 0, i = open
  for (; i < text.length; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break }
  return text.slice(start, text.indexOf(')', i) + 1)
}
function buildCallback(overrides, name, scope) {
  const lib = loadLib(overrides)
  const js = ts.transpileModule(cutCallback(overrides[VIEWER] ?? real(VIEWER), name), { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText
  const base = { useCallback: f => f, viewerSrcMatchesApproved: lib.viewerSrcMatchesApproved, ...scope }
  const proxy = new Proxy(base, { has: (target, key) => typeof key === 'string' && (key in target || !(key in globalThis)), get: (target, key) => (key === Symbol.unscopables ? undefined : target[key]) })
  return new Function('scope', `with (scope) { ${js}; return ${name} }`)(proxy)
}
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
    for (const [a, b] of [[undefined, APPROVED], [null, APPROVED], [ticketed(), null], [ticketed(), undefined], [undefined, null], ['', APPROVED]]) assert.ok(!f(a, b), `no URL on either side never matches: ${String(a)} / ${String(b)}`)
    assert.ok(f(null, null) && f(undefined, undefined), 'the same missing value is ===, as before')
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
  /** reportUnconfirmed and reportRetiredAdd compare the frame's REAL src to the owner's source (the approved URL): with ticketing on a ticketed src is the same frame, so the "Check slide result" toast still shows. */
  reporters(overrides) {
    const request = {}, SOURCE = APPROVED
    const cases = (flag) => {
      env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = flag
      const mk = (src, own = {}) => {
        const unconfirmed = buildReporter(overrides, 'reportUnconfirmed', { operation: 'insert', studioNativeMutationIntentRef: { current: request }, request, frame: { isLogicalCurrent: () => true }, iframeRef: { current: src === undefined ? null : { src } }, owner: { source: SOURCE }, ...own }, 'let reported = false')
        const retired = buildReporter(overrides, 'reportRetiredAdd', { studioShell: true, addDispatched: true, studioNativeMutationIntentRef: { current: request }, request, capturedFrame: { isLogicalCurrent: () => true }, iframeRef: { current: src === undefined ? null : { src } }, expectedOwner: { source: SOURCE }, ...own }, 'let reportedRetirement = false')
        return { unconfirmed, retired }
      }
      return mk
    }
    const run = (flag, src) => { const m = cases(flag)(src); m.unconfirmed.fn(); m.unconfirmed.fn(); m.retired.fn(); m.retired.fn(); return [m.unconfirmed.toasts.length, m.retired.toasts.length] }
    assert.deepEqual(run('true', ticketed()), [1, 1], 'flag on: a ticketed src is the same frame: each report fires ONCE (the second call is a no-op)')
    assert.deepEqual(run('true', APPROVED), [1, 1], 'flag on: the plain src too')
    assert.deepEqual(run('true', 'https://layout.test/p/deck-2?studio_build_snapshot=4&t=tk1#/0'), [0, 0], 'flag on: another deck: no report')
    assert.deepEqual(run('true', 'https://evil.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0'), [0, 0], 'flag on: another origin: no report')
    assert.deepEqual(run('true', 'https://layout.test/p/deck-1?studio_build_snapshot=5&t=tk1#/0'), [0, 0], 'flag on: another snapshot: no report')
    assert.deepEqual(run('true', undefined), [0, 0], 'flag on: no frame: no report')
    assert.deepEqual(run(undefined, ticketed()), [0, 0], 'flag off: a ticketed src is not the owner frame (as before): no report')
    assert.deepEqual(run(undefined, APPROVED), [1, 1], 'flag off: the plain src reports, as before')
    const other = cases('true')(ticketed(), { request: {}, studioNativeMutationIntentRef: { current: {} } }); other.unconfirmed.fn(); assert.equal(other.unconfirmed.toasts.length, 0, 'another request: no report')
    const t = cases('true')(ticketed()).unconfirmed; t.fn(); assert.deepEqual(t.toasts, [{ title: 'Check slide result', description: 'The insert result could not be confirmed. Check the slide list before trying again.', variant: 'destructive' }], 'the toast is the one it was')
  },
  /** REVIEW-CX on #655: the native-slide frame capture and the compose selection context compared the frame's RAW src (ticketed) with the owner's and the loaded frame's APPROVED source, so a ready ticketed frame could not be captured
   *  (Add, Delete, the element-generation lease, compose selection all refuse). They compare through the helper now; the raw src is still held equal to ITSELF over time (a re-navigated frame retires the capture). */
  captures(overrides) {
    const OTHER_DECK = 'https://layout.test/p/deck-2?studio_build_snapshot=4&t=tk1#/0', OTHER_ORIGIN = 'https://evil.test/p/deck-1?studio_build_snapshot=4&t=tk1#/0'
    const mk = (src, { ownerSource = APPROVED, loadedSource = APPROVED } = {}) => {
      const node = { src, contentWindow: { w: 1 } }
      const owner = { source: ownerSource, presentationId: 'deck-1', userId: 'u1', sessionId: 's1', deckOwnerSessionId: 's1', activeVersion: 'final' }
      const loaded = { iframe: node, source: loadedSource, nativeWindow: node.contentWindow, revision: 2 }
      const scope = {
        studioShell: true, renderSlideMutationOwner: owner, iframeRef: { current: node }, slideMutationMountRef: { current: { active: true, generation: 3 } }, slideMutationOwnerRef: { current: owner },
        studioComposeLoadedFrameRef: { current: loaded }, studioComposeLoadRevisionRef: { current: 2 }, studioComposeDeckOwnerRef: { current: { token: {} } },
        studioFormatModeRef: { current: { enabled: false, revision: 1 } }, viewerInteractionIntentRef: { current: 1 }, thumbnailNativeRevisionRef: { current: 1 }, studioComposeContinuationRef: { current: null },
        getStudioIntroductionSafety: () => ({ ready: true, dirty: false, busy: false, error: null }), studioSaveRequestRef: { current: null }, introSafetyRef: { current: { presentationUrl: APPROVED } },
      }
      return { node, native: buildCallback(overrides, 'captureStudioNativeSlideFrame', scope)(), compose: buildCallback(overrides, 'handleComposeCaptureSelectionContext', scope)() }
    }
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
    let m = mk(ticketed())
    assert.ok(m.native, 'flag on: a ticketed src is a capturable native frame (this was null before the cure)'); assert.equal(m.native.iframe, m.node); assert.ok(m.native.isCurrent() && m.native.isLogicalCurrent(), 'and it stays current')
    assert.ok(m.compose, 'flag on: a ticketed src gives a compose selection context'); assert.ok(m.compose.isCurrent(), 'and it is current')
    m = mk(ticketed()); const c = m.native; m.node.src = ticketed(APPROVED, 'tk2')
    assert.equal(c.isCurrent(), false, 'the raw src is still held equal to ITSELF over time: a re-navigated frame retires the capture'); assert.equal(c.isCurrent(), false, 'and it stays retired')
    m = mk(ticketed()); const cc = m.compose; m.node.src = ticketed(APPROVED, 'tk2'); assert.equal(cc.isCurrent(), false, 'the compose context retires the same way')
    for (const bad of [OTHER_DECK, OTHER_ORIGIN, 'https://layout.test/p/deck-1?studio_build_snapshot=9&t=tk1#/0', 'about:blank']) { m = mk(bad); assert.equal(m.native, null, `${bad}: no native capture`); assert.equal(m.compose, null, `${bad}: no compose context`) }
    m = mk(ticketed(), { loadedSource: 'https://layout.test/p/deck-2?studio_build_snapshot=4#/0' }); assert.equal(m.native, null, 'a loaded frame of another deck: no native capture'); assert.equal(m.compose, null, 'and no compose context')
    m = mk(ticketed(), { ownerSource: 'https://layout.test/p/deck-2?studio_build_snapshot=4#/0' }); assert.equal(m.native, null, 'an owner of another deck: no native capture'); assert.equal(m.compose, null, 'and no compose context')
    m = mk(APPROVED); assert.ok(m.native && m.compose, 'flag on: the plain src is capturable too')
    env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = undefined
    m = mk(ticketed()); assert.equal(m.native, null, 'flag off: a ticketed src is not the owner frame (as before)'); assert.equal(m.compose, null)
    m = mk(APPROVED); assert.ok(m.native && m.native.isCurrent() && m.compose && m.compose.isCurrent(), 'flag off: the plain src captures as before')
  },
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
await check('REPORT the two "Check slide result" reports (reportUnconfirmed, reportRetiredAdd), cut out of the component and run: a ticketed src is the owner frame with the flag on (once each); another deck/origin/snapshot or no frame is not; flag off exactly as before', () => SUITE.reporters({}))
await check('CAPTURE the real captureStudioNativeSlideFrame and handleComposeCaptureSelectionContext (REVIEW-CX P2 on #655): a ticketed src with the flag on is capturable and current; another deck/origin/snapshot, a loaded frame or an owner of another deck is not; a re-navigated frame retires; flag off exactly as before', () => SUITE.captures({}))
await check('SOURCE the component loads its helper from the ticket library, compares with it in the load handler and has no strict compare of the loaded src left there', () => {
  const v = real(VIEWER)
  assert.match(v, /import \{ viewerSrcMatchesApproved \} from '@\/lib\/studio-layout-viewer-ticket' \/\/ LAYOUT-TICKET-READY/)
  const handler = cutHandleIframeLoad(v)
  assert.match(handler, /!viewerSrcMatchesApproved\(loadedUrl, approvedIframeNavigationUrl\)/); assert.doesNotMatch(handler, /loadedUrl !== approvedIframeNavigationUrl/)
  assert.match(handler, /debugLog\('✅ Iframe loaded and ready'\)\n    loadedUrl = approvedIframeNavigationUrl \/\/ LAYOUT-TICKET-READY/)
  assert.equal((v.match(/LAYOUT-TICKET-READY/g) ?? []).length, 11, 'exactly the eleven marked lines (six at the load and report seams, five at the two capture seams)')
  const nativeCapture = cutCallback(v, 'captureStudioNativeSlideFrame'), composeCapture = cutCallback(v, 'handleComposeCaptureSelectionContext')
  assert.equal((nativeCapture.match(/viewerSrcMatchesApproved\(source, /g) ?? []).length, 3); assert.equal((composeCapture.match(/viewerSrcMatchesApproved\(source, /g) ?? []).length, 2)
  assert.doesNotMatch(nativeCapture, /loaded\.source === source|source === owner\.source|owner\.source === source/, 'no strict compare of the raw src with an owner or loaded source in the native capture'); assert.doesNotMatch(composeCapture, /loadedFrame\.source !== source|source !== owner\.source/, 'nor in the compose capture')
  assert.match(nativeCapture, /iframe\.src === source && iframe\.contentWindow === nativeWindow/, 'the raw src is still compared with ITSELF over time'); assert.match(composeCapture, /iframe\.src !== source \|\| iframe\.contentWindow !== nativeWindow/)
  assert.match(cutConst(v, 'reportUnconfirmed'), /\|\| !viewerSrcMatchesApproved\(iframeRef\.current\?\.src, owner\.source\)\) return/); assert.match(cutConst(v, 'reportRetiredAdd'), /\|\| !viewerSrcMatchesApproved\(iframeRef\.current\?\.src, expectedOwner\.source\)\) return/)
  assert.doesNotMatch(v, /iframeRef\.current\?\.src !== (owner|expectedOwner)\.source/, 'no strict compare of the frame src to an owner source is left')
})

await check('STRIP the registered strip takes the two inserted lines out and puts the nine rewritten lines back (the viewer is its base again); other files are untouched', async () => {
  const strip = await import('./studio-pl62-ticket-ready-strip.mjs')
  const out = strip.stripPl62TicketReady(VIEWER, real(VIEWER))
  assert.ok(!strip.PL62_MARKER_RE.test(out), 'no marker left'); assert.ok(out.includes('    const loadedUrl = event.currentTarget.src\n    if (!approvedIframeNavigationUrl || loadedUrl !== approvedIframeNavigationUrl) {\n'))
  assert.equal(strip.PL62_REPLACED_LINES.length, 9); for (const [now, before] of strip.PL62_REPLACED_LINES) { assert.ok(real(VIEWER).includes(now + '\n'), `the viewer carries: ${now.trim().slice(0, 70)}`); assert.ok(out.includes(before + '\n'), `the strip puts back: ${before.trim().slice(0, 70)}`) }
  assert.equal(real(VIEWER).split('\n').length - out.split('\n').length, strip.PL62_INSERTED_LINES.length); assert.equal(strip.stripPl62TicketReady('lib/x.ts', 'abc'), 'abc')
})

await check('TAUGHT each of the eight older proofs this change teaches carries its one marked line (registry read (PL-62)) and is registered in the scope; the registry names the scope files and the strip', async () => {
  const strip = await import('./studio-pl62-ticket-ready-strip.mjs'), registry = await import('./studio-later-changes.mjs')
  assert.equal(strip.PL62_TAUGHT_FILES.size, 8)
  for (const rel of strip.PL62_TAUGHT_FILES) { assert.ok(strip.PL62_SCOPE_FILES.has(rel), `${rel}: in the scope`); assert.ok(/registry read \(PL-62\)|registry read \(DECK-SAVE-REFUSED-NOTICE, PL-62\)/.test(real(rel)), `${rel}: names the marker`) }
  for (const rel of strip.PL62_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `registered: ${rel}`)
  assert.ok(registry.LATER_STRIPS.includes(strip.stripPl62TicketReady), 'the strip is registered'); { const strips = registry.LATER_STRIPS, at = strips.indexOf(strip.stripPl62TicketReady); assert.equal(strips[at - 1], (await import('./studio-dual-lookup-strip.mjs')).stripDualLookup, 'directly after the dual lookup strip (the changes stacked later follow it)') }
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
  ['the helper does not read the flag', rep(LIB, '  if (!loadedUrl || !approvedUrl || !isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', '  if (!loadedUrl || !approvedUrl) return false\n  try {\n    const loaded'), (ov) => SUITE.helperOff(loadLib(ov))],
  ['the helper reads the flag loosely', rep(LIB, '  if (!loadedUrl || !approvedUrl || !isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', "  if (!loadedUrl || !approvedUrl || !process.env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED) return false\n  try {\n    const loaded"), (ov) => SUITE.helperOff(loadLib(ov))],
  ['the load handler is back to the strict compare', rep(VIEWER, '!viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)', 'loadedUrl !== approvedIframeNavigationUrl'), (ov) => SUITE.handlerPlain(ov)],
  ['the load handler stores the ticketed src', rep(VIEWER, '    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame\'s source compare is the approved URL, not the ticketed src\n', ''), (ov) => SUITE.handlerPlain(ov)],
  ['the native frame source is the ticketed src', rep(VIEWER, '    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame\'s source compare is the approved URL, not the ticketed src\n', ''), (ov) => SUITE.handlerShell(ov)],
  ['reportUnconfirmed is back to the strict compare', rep(VIEWER, "|| !viewerSrcMatchesApproved(iframeRef.current?.src, owner.source)) return // LAYOUT-TICKET-READY (PL-62): the frame's src carries ?t=<ticket> when ticketing is on", '|| iframeRef.current?.src !== owner.source) return'), (ov) => SUITE.reporters(ov)],
  ['reportRetiredAdd is back to the strict compare', rep(VIEWER, "|| !viewerSrcMatchesApproved(iframeRef.current?.src, expectedOwner.source)) return // LAYOUT-TICKET-READY (PL-62): the frame's src carries ?t=<ticket> when ticketing is on", '|| iframeRef.current?.src !== expectedOwner.source) return'), (ov) => SUITE.reporters(ov)],
  ['reportUnconfirmed reports for any frame', rep(VIEWER, "|| !viewerSrcMatchesApproved(iframeRef.current?.src, owner.source)) return // LAYOUT-TICKET-READY (PL-62): the frame's src carries ?t=<ticket> when ticketing is on", ') return'), (ov) => SUITE.reporters(ov)],
  ['the helper treats a missing src as a match', rep(LIB, '  if (!loadedUrl || !approvedUrl || !isStudioLayoutTicketEnabled()) return false\n', '  if (!approvedUrl) return true\n  if (!isStudioLayoutTicketEnabled()) return false\n'), (ov) => SUITE.helperOn(loadLib(ov))],
  ['the load handler accepts any src', rep(VIEWER, '!viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)', 'false'), (ov) => SUITE.handlerPlain(ov)],
  ['the load handler ignores the flag-off identity (always tolerant)', rep(LIB, '  if (!loadedUrl || !approvedUrl || !isStudioLayoutTicketEnabled()) return false\n  try {\n    const loaded', '  if (!loadedUrl || !approvedUrl) return false\n  try {\n    const loaded'), (ov) => SUITE.handlerFlagOff(ov)],
  ['the native capture is back to the strict compare with the owner (isLogicalCurrent)', rep(VIEWER, 'viewerSrcMatchesApproved(source, slideMutationOwnerRef.current.source)', 'slideMutationOwnerRef.current.source === source'), (ov) => SUITE.captures(ov)],
  ['the native capture is back to the strict compare with the loaded frame', rep(VIEWER, 'viewerSrcMatchesApproved(source, loaded.source)', 'loaded.source === source'), (ov) => SUITE.captures(ov)],
  ['the native capture is back to the strict compare with the owner (isCurrent)', rep(VIEWER, '&& studioComposeLoadedFrameRef.current === loaded && viewerSrcMatchesApproved(source, owner.source)', '&& studioComposeLoadedFrameRef.current === loaded && source === owner.source'), (ov) => SUITE.captures(ov)],
  ['the compose context is back to the strict compare with the loaded frame', rep(VIEWER, '!viewerSrcMatchesApproved(source, loadedFrame.source)', 'loadedFrame.source !== source'), (ov) => SUITE.captures(ov)],
  ['the compose context is back to the strict compare with the owner', rep(VIEWER, '|| !viewerSrcMatchesApproved(source, owner.source) // LAYOUT-TICKET-READY (PL-62)', '|| source !== owner.source'), (ov) => SUITE.captures(ov)],
  ['the native capture no longer holds the raw src equal to itself over time', rep(VIEWER, 'iframeRef.current === iframe && iframe.src === source && iframe.contentWindow === nativeWindow\n        && Boolean(nativeWindow && loaded', 'iframeRef.current === iframe && iframe.contentWindow === nativeWindow\n        && Boolean(nativeWindow && loaded'), (ov) => SUITE.captures(ov)],
  ['the native capture takes any loaded frame of another deck', rep(VIEWER, 'viewerSrcMatchesApproved(source, loaded.source)', 'true'), (ov) => SUITE.captures(ov)],
  ['the compose context takes any owner of another deck', rep(VIEWER, '|| !viewerSrcMatchesApproved(source, owner.source) // LAYOUT-TICKET-READY (PL-62)', '|| false'), (ov) => SUITE.captures(ov)],
]
for (const [name, overrides, suite] of MUTANTS) await check(`MUTANT is caught: ${name}`, async () => {
  let failed = false
  try { await suite(overrides) } catch (error) { failed = true; if (process.env.PL62_DEBUG) console.log(`     caught: ${String(error?.message).split('\n')[0].slice(0, 140)}`) }
  assert.ok(failed, 'the suite did not fail')
})
console.log(`PASS: ${checks} checks passed, 0 failed (${MUTANTS.length} mutants caught)`)
