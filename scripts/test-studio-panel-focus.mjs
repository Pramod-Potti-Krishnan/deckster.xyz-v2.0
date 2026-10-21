// PASS2 #3: Add Slide / Add Element no longer squeeze the canvas (flag NEXT_PUBLIC_STUDIO_PANEL_FOCUS, default off).
// Offline and self-contained: no network, no browser. The repo root is found from this file.
// Covers: the flag (exact "true"); the pure focus rules; the page's real focus block (extracted from page.tsx and run) fed into
// the real workspace allocator, which with the flag off gets exactly the base inputs and so lays out exactly as before; the
// real PresentationViewer server-rendered (flag off, and on with the rail not collapsed = the base commit's viewer byte for
// byte; collapsed = the same rail kept mounted but out of the layout and invisible); the pass-through in PresentationArea;
// .env.example.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { restoreRailCondition } from './studio-rail-build-count-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_PANEL_FOCUS'
/** The commit this feature was built on (studio-v4-dev-preparation-code at #357): flag off must render exactly as it did. */
const BASE_COMMIT = '68e3396'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text; `stubs`: specifier -> module. */
function createWorld({ env = {}, overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  return { load }
}
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- the flag and the pure rules
const focusLib = env => createWorld({ env }).load('lib/studio-panel-focus.ts')
const { allocateStudioWorkspace } = createWorld().load('lib/studio-workspace-layout.ts')
{
  check(assert.equal, focusLib({}).STUDIO_PANEL_FOCUS_ENABLED, false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on'])
    check(assert.equal, focusLib({ [FLAG]: value }).STUDIO_PANEL_FOCUS_ENABLED, false, `flag "${value}" is off`)
  check(assert.equal, focusLib({ [FLAG]: 'true' }).STUDIO_PANEL_FOCUS_ENABLED, true, 'exact "true" is on')
  check(assert.ok, Object.isFrozen(focusLib({}).STUDIO_PANEL_FOCUS_NONE))
  check(assert.deepEqual, { ...focusLib({}).STUDIO_PANEL_FOCUS_NONE }, { chat: false, rail: false })

  const lib = focusLib({})
  const bools = [false, true]
  for (const enabled of bools) for (const studioShell of bools) for (const overlay of bools)
    for (const addSlideOpen of bools) for (const addElementOpen of bools) {
      const active = lib.studioPanelFocusActive({ enabled, studioShell, overlay, addSlideOpen, addElementOpen })
      check(assert.equal, active, enabled && studioShell && !overlay && (addSlideOpen || addElementOpen),
        JSON.stringify({ enabled, studioShell, overlay, addSlideOpen, addElementOpen }))
    }
  for (const chatOpen of bools) for (const revealed of bools) for (const workspaceWidth of [0, NaN, 400, 880, 1099, 1100, 1388, 2400]) {
    check(assert.equal, lib.studioPanelFocusChatOpen({ chatOpen, focus: false, workspaceWidth, revealed }), chatOpen, 'focus off: the chat as it is')
    const dual = allocateStudioWorkspace({ width: workspaceWidth, chatPreference: 304, inspectorPreference: 360, chatOpen: true,
      inspectorOpen: true, activePane: 'chat' }).dualPane
    check(assert.equal, lib.studioPanelFocusChatOpen({ chatOpen, focus: true, workspaceWidth, revealed }), chatOpen && (!dual || revealed),
      `focus on, width ${workspaceWidth}: the allocator's own dual-pane rule (${dual})`)
  }
  for (const focus of bools) for (const revealed of bools)
    check(assert.equal, lib.studioPanelFocusRailCollapsed({ focus, revealed }), focus && !revealed)
}

// ---------------------------------------------------------------- the page's real focus block, run against the allocator
const page = read('app/builder/page.tsx')
{
  const start = page.indexOf('  const isDeckDrawerOpen = showChat\n')
  const endMarker = '  const studioPanelFocusRevealRail = useCallback(() => setStudioPanelFocusReveal(reveal => ({ ...reveal, rail: true })), [])\n'
  const end = page.indexOf(endMarker)
  check(assert.ok, start > 0 && end > start, 'the focus block sits right after isDeckDrawerOpen')
  const block = page.slice(start, end + endMarker.length)
  const fn = compile('focus-block.ts', `module.exports = function run(deps) {
    const { showChat, studioShell, studioOverlayWorkspace, addSlideV2Open, generationPanel, workspaceWidth, useState, useEffect, useCallback,
      STUDIO_PANEL_FOCUS_ENABLED, STUDIO_PANEL_FOCUS_NONE, studioPanelFocusActive, studioPanelFocusChatOpen } = deps
    ${block}
    return { isDeckDrawerOpen, studioPanelFocus, studioPanelFocusReveal, studioWorkspaceChatOpen, studioPanelFocusChatHidden, studioPanelFocusRevealRail }
  }`)
  const mod = { exports: {} }
  new Function('module', 'exports', fn)(mod, mod.exports)
  const runBlock = mod.exports

  const run = (env, input, reveal) => {
    const lib = focusLib(env)
    const effects = []
    const writes = []
    const out = runBlock({ ...input, generationPanel: { isOpen: input.addElementOpen },
      useState: init => [reveal ?? init, next => writes.push(next)], useEffect: (fn, deps) => effects.push({ fn, deps }),
      useCallback: fn => fn, ...lib })
    return { out, effects, writes, lib }
  }
  const layout = (input, chatOpen) => allocateStudioWorkspace({ width: input.workspaceWidth, chatPreference: 304, inspectorPreference: 360,
    chatOpen, inspectorOpen: input.addSlideV2Open || input.addElementOpen, activePane: 'inspector', overlay: input.studioOverlayWorkspace })
  const bools = [false, true]
  let combos = 0
  for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }])
    for (const studioShell of bools) for (const studioOverlayWorkspace of bools) for (const showChat of bools)
      for (const addSlideV2Open of bools) for (const addElementOpen of bools) for (const workspaceWidth of [700, 1000, 1100, 1388])
        for (const reveal of [undefined, { chat: true, rail: true }]) {
          const input = { studioShell, studioOverlayWorkspace, showChat, addSlideV2Open, addElementOpen, workspaceWidth }
          const { out, effects, writes, lib } = run(env, input, reveal)
          check(assert.equal, out.studioPanelFocus, false, 'flag off: never focused')
          check(assert.equal, out.studioWorkspaceChatOpen, showChat, 'flag off: the allocator gets isDeckDrawerOpen, as on the base')
          check(assert.equal, out.studioPanelFocusChatHidden, false)
          check(assert.deepEqual, layout(input, out.studioWorkspaceChatOpen), layout(input, showChat), 'flag off: identical layout')
          effects.forEach(e => e.fn())
          check(assert.ok, writes.every(w => w === lib.STUDIO_PANEL_FOCUS_NONE), 'flag off: only the shared no-op reset is written')
          combos++
        }
  // flag on
  const on = { [FLAG]: 'true' }
  const dual = { studioShell: true, studioOverlayWorkspace: false, showChat: true, workspaceWidth: 1388 }
  for (const [name, open] of [['Add Slide', { addSlideV2Open: true, addElementOpen: false }], ['Add Element', { addSlideV2Open: false, addElementOpen: true }]]) {
    const input = { ...dual, ...open }
    const { out } = run(on, input)
    check(assert.equal, out.studioPanelFocus, true, `${name}: focused`)
    check(assert.equal, out.studioWorkspaceChatOpen, false, `${name}: the allocator sees the chat closed`)
    check(assert.equal, out.studioPanelFocusChatHidden, true, `${name}: the Director handle brings it back`)
    check(assert.equal, out.isDeckDrawerOpen, true, `${name}: the chat's own open state is untouched`)
    const before = layout({ ...input, addSlideV2Open: false, addElementOpen: false }, true)
    const squeezed = layout(input, true)
    const focused = layout(input, out.studioWorkspaceChatOpen)
    check(assert.equal, focused.chatVisible, false)
    check(assert.equal, focused.left, 0)
    check(assert.equal, focused.inspectorWidth, squeezed.inspectorWidth, 'the panel keeps its width')
    check(assert.equal, focused.canvasWidth, squeezed.canvasWidth + squeezed.chatWidth, 'the canvas gets the chat column back')
    check(assert.equal, before.chatWidth, focused.chatWidth, 'the chat width the allocator would give it is unchanged')
    // brought back by hand
    const shown = run(on, input, { chat: true, rail: false }).out
    check(assert.equal, shown.studioWorkspaceChatOpen, true, `${name}: Director handle pressed: the chat is back`)
    check(assert.deepEqual, layout(input, shown.studioWorkspaceChatOpen), squeezed)
  }
  {
    // panel closed: the reset effect writes the shared value, and the layout is the base one
    const input = { ...dual, addSlideV2Open: false, addElementOpen: false }
    const { out, effects, writes, lib } = run(on, input, { chat: true, rail: true })
    check(assert.equal, out.studioPanelFocus, false)
    check(assert.equal, out.studioWorkspaceChatOpen, true)
    effects.forEach(e => e.fn())
    check(assert.deepEqual, writes, [lib.STUDIO_PANEL_FOCUS_NONE], 'closing resets what was brought back')
    // single pane: the chat already alternates with the panel
    const single = run(on, { ...dual, workspaceWidth: 1000, addSlideV2Open: true, addElementOpen: false }).out
    check(assert.equal, single.studioPanelFocus, true)
    check(assert.equal, single.studioWorkspaceChatOpen, true, 'single pane: the chat is left alone')
    // overlay and classic shell: never focused
    check(assert.equal, run(on, { ...dual, studioOverlayWorkspace: true, addSlideV2Open: true, addElementOpen: false }).out.studioPanelFocus, false)
    check(assert.equal, run(on, { ...dual, studioShell: false, addSlideV2Open: true, addElementOpen: false }).out.studioPanelFocus, false)
    // a closed chat stays closed
    check(assert.equal, run(on, { ...dual, showChat: false, addSlideV2Open: true, addElementOpen: false }).out.studioPanelFocusChatHidden, false)
  }
  console.log(`  page focus block: flag-off layout == base layout in ${combos} combinations`)

  // wiring: both allocations read the focused chat state; nothing else reads it differently
  check(assert.equal, (page.match(/chatOpen: studioWorkspaceChatOpen,/g) ?? []).length, 2, 'the live layout and the width persistence')
  check(assert.doesNotMatch, page, /^\s+chatOpen: isDeckDrawerOpen,$/m, 'no allocation left on the unfocused value')
  check(assert.match, page, /data-studio-panel-focus=\{studioPanelFocus \? "true" : undefined\}/)
  check(assert.match, page, /onClick=\{\(\) => \{\n {16}if \(studioPanelFocusChatHidden\) \{ setStudioPanelFocusReveal\(reveal => \(\{ \.\.\.reveal, chat: true \}\)\); return \}\n {16}if \(studioShell && isDeckDrawerOpen && !workspaceLayout\.chatVisible\) \{ selectWorkspacePane\('chat'\); return \}/,
    'the Director handle brings the collapsed chat back first')
  check(assert.ok, page.includes(`            studioRailCollapsed={STUDIO_PANEL_FOCUS_ENABLED ? studioPanelFocusRailCollapsed({ focus: studioPanelFocus, revealed: studioPanelFocusReveal.rail }) : undefined}
            onStudioRailReveal={STUDIO_PANEL_FOCUS_ENABLED ? studioPanelFocusRevealRail : undefined}`), 'flag off: the viewer gets no rail props')
  const area = read('components/builder/presentation-area.tsx')
  check(assert.ok, area.includes(`            studioRailCollapsed={studioRailCollapsed}
            onStudioRailReveal={onStudioRailReveal}`), 'PresentationArea passes both through')
  const baseArea = baseSource('components/builder/presentation-area.tsx')
  if (baseArea) {
    // + PASS2B G09 (NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE): studioBriefSent and its decision, and the one spread it adds to the two StudioWelcomeStage draws
    //   (flag off the spread is empty; scripts/test-studio-first-run-poster-hide.mjs compares this file, minus the G09 text, with the base commit's).
    //   + PASS2B G16 (9a9f0e4, NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD): the one `hasFinalDeck` line on <PresentationDownloadControls> (PublishControls already had its own).
    const stripped = area.replace(/(stage=\{currentStage\}\n)\s*hasFinalDeck=\{hasFinalDeck\}\n/, '$1').split('\n').map(line => line.replace(' {...studioPosterPlanning}', '')).filter(line => !/studioRailCollapsed|onStudioRailReveal|onUserDeckEdit|PASS2 #3|onComposerTemplateAction|onOpenComposerLibrary|Toolbar template picker fix-forward|ComposerLibraryRequest|NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB|studioTabPausedHint|PASS2B G09|studioBriefSent|studioPosterPlanning|RAIL-SLIDES-1-MIDBUILD/.test(line)).join('\n')
    check(assert.equal, stripped, baseArea, 'PresentationArea: only the pass-through lines were added (the rail props, the session-hygiene onUserDeckEdit one, the toolbar template picker\'s two callbacks, and the one-live-tab studioTabPausedHint one)')
  }
}

// ---------------------------------------------------------------- the real viewer, server-rendered
const VIEWER_URL = 'https://layout.uat.test/p/pres-1'
const STUBS = {
  'next/navigation': { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/builder' },
  'next-auth/react': { useSession: () => ({ data: null, status: 'unauthenticated', update: async () => null }), signIn: async () => {}, signOut: async () => {}, SessionProvider: ({ children }) => children },
}
const viewerOf = (env, overrides = {}) => createWorld({ env, overrides, stubs: STUBS }).load('components/presentation-viewer.tsx').PresentationViewer
const noop = () => {}
const CASES = [
  ['7 slides', { presentationUrl: VIEWER_URL, presentationId: 'pres-1', slideCount: 7 }],
  ['3 slides, thumbnails', { presentationUrl: VIEWER_URL, presentationId: 'pres-1', slideCount: 3, thumbnailUrlsBySlide: { 1: 'https://proj.test/a.png' } }],
  ['compose job', { presentationUrl: VIEWER_URL, presentationId: 'pres-1', slideCount: 2, composeJobs: [
    { jobId: 'j1', targetIndex: 1, targetLayoutIndex: 1, status: 'building', lastProgressText: 'Writing' }] }],
  ['no slide count', { presentationUrl: VIEWER_URL, presentationId: 'pres-1' }],
]
const ENVS = [
  ['studio', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test' }],
  ['studio + rail flags', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test',
    NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true', NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED: 'true' }],
  ['classic', { NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test' }],
]
const render = (Viewer, props) => renderToStaticMarkup(React.createElement(Viewer, props))
const silence = fn => { const e = console.error, w = console.warn; console.error = console.warn = noop; try { return fn() } finally { console.error = e; console.warn = w } }
{
  const baseViewer = baseSource('components/presentation-viewer.tsx')
  if (baseViewer) {
    let compared = 0
    for (const [envName, env] of ENVS) {
      const Base = viewerOf(env, { 'components/presentation-viewer.tsx': baseViewer })
      for (const [flagName, flagEnv] of [['unset', env], ['"false"', { ...env, [FLAG]: 'false' }], ['"true"', { ...env, [FLAG]: 'true' }]]) {
        const Work = viewerOf(flagEnv)
        for (const [caseName, props] of CASES) {
          const want = silence(() => render(Base, props))
          // the page passes undefined while the flag is off, and `false` (not collapsed) while it is on and no panel is open
          for (const [propsName, extra] of [['no rail props', {}], ['undefined', { studioRailCollapsed: undefined, onStudioRailReveal: undefined }],
            ['not collapsed', { studioRailCollapsed: false, onStudioRailReveal: noop }]]) {
            const got = silence(() => render(Work, { ...props, ...extra }))
            check(assert.equal, sha(got), sha(want), `${envName}, flag ${flagName}, ${caseName}, ${propsName}: sha == ${BASE_COMMIT}`)
            compared++
          }
        }
      }
    }
    console.log(`  viewer == ${BASE_COMMIT} viewer (sha256) in ${compared} renders`)
  } else {
    console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone (the checks below still run)`)
  }

  // collapsed: the rail stays mounted (same strip markup, so scroll, selection and live frames survive) but leaves the layout
  // and is invisible; its resize handle is gone; the toggle offers "Show thumbnails"; nothing else differs
  const env = ENVS[0][1]
  const Work = viewerOf({ ...env, [FLAG]: 'true' })
  const HIDDEN = 'position:absolute;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none'
  for (const [caseName, props] of CASES.slice(0, 3)) {
    const open = silence(() => render(Work, props))
    const closed = silence(() => render(Work, { ...props, studioRailCollapsed: true, onStudioRailReveal: noop }))
    const strip = html => html.slice(html.indexOf('<div data-studio-v4-thumbnails="true"'))
    check(assert.match, open, /data-studio-thumbnail-strip="true"/, `${caseName}: the strip renders when not collapsed`)
    check(assert.match, closed, new RegExp(`<div data-studio-v4-thumbnails="true" style="width:120px;${HIDDEN}"`), `${caseName}: out of the layout, invisible`)
    check(assert.equal, strip(closed).replace(`;${HIDDEN}`, ''), strip(open), `${caseName}: the same strip stays mounted`)
    check(assert.doesNotMatch, closed, /data-studio-v4-thumbnail-resize/, `${caseName}: no resize handle while collapsed`)
    check(assert.match, open, /data-studio-v4-thumbnail-resize/)
    check(assert.match, closed, /data-studio-v4-thumbnail-toggle="true"[^>]*title="Show thumbnails" aria-label="Show thumbnails" aria-expanded="false"/,
      `${caseName}: the Thumbnails handle stays, ready to bring the rail back`)
    // the row holding canvas and rail is the positioning box for the hidden rail
    check(assert.ok, closed.includes('<div class="flex-1 flex min-h-0 min-w-0  relative">'), `${caseName}: row positioned`)
    const cut = html => html.slice(0, html.indexOf('<div data-studio-v4-thumbnail-resize') >= 0 ? html.indexOf('<div data-studio-v4-thumbnail-resize') : html.indexOf('<div class="relative w-0 flex-shrink-0 z-10">'))
    check(assert.equal, cut(closed).replace('<div class="flex-1 flex min-h-0 min-w-0  relative">', '<div class="flex-1 flex min-h-0 min-w-0 ">'), cut(open),
      `${caseName}: everything before the rail is identical`)
    check(assert.ok, cut(open).length > 1000)
  }
  // a rail the user hid stays hidden and is not touched by the collapse
  const lib = focusLib({ [FLAG]: 'true' })
  check(assert.deepEqual, { ...lib.STUDIO_RAIL_FOCUS_HIDDEN_STYLE }, { position: 'absolute', top: 0, right: 0, bottom: 0, visibility: 'hidden', pointerEvents: 'none' })
  check(assert.ok, Object.isFrozen(lib.STUDIO_RAIL_FOCUS_HIDDEN_STYLE))
}

// ---------------------------------------------------------------- the viewer's toggle: collapsed = bring back, never flip the choice
{
  const viewer = read('components/presentation-viewer.tsx')
  check(assert.ok, viewer.includes(`  const railFocusHidden = studioRailCollapsed && showThumbnails
  const railShown = showThumbnails && !railFocusHidden
  const handleToggleOverview = useCallback(() => {
    debugLog('🔘 Grid button clicked - toggling thumbnail strip!')
    if (railFocusHidden) { onStudioRailReveal?.(); return }
    setShowThumbnails(prev => !prev)
  }, [railFocusHidden, onStudioRailReveal])`), 'the handle and Escape share one toggle')
  check(assert.equal, (viewer.match(/setShowThumbnails\(/g) ?? []).length, 2, 'the user choice is written only by the toggle and the first-mount rule')
  check(assert.ok, viewer.includes(`style={studioShell ? { width: showThumbnails ? thumbnailWidth : 0, ...(railFocusHidden ? STUDIO_RAIL_FOCUS_HIDDEN_STYLE : undefined) } : undefined}`))
  // + RAIL-SLIDES-1-MIDBUILD (NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT): the condition gains `|| Boolean(railBuildRows?.length)` (null without the flag); restored here, so the pin still reads the base line.
  check(assert.ok, restoreRailCondition(viewer).includes(`{showThumbnails && (slideThumbnails.length > 0 || composeJobs.length > 0) && (`), 'the strip mounts on the user choice alone')
  check(assert.match, viewer, /studioRailCollapsed = false,\n {2}onStudioRailReveal,/)
}

// ---------------------------------------------------------------- .env.example
check(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_PANEL_FOCUS="false"$/m, 'documented in .env.example, default off')

console.log(`Studio panel focus: ${checks} checks passed; no network.`)
