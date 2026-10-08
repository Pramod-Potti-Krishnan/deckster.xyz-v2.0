// A4: Present and audience viewer paths open the Layout viewer with `?viewOnly=true`
// only when NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED is the literal "true".
// Run: pnpm test:present-view-only   (plain node: transpile + vm, no network, no Layout call)
//
// Proves:
//   - lib/present-view-only.ts: import-free, literal flag, URL helpers, flag-off identity
//     (the very same string comes back for every input);
//   - components/present-view-only-frame.tsx, run on the REAL source under a small hook
//     runtime with fake timers: frozen src, ready/focus/frameRef, slide reporting, the
//     fail-open timeout, cleanup;
//   - the viewer URL changing mid-Present (a Director deck mutation, a slide-compose refresh):
//     the overlay is keyed by that URL and re-opens on the slide the audience is on, kept
//     inside the deck; leaving Present never asks the editing frame for a slide past the end;
//   - wiring contracts on the REAL source of every covered path, and that the editing
//     canvas and the other surfaces left alone do not gain `viewOnly`.
// No git dependency: runs in shallow clones and CI.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const compile = (text, jsx = false) => ts.transpileModule(text, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
  },
}).outputText

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try {
    await fn()
  } catch (err) {
    console.error(`FAIL: ${name}`)
    throw err
  }
}

// One shared process.env for every module instance; tests flip the flag here.
const env = {}
const sandboxProcess = { env }
function setFlag(value) {
  if (value === undefined) delete env.NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED
  else env.NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED = value
}

function load(text, { shims = {}, jsx = false, globals = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(text, jsx), {
    module,
    exports: module.exports,
    process: sandboxProcess,
    console,
    URL,
    require(id) {
      if (id in shims) return shims[id]
      throw new Error(`Unexpected dependency ${id}`)
    },
    ...globals,
  })
  return module.exports
}

const LIB = 'components/present-view-only-frame.tsx'
const libSource = read('lib/present-view-only.ts')
const lib = load(libSource)
const OFF_VALUES = [undefined, 'false', '', 'TRUE', 'True', '1', 'yes', ' true']

// Real-shaped viewer URLs (Director/Layout `.../p/<id>`, with and without a query or hash).
const BASE = 'https://layout.test/p/abc123'
const URLS = [
  BASE,
  `${BASE}?studio_build_snapshot=2`,
  `${BASE}#/3`,
  `${BASE}?theme=dark&studio_build_snapshot=1#/0`,
  'https://layout.test/prefix/p/abc123',
]

// ---- the pure helper ------------------------------------------------------------
await run('lib/present-view-only.ts is import-free and reads the literal flag name', () => {
  assert.doesNotMatch(libSource.replace(/\/\/.*$/gm, ''), /^\s*(import|export\s+.*\sfrom)\s/m)
  assert.doesNotMatch(libSource, /require\(/)
  assert.match(libSource, /process\.env\.NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED === 'true'/)
})

await run('isPresentViewOnlyEnabled: only the literal "true" turns it on', () => {
  for (const value of OFF_VALUES) {
    setFlag(value)
    assert.equal(lib.isPresentViewOnlyEnabled(), false, `value ${JSON.stringify(value)} must be off`)
  }
  setFlag('true')
  assert.equal(lib.isPresentViewOnlyEnabled(), true)
  setFlag(undefined)
})

await run('withViewOnly: adds viewOnly=true, keeps the rest, is idempotent, overrides a false', () => {
  assert.equal(lib.withViewOnly(BASE), `${BASE}?viewOnly=true`)
  assert.equal(lib.withViewOnly(`${BASE}?studio_build_snapshot=2`), `${BASE}?studio_build_snapshot=2&viewOnly=true`)
  assert.equal(lib.withViewOnly(`${BASE}#/3`), `${BASE}?viewOnly=true#/3`)
  assert.equal(lib.withViewOnly(`${BASE}?theme=dark#/0`), `${BASE}?theme=dark&viewOnly=true#/0`)
  assert.equal(lib.withViewOnly(`${BASE}?viewOnly=true`), `${BASE}?viewOnly=true`)
  assert.equal(lib.withViewOnly(`${BASE}?viewOnly=false`), `${BASE}?viewOnly=true`)
  assert.equal(lib.withViewOnly('not a url'), 'not a url')
  assert.equal(lib.withViewOnly(''), '')
})

await run('viewOnlyIfEnabled: flag off returns the same string for every input (identity)', () => {
  for (const value of OFF_VALUES) {
    setFlag(value)
    for (const url of URLS) assert.equal(lib.viewOnlyIfEnabled(url), url)
    assert.equal(lib.viewOnlyIfEnabled(''), '')
    assert.equal(lib.viewOnlyIfEnabled(null), null)
    assert.equal(lib.viewOnlyIfEnabled(undefined), undefined)
  }
  setFlag(undefined)
})

await run('viewOnlyIfEnabled: flag on adds viewOnly=true, passes null/undefined/empty through', () => {
  setFlag('true')
  for (const url of URLS) {
    const out = new URL(lib.viewOnlyIfEnabled(url))
    assert.equal(out.searchParams.get('viewOnly'), 'true')
    assert.equal(out.searchParams.getAll('viewOnly').length, 1)
    const before = new URL(url)
    assert.equal(out.origin + out.pathname, before.origin + before.pathname)
    assert.equal(out.hash, before.hash)
    for (const [key, value] of before.searchParams) assert.equal(out.searchParams.get(key), value)
  }
  assert.equal(lib.viewOnlyIfEnabled(null), null)
  assert.equal(lib.viewOnlyIfEnabled(undefined), undefined)
  assert.equal(lib.viewOnlyIfEnabled(''), '')
  setFlag(undefined)
})

await run('presentFrameUrl: viewOnly=true plus a #/N deep link, N clamped to a whole number >= 0', () => {
  assert.equal(lib.presentFrameUrl(BASE, 4), `${BASE}?viewOnly=true#/4`)
  assert.equal(lib.presentFrameUrl(`${BASE}?studio_build_snapshot=2`, 0), `${BASE}?studio_build_snapshot=2&viewOnly=true#/0`)
  assert.equal(lib.presentFrameUrl(`${BASE}#/9`, 2), `${BASE}?viewOnly=true#/2`)
  assert.equal(lib.presentFrameUrl(BASE, 2.9), `${BASE}?viewOnly=true#/2`)
  for (const bad of [-1, -0.5, NaN, Infinity, -Infinity]) {
    const url = lib.presentFrameUrl(BASE, bad)
    assert.ok(url === `${BASE}?viewOnly=true#/0`, `${bad} -> ${url}`)
  }
})

await run('presentNavigationCommand: arrow keys only', () => {
  for (const key of ['ArrowRight', 'ArrowDown']) assert.equal(lib.presentNavigationCommand(key), 'nextSlide')
  for (const key of ['ArrowLeft', 'ArrowUp']) assert.equal(lib.presentNavigationCommand(key), 'prevSlide')
  for (const key of ['e', 'E', 'g', 'b', 's', 'Escape', 'Enter', ' ', 'PageDown', 'Home', '']) {
    assert.equal(lib.presentNavigationCommand(key), null, `key ${JSON.stringify(key)}`)
  }
})

await run('clampPresentSlideIndex: whole slide inside [0, total - 1]; an unknown count only floors at 0', () => {
  assert.equal(lib.clampPresentSlideIndex(0, 9), 0)
  assert.equal(lib.clampPresentSlideIndex(4, 9), 4)
  assert.equal(lib.clampPresentSlideIndex(8, 9), 8)
  assert.equal(lib.clampPresentSlideIndex(9, 9), 8, 'one past the end is the last slide')
  assert.equal(lib.clampPresentSlideIndex(40, 9), 8)
  assert.equal(lib.clampPresentSlideIndex(40, 1), 0)
  assert.equal(lib.clampPresentSlideIndex(2.9, 9), 2)
  assert.equal(lib.clampPresentSlideIndex(7.5, 5.9), 4, 'a fractional count is floored')
  for (const bad of [-1, -0.5, -Infinity, NaN, Infinity, null, undefined]) {
    assert.equal(lib.clampPresentSlideIndex(bad, 9), 0, `index ${bad}`)
  }
  for (const unknown of [0, -3, NaN, null, undefined, Infinity]) {
    assert.equal(lib.clampPresentSlideIndex(6, unknown), 6, `count ${unknown} cannot clamp`)
    assert.equal(lib.clampPresentSlideIndex(-2, unknown), 0)
  }
})

await run('presentFrameStartIndex: the slide the audience is on, else the one Present began on, inside the deck', () => {
  assert.equal(lib.presentFrameStartIndex(6, 2, 9), 6, 'the reported slide beats where Present began')
  assert.equal(lib.presentFrameStartIndex(0, 2, 9), 0, 'slide 0 is a real report')
  assert.equal(lib.presentFrameStartIndex(null, 2, 9), 2)
  assert.equal(lib.presentFrameStartIndex(undefined, 2, 9), 2)
  assert.equal(lib.presentFrameStartIndex(NaN, 2, 9), 2)
  assert.equal(lib.presentFrameStartIndex(6, 2, 5), 4, 'the deck got shorter: the last slide')
  assert.equal(lib.presentFrameStartIndex(null, 7, 5), 4)
  assert.equal(lib.presentFrameStartIndex(6, -1, 0), 6, 'an unknown count does not move the audience')
  assert.equal(lib.presentFrameStartIndex(null, -1, 0), 0)
})

// ---- the view-only Present frame, on its real source ----------------------------
// A tiny hook runtime (useState / useRef / useEffect) and fake timers: enough to drive
// the component through load, ready, slide reports, timeout and unmount.
function createHarness() {
  const fake = { now: 0, seq: 0, timers: new Map() }
  const fakeSetTimeout = (fn, ms) => { fake.seq += 1; fake.timers.set(fake.seq, { fn, at: fake.now + ms }); return fake.seq }
  const fakeClearTimeout = id => { fake.timers.delete(id) }
  async function flush() { for (let i = 0; i < 30; i += 1) await Promise.resolve() }
  async function advance(ms) {
    const target = fake.now + ms
    for (;;) {
      const due = [...fake.timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      fake.timers.delete(due[0])
      fake.now = due[1].at
      due[1].fn()
      await flush()
    }
    fake.now = target
    await flush()
  }

  const hooks = []
  let cursor = 0
  let pendingEffects = []
  let props
  let tree
  let rendering = false
  let dirty = false
  const mounted = { value: true }

  const React = {
    useState(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = hooks[i]
      return [slot.value, next => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (Object.is(value, slot.value) || !mounted.value) return
        slot.value = value
        dirty = true
        if (!rendering) rerender()
      }]
    },
    useRef(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = { current: initial }
      return hooks[i]
    },
    useEffect(fn, deps) {
      const i = cursor++
      const previous = hooks[i]
      const changed = !previous || !deps || deps.length !== previous.deps.length
        || deps.some((d, k) => !Object.is(d, previous.deps[k]))
      if (changed) pendingEffects.push({ i, fn, deps, previous })
    },
  }

  const element = (type, p, key) => ({ type, props: p ?? {}, key })
  const jsxRuntime = { jsx: element, jsxs: element, Fragment: 'Fragment' }

  const iframeNode = { focusCalls: 0, focus() { this.focusCalls += 1 } }
  function attachRefs(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(attachRefs)
    if (node.props?.ref && node.type === 'iframe') node.props.ref.current = iframeNode
    const children = node.props?.children
    if (children) attachRefs(children)
  }

  function runEffects() {
    const effects = pendingEffects
    pendingEffects = []
    for (const { i, fn, deps, previous } of effects) {
      if (previous?.cleanup) previous.cleanup()
      const cleanup = fn()
      hooks[i] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined }
    }
  }

  function rerender() {
    do {
      dirty = false
      rendering = true
      cursor = 0
      tree = component(props)
      rendering = false
      attachRefs(tree)
      runEffects()
    } while (dirty)
  }

  const frameRef = { current: null }
  const sent = []
  const script = { respond: async () => { throw new Error('viewer still loading') } }
  const sendCommand = async (iframe, action, params, timeoutMs) => {
    sent.push({ iframe, action, params, timeoutMs, at: fake.now })
    return script.respond(action, params)
  }
  const events = { slides: [], failed: 0 }

  const module = load(read(LIB), {
    jsx: true,
    shims: {
      react: React,
      'react/jsx-runtime': jsxRuntime,
      '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
      '@/lib/slide-compose-async': load(read('lib/slide-compose-async.ts')),
      '@/lib/present-view-only': lib,
    },
    globals: { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, Date: { now: () => fake.now } },
  })
  const component = module.PresentViewOnlyFrame

  return {
    module, frameRef, sent, script, events, iframeNode, fake,
    advance, flush,
    mount(extra = {}) {
      props = {
        baseUrl: BASE,
        startIndex: 4,
        sendCommand,
        frameRef,
        onSlideIndex: index => events.slides.push(index),
        onFailed: () => { events.failed += 1 },
        ...extra,
      }
      rerender()
    },
    update(extra) { props = { ...props, ...extra }; rerender() },
    unmount() {
      for (const slot of hooks) slot?.cleanup?.()
      mounted.value = false
    },
    get tree() { return tree },
    get iframe() { return tree.props.children },
    get ready() { return /opacity-100/.test(tree.props.children.props.className) },
  }
}

const INFO = index => ({ success: true, action: 'getCurrentSlideInfo', data: { index, total: 9 } })

await run('frame: src is the view-only deep link, frozen for the session; black until ready', async () => {
  const h = createHarness()
  h.mount()
  assert.equal(h.tree.props['data-present-view-only-frame'], 'true')
  assert.equal(h.iframe.type, 'iframe')
  assert.equal(h.iframe.props.src, `${BASE}?viewOnly=true#/4`)
  assert.equal(h.ready, false)
  assert.equal(h.frameRef.current, null)
  // New props (another snapshot revision, another slide) never reload the frame.
  h.update({ baseUrl: `${BASE}?studio_build_snapshot=7`, startIndex: 8 })
  assert.equal(h.iframe.props.src, `${BASE}?viewOnly=true#/4`)
  h.unmount()
})

await run('frame: polls getCurrentSlideInfo, becomes ready and focused on the first valid answer, then reports slides', async () => {
  const h = createHarness()
  h.mount()
  await h.advance(400)
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].action, 'getCurrentSlideInfo')
  assert.equal(h.sent[0].iframe, h.iframeNode)
  assert.equal(h.ready, false, 'a failed read is not ready')
  assert.deepEqual(h.events.slides, [])
  // Layout answers with an out-of-range index: not a valid navigation read, still not ready.
  h.script.respond = async () => ({ success: true, data: { index: 9, total: 9 } })
  await h.advance(400)
  assert.equal(h.ready, false)
  h.script.respond = async () => INFO(4)
  await h.advance(400)
  assert.equal(h.ready, true)
  assert.equal(h.frameRef.current, h.iframeNode)
  assert.equal(h.iframeNode.focusCalls, 1)
  assert.deepEqual(h.events.slides, [4])
  h.script.respond = async () => INFO(6)
  await h.advance(400)
  assert.deepEqual(h.events.slides, [4, 6])
  assert.equal(h.iframeNode.focusCalls, 1, 'focus is taken once')
  assert.equal(h.events.failed, 0)
  h.unmount()
})

await run('frame: never answering fails open after 12 s, once, and stops polling', async () => {
  const h = createHarness()
  h.mount()
  await h.advance(11_000)
  assert.equal(h.events.failed, 0)
  await h.advance(2_000)
  assert.equal(h.events.failed, 1)
  const polls = h.sent.length
  assert.ok(polls >= 25 && polls <= 32, `polled ${polls} times in ~12 s`)
  await h.advance(5_000)
  assert.equal(h.sent.length, polls)
  assert.equal(h.events.failed, 1)
  assert.equal(h.frameRef.current, null)
  h.unmount()
})

await run('frame: once ready, a later failed read never fails the frame', async () => {
  const h = createHarness()
  h.mount()
  h.script.respond = async () => INFO(0)
  await h.advance(400)
  assert.equal(h.ready, true)
  h.script.respond = async () => { throw new Error('slow read') }
  await h.advance(30_000)
  assert.equal(h.events.failed, 0)
  assert.equal(h.ready, true)
  h.unmount()
})

await run('frame: unmount clears frameRef and stops polling', async () => {
  const h = createHarness()
  h.mount()
  h.script.respond = async () => INFO(2)
  await h.advance(400)
  assert.equal(h.frameRef.current, h.iframeNode)
  h.unmount()
  assert.equal(h.frameRef.current, null)
  const polls = h.sent.length
  await h.advance(10_000)
  assert.equal(h.sent.length, polls)
  assert.deepEqual(h.events.slides, [2])
})

// A URL change mid-Present re-mounts the overlay (the viewer keys it by the approved URL), so the
// new instance reads its src from the new URL. Modelled with two instances of the real component:
// the previous one is unmounted (its cleanup clears frameRef), the next one is handed the helper's
// start index, exactly as the viewer's JSX does.
await run('mid-Present URL change: the re-mounted overlay opens the new URL on the slide the audience is on', async () => {
  const first = createHarness()
  first.mount({ baseUrl: BASE, startIndex: lib.presentFrameStartIndex(null, 2, 9) })
  assert.equal(first.iframe.props.src, `${BASE}?viewOnly=true#/2`)
  first.script.respond = async () => INFO(2)
  await first.advance(400)
  first.script.respond = async () => INFO(6)
  await first.advance(400)
  assert.deepEqual(first.events.slides, [2, 6])
  const reported = first.events.slides.at(-1)
  assert.equal(first.frameRef.current, first.iframeNode)

  // A Director deck_mutation / compose completion: sc_refresh on the viewer URL. Key changes -> old instance goes.
  const refreshed = `${BASE}?sc_refresh=1`
  first.unmount()
  assert.equal(first.frameRef.current, null, 'forwarded arrow keys have no stale frame to hit while it reloads')
  const polls = first.sent.length
  const second = createHarness()
  second.mount({ baseUrl: refreshed, startIndex: lib.presentFrameStartIndex(reported, 2, 9) })
  assert.equal(second.iframe.props.src, `${BASE}?sc_refresh=1&viewOnly=true#/6`, 'new URL, still view-only, on slide 6')
  assert.equal(second.ready, false, 'black until the reloaded viewer answers')
  second.script.respond = async () => INFO(6)
  await second.advance(400)
  assert.equal(second.ready, true)
  assert.equal(second.frameRef.current, second.iframeNode)
  assert.equal(first.sent.length, polls, 'the old frame stopped polling')
  second.unmount()

  // The mutation removed slides: the new frame is opened on the new last slide, not past it.
  const shorter = createHarness()
  shorter.mount({ baseUrl: refreshed, startIndex: lib.presentFrameStartIndex(reported, 2, 5) })
  assert.equal(shorter.iframe.props.src, `${BASE}?sc_refresh=1&viewOnly=true#/4`)
  shorter.unmount()
})

// ---- wiring contracts on the real source ----------------------------------------
const viewer = read('components/presentation-viewer.tsx')
const messageList = read('components/builder/message-list.tsx')
const dashboard = read('app/(app)/dashboard/page.tsx')
const published = read('components/published-viewer.tsx')

await run('Present: view-only frame is flag-gated, covers the editing frame and leaves it alone', () => {
  // flag + Present + not failed + a viewer URL
  assert.match(viewer, /const presentViewOnlyEnabled = isPresentViewOnlyEnabled\(\)/)
  assert.match(viewer, /const presentViewOnlyActive = presentViewOnlyEnabled && isFullscreen && !presentFrameFailed && !!approvedIframeNavigationUrl/)
  // the frame renders only when active, from the editing frame's approved URL and current slide
  // keyed by that URL like the editing iframe, so it reloads when the viewer URL changes mid-Present
  assert.match(viewer, /\{presentViewOnlyActive && approvedIframeNavigationUrl && \(\s*<PresentViewOnlyFrame\s+key=\{approvedIframeNavigationUrl\}\s+baseUrl=\{approvedIframeNavigationUrl\}\s+startIndex=\{presentFrameStartIndex\(presentSlideIndexRef\.current, currentSlide - 1, presentSlideTotal\)\}/)
  assert.equal((viewer.match(/<PresentViewOnlyFrame/g) ?? []).length, 1)
  assert.match(viewer, /const presentSlideTotal = Math\.max\(visualTotalSlides \|\| 0, totalSlides \|\| 0\)/)
  // the editing iframe is exactly as before: same key, same src, no viewOnly
  assert.match(viewer, /key=\{approvedIframeNavigationUrl\}\s+ref=\{iframeRef\}\s+src=\{approvedIframeNavigationUrl \|\| undefined\}/)
  const viewerCode = viewer.replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(viewerCode, /viewOnly=|['"`]viewOnly['"`]/, 'the editing canvas never builds a viewOnly URL: the helper owns the query')
  assert.doesNotMatch(viewerCode, /view_only|VIEW_ONLY/)
  // the URL the editing iframe loads is still derived only from snapshot revision (no Present input)
  assert.match(viewer, /buildSnapshotNavigationUrl\(approvedPresentationUrl, studioShell \? buildSnapshotRevision : 0\)/)
  // only the new, flag-gated frame is mounted besides the editing iframe
  assert.equal((viewer.match(/<iframe/g) ?? []).length, 1)
})

await run('Present: keyboard, fail-open, exit sync and toolbar are gated on the active frame', () => {
  // arrow keys forwarded, everything else swallowed, before Ctrl+S / G / B / E
  const keydown = viewer.indexOf('const command = presentNavigationCommand(e.key)')
  assert.ok(keydown > 0)
  assert.ok(keydown < viewer.indexOf("// Ctrl+S / Cmd+S - Force save (in edit mode)"))
  assert.match(viewer, /if \(presentViewOnlyActiveRef\.current\) \{\s*const command = presentNavigationCommand\(e\.key\)\s*if \(command\) \{\s*e\.preventDefault\(\)\s*postCommand\(presentFrameRef\.current, command\)\s*\}\s*return\s*\}/)
  // fail-open: the frame reports failure, Present falls back to the editing frame
  assert.match(viewer, /onFailed=\{\(\) => \{[^}]*setPresentFrameFailed\(true\)/)
  // exit: the editing frame is moved to the slide the audience ended on, only if it differs
  assert.match(viewer, /const target = clampPresentSlideIndex\(endedOn, presentSlideTotal\)\s*if \(target !== currentSlide - 1\) void handleGoToSlide\(target\)/)
  assert.doesNotMatch(viewer, /handleGoToSlide\(endedOn\)/, 'the unclamped slide never reaches the editing frame')
  assert.match(viewer, /if \(!presentViewOnlyEnabled \|\| isFullscreen\) return\s*setPresentFrameFailed\(false\)/)
  // authoring controls are hidden only while the frame is up
  assert.match(viewer, /\{presentViewOnlyActive \? null : authoringControls\}/)
  assert.match(viewer, /presentViewOnlyActive && "justify-end",/)
})

// The viewer's own expressions, lifted from the real source and run: the overlay's start slide and the
// exit effect. (A full render of the 4,800-line viewer is out of reach of a plain-node test.)
const between = (text, from, to) => {
  const start = text.indexOf(from)
  assert.ok(start >= 0, `source has ${JSON.stringify(from)}`)
  const end = text.indexOf(to, start + from.length)
  assert.ok(end > start, `source has ${JSON.stringify(to)} after it`)
  return text.slice(start + from.length, end)
}
const startIndexExpression = between(viewer, '<PresentViewOnlyFrame\n                    key={approvedIframeNavigationUrl}\n                    baseUrl={approvedIframeNavigationUrl}\n                    startIndex={', '}\n                    sendCommand')
const exitEffectBody = 'if (presentViewOnlyActive) return\n' + between(viewer, 'useEffect(() => {\n    if (presentViewOnlyActive) return\n', '\n  }, [presentViewOnlyActive, currentSlide, presentSlideTotal, handleGoToSlide])')

await run('Present: the overlay opens on the slide the audience is on, not where Present began, kept inside the deck', () => {
  const startIndex = (reported, currentSlide, presentSlideTotal) => new Function(
    'presentFrameStartIndex', 'presentSlideIndexRef', 'currentSlide', 'presentSlideTotal', `return (${startIndexExpression})`,
  )(lib.presentFrameStartIndex, { current: reported }, currentSlide, presentSlideTotal)
  assert.equal(startIndex(null, 3, 9), 2, 'a fresh Present opens on the editing frame\'s slide (1-based 3 -> index 2)')
  assert.equal(startIndex(6, 3, 9), 6, 'after a URL change it re-opens on the slide the audience reached')
  assert.equal(startIndex(0, 3, 9), 0)
  assert.equal(startIndex(6, 3, 5), 4, 'the deck got shorter')
  assert.equal(startIndex(null, 12, 5), 4)
  assert.equal(startIndex(null, 3, 0), 2, 'unknown deck size: no clamp')
  assert.equal(startIndex(null, 0, 9), 0)
})

await run('Present exit: the editing frame is moved to the slide the audience ended on, clamped to the deck, only if it differs', () => {
  const exit = ({ active = false, ended, currentSlide, total, calls = [] }) => {
    const ref = { current: ended }
    new Function('presentViewOnlyActive', 'presentSlideIndexRef', 'presentSlideTotal', 'currentSlide', 'handleGoToSlide', 'clampPresentSlideIndex', exitEffectBody)(
      active, ref, total, currentSlide, index => { calls.push(index) }, lib.clampPresentSlideIndex,
    )
    return { calls, ref: ref.current }
  }
  assert.deepEqual(exit({ ended: 6, currentSlide: 3, total: 9 }), { calls: [6], ref: null })
  assert.deepEqual(exit({ ended: 2, currentSlide: 3, total: 9 }), { calls: [], ref: null }, 'already there: no navigation')
  assert.deepEqual(exit({ ended: 7, currentSlide: 3, total: 5 }), { calls: [4], ref: null }, 'the deck got shorter: the last slide, not a missing one')
  assert.deepEqual(exit({ ended: 7, currentSlide: 5, total: 5 }), { calls: [], ref: null }, 'clamped onto the slide the editing frame is already on')
  assert.deepEqual(exit({ ended: 7, currentSlide: 3, total: 0 }), { calls: [7], ref: null }, 'unknown size: unchanged behaviour')
  assert.deepEqual(exit({ ended: -3, currentSlide: 3, total: 9 }), { calls: [0], ref: null })
  assert.deepEqual(exit({ ended: null, currentSlide: 3, total: 9 }), { calls: [], ref: null }, 'flag off / nothing reported: nothing happens')
  assert.deepEqual(exit({ active: true, ended: 6, currentSlide: 3, total: 9 }), { calls: [], ref: 6 }, 'still presenting: nothing consumed')
})

await run('flag off: only the flag-gated overlay ever writes the Present slide index', () => {
  const writes = viewer.match(/presentSlideIndexRef\.current = [^\n]*/g) ?? []
  assert.deepEqual(writes.map(w => w.replace(/\s+/g, ' ')), [
    'presentSlideIndexRef.current = null', // the exit effect consumes it
    'presentSlideIndexRef.current = index }}', // only the overlay reports into it
  ])
  const overlay = between(viewer, '{presentViewOnlyActive && approvedIframeNavigationUrl && (', '\n                )}')
  assert.match(overlay, /onSlideIndex=\{\(index\) => \{ presentSlideIndexRef\.current = index \}\}/)
})

await run('chat "Open" link and dashboard preview go through viewOnlyIfEnabled', () => {
  assert.match(messageList, /import \{ viewOnlyIfEnabled \} from "@\/lib\/present-view-only"/)
  assert.match(messageList, /window\.open\(viewOnlyIfEnabled\(presentationUrlDecision\.url\), '_blank', 'noopener,noreferrer'\)/)
  assert.doesNotMatch(messageList, /window\.open\(presentationUrlDecision\.url/)
  assert.match(dashboard, /import \{ viewOnlyIfEnabled \} from "@\/lib\/present-view-only"/)
  assert.match(dashboard, /<iframe\s+src=\{viewOnlyIfEnabled\(decision\.url\)\}/)
  assert.doesNotMatch(dashboard, /src=\{decision\.url\}/)
})

await run('left alone: published viewer already passes viewOnly, the lib and component are the only new files', () => {
  assert.match(published, /\/p\/\$\{snapshotPresentationId\}\?viewOnly=true\$\{slideHash\}/)
  assert.doesNotMatch(published, /present-view-only/)
  for (const untouched of ['app/builder/page.tsx', 'lib/layout-service-client.ts', 'lib/api/download-service.ts', 'app/api/publish/[slug]/download/[format]/route.ts']) {
    assert.doesNotMatch(read(untouched), /present-view-only|viewOnlyIfEnabled/, `${untouched} must not use the Present helper`)
  }
})

await run('flag is documented default off and the test is registered', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED="false"$/m)
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['test:present-view-only'], 'node scripts/test-present-view-only.mjs')
})

console.log(`test-present-view-only: ${testCount} tests passed`)
