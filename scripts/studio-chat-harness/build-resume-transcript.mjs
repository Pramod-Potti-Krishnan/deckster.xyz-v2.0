// J7-RESUME-LOOP-P1, Studio half (NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX): replays Director's recorded J7 Stop / reload / typed
// resume frames through the REAL Director socket hook (hooks/use-deckster-websocket-v2.ts), the REAL build-narration hook and
// reducer (hooks/use-build-narration.ts, lib/build-narration-heuristics.ts) and the REAL StageRibbon / PauseStopControl, on the
// PR #371 harness (fake socket, virtual clock, offline loader, mini React host). Nothing under app/, components/, hooks/ or lib/ is
// copied: the page's wiring between those pieces is read from app/builder/page.tsx by AST and run in the harness's strict scope
// (a name the harness does not provide throws):
//   - the useBuildNarration({...}) argument object (so the flag is read exactly as the page reads it);
//   - the effect that routes typed frames into the narration hook (buildNarrationHandlersRef);
//   - the socket hook's onBuildPhase / onBuildEvent / onBuildStateSync / onSlideBuilt options;
//   - <PresentationArea buildNarrationApi={...}> (Pause / Resume / Stop -> sendBuildControl -> markNarrationControl).
// The ribbon is mounted exactly when components/builder/presentation-area.tsx mounts it (narration active).
//
// Stand-ins, all presentation-only: framer-motion (AnimatePresence / motion.* render their children as plain elements), the Stop
// confirm dialog (components/ui/alert-dialog: open -> its children, the action/cancel as plain buttons), and the build-control HTTP
// route (answered 200 and recorded; Director's stop acknowledgement then carries the request id the page generated, as Director's
// real ack does). Page state these frames do not drive (isGeneratingFinal / isGeneratingStrawman, templates, the canvas) stays at
// its defaults: the J7 build auto-proceeded, so no Accept click ever set isGeneratingFinal.
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Root, hostNodes, textOf, toElements } from './mini-react.mjs'
import { createEnvironment, START_MS } from './fake-env.mjs'
import { createModuleLoader } from './module-loader.mjs'
import { pageSources } from './page-sources.mjs'
import * as extract from './page-extract.mjs'
import { BASE_ENV, PROFILES } from './profiles.mjs'
import { canonical, sha256 } from './snapshot.mjs'
import { esmPackages, lucideStub } from './esm-packages.mjs'

export const BUILD_RESUME_FLAG = 'NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX'
const DEFAULT_DT = 500

const regionCache = new Map()
// The page regions this runner executes, compiled once per tree.
export function buildResumeRegions(root) {
  if (regionCache.has(root)) return regionCache.get(root)
  const page = extract.parseSource(path.join(root, 'app/builder/page.tsx'))
  const anchors = []
  const compile = (label, node) => { anchors.push(extract.anchor(label, node, page)); return extract.compile(node, page, label) }
  const narrationCalls = extract.findCalls(page, 'useBuildNarration')
  if (narrationCalls.length !== 1) throw new Error(`build-resume harness: expected one useBuildNarration(...) call, found ${narrationCalls.length}`)
  const route = extract.findCalls(page, 'useEffect').find(call => call.arguments[0].getText(page).includes('buildNarrationHandlersRef.current = effectiveBuildNarrationEnabled'))
  if (!route) throw new Error('build-resume harness: the effect that routes typed frames into the narration hook is gone')
  const option = name => compile(`page.hookOption.${name}`, extract.hookOptionProperty(page, 'useDecksterWebSocketV2', name))
  const area = extract.jsxAttributes(page, 'PresentationArea')
  if (!area.buildNarrationApi?.node) throw new Error('build-resume harness: <PresentationArea buildNarrationApi> is gone')
  const regions = {
    narrationArgs: compile('page.useBuildNarration(args)', narrationCalls[0].arguments[0]),
    route: { fn: compile('page.buildNarrationHandlersRef effect', route.arguments[0]), deps: compile('page.buildNarrationHandlersRef effect.deps', route.arguments[1]) },
    onBuildPhase: option('onBuildPhase'),
    onBuildEvent: option('onBuildEvent'),
    onBuildStateSync: option('onBuildStateSync'),
    onSlideBuilt: option('onSlideBuilt'),
    buildNarrationApi: compile('page.<PresentationArea buildNarrationApi>', area.buildNarrationApi.node),
    // The "Earlier step" lock on approval cards (NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED), read from the narration state: reported
    // at every checkpoint so a run shows the lock is unchanged (item 3 of the J7 spec: the fix must not change it).
    approvalGatesLocked: compile('page.approvalGatesLocked', extract.findVariableInitializer(page, 'approvalGatesLocked')),
  }
  const result = { regions, anchors: anchors.sort((a, b) => (a.label < b.label ? -1 : 1)) }
  regionCache.set(root, result)
  return result
}

const passChildren = ({ children }) => children ?? null
const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId', 'whileHover', 'whileTap', 'custom'])
function framerMotionStub() {
  const cache = new Map()
  const motion = new Proxy({}, {
    get(_target, tag) {
      if (typeof tag !== 'string') return undefined
      if (!cache.has(tag)) {
        const Plain = ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))), children)
        cache.set(tag, Plain)
      }
      return cache.get(tag)
    },
  })
  return { __esModule: true, AnimatePresence: passChildren, motion, useReducedMotion: () => true }
}
function alertDialogStub() {
  const button = role => ({ children, onClick }) => React.createElement('button', { type: 'button', 'data-harness-dialog': role, onClick }, children)
  return {
    __esModule: true,
    AlertDialog: ({ open, children }) => (open ? React.createElement('div', { role: 'alertdialog' }, children) : null),
    AlertDialogContent: passChildren, AlertDialogHeader: passChildren, AlertDialogFooter: passChildren,
    AlertDialogTitle: passChildren, AlertDialogDescription: passChildren,
    AlertDialogCancel: button('cancel'), AlertDialogAction: button('action'),
  }
}

/**
 * Run one scenario of a fixture. `flag` 'off' leaves NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX unset, 'on' sets it to "true". `director` picks the
 * recorded answer to the typed resume: 'off' (uat with DIRECTOR_RESUME_AFTER_STOP_ENABLED off) or 'on' (Director !490 on).
 * Returns { checkpoints, outbound, calls, notes, failures, controlRequests, diagnostics }.
 */
export async function runBuildResumeTranscript({ root, fixture, scenario, flag, director = 'on' }) {
  const steps = fixture.scenarios[scenario]
  if (!steps) throw new Error(`fixture ${fixture.name}: no scenario "${scenario}"`)
  const sources = pageSources(root)
  const { regions: P } = buildResumeRegions(root)
  // Studio dev's switches for this path: narration, build control, and the ask-card lock (on in dev since PASS2).
  const processEnv = { ...BASE_ENV, ...PROFILES.studio, NEXT_PUBLIC_BUILD_NARRATION: 'true', NEXT_PUBLIC_BUILD_CONTROL: 'true',
    NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED: 'true',
    ...(fixture.env || {}), ...(flag === 'on' ? { [BUILD_RESUME_FLAG]: 'true' } : {}) }
  const env = createEnvironment({ processEnv })
  const session = fixture.session
  const authUser = { id: session.userId, email: `${session.userId}@example.invalid` }
  // ---- recorders ---------------------------------------------------------------------------------------------------
  const rec = { step: -1, calls: [], checkpoints: [], notes: [], failures: [] }
  const call = (name, args) => rec.calls.push({ step: rec.step, at: env.clock.now() - START_MS, name, args: canonical(args) })

  // Director's build-control route (HTTP, the page's first transport): answered locally, every request recorded.
  const controlRequests = []
  const baseFetch = env.globals.fetch
  env.globals.fetch = async (input, init) => {
    const url = String(input)
    if (/\/api\/v1\/build-control$/.test(url) && (init?.method || 'GET') === 'POST') {
      const body = JSON.parse(String(init.body))
      controlRequests.push(body)
      call('director.build-control', [{ action: body.action, build_id: body.build_id ?? null, request_id: body.request_id }])
      return { ok: true, status: 200, json: async () => ({ status: 'ok', state: body.action === 'stop' ? 'stopped' : 'running' }) }
    }
    return baseFetch(input, init)
  }
  const loader = createModuleLoader({
    root, globals: env.globals,
    // One React for the host and the repo code, also when `root` is another checkout (the base, for the flag-off identity).
    stubs: { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React), 'framer-motion': framerMotionStub() },
    fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) }, 'components/ui/alert-dialog': alertDialogStub() },
  })
  const hookModule = loader.load('hooks/use-deckster-websocket-v2.ts')
  const narrationModule = loader.load('hooks/use-build-narration.ts')
  const { StageRibbon } = loader.load('components/build-narration/stage-ribbon.tsx')
  const { attachmentsFromPayload } = loader.load('lib/user-message-attachments.ts')
  const { askGatesLocked } = loader.load('lib/director-ask-identity.ts')

  const pageInputs = { currentSessionId: session.id }
  const makeRefs = () => ({
    answeredActionsRef: { current: new Set() }, userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() },
    hasSeenWelcomeRef: { current: false }, messagesEndRef: { current: null }, textareaRef: { current: null },
    actionSubmissionPendingRef: { current: new Set() }, questionSubmissionPendingRef: { current: false }, isExecutingSendRef: { current: false },
    isGeneratingFinalRef: { current: false },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: session.id, userId: session.userId, routeSessionId: session.id, freshRouteSourceSessionId: null } },
    transcriptScopeRef: { current: { userIntentSeen: false, generation: 1 } },
  })
  let refs = makeRefs()
  const probe = { latest: null }
  const noop = () => {}

  function PageProbe() {
    const R = React
    const [userMessages, setUserMessages] = R.useState([])
    const sessionApi = {
      userMessages, setUserMessages, isLoadingSession: false,
      answeredActionsRef: refs.answeredActionsRef, userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef,
      hasSeenWelcomeRef: refs.hasSeenWelcomeRef, hasTitleFromUserMessageRef: { current: false }, hasTitleFromPresentationRef: { current: false },
      markStudioUserIntent: noop, hasStudioUserIntent: () => false, studioFrontendTranscriptReceipt: null,
    }
    const base = {
      React: R, process: env.globals.process, console: env.console, Date: env.globals.Date, crypto: env.crypto,
      setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout, requestAnimationFrame: env.clock.requestAnimationFrame,
      studioShell: env.globals.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true', features: { immediateConnection: true },
      currentSessionId: pageInputs.currentSessionId, user: authUser, session: sessionApi, ...refs,
    }
    const hookOptions = {}
    for (const [name, evaluate] of Object.entries(sources.compiled.hookOptions)) hookOptions[name] = evaluate(base)
    // page.tsx: the typed-frame forwarders read this ref, which the routing effect below fills after the narration hook exists.
    const buildNarrationHandlersRef = R.useRef({})
    const forward = {
      buildNarrationHandlersRef, studioShell: base.studioShell, currentSessionIdRef: { current: pageInputs.currentSessionId },
      // Stage F thumbnails and the Studio partial-stage admission ride the same slide_built frame; they are not under test here.
      setReceivedSlideThumbnailUrlsByPresentation: (...args) => call('page.setReceivedSlideThumbnailUrlsByPresentation', [args[0]]),
      mergeStageFPresentationThumbnailUrl: () => null, studioPartialIngressRef: { current: null },
    }
    const options = {
      ...hookOptions,
      onSessionStateChange: state => call('hook.onSessionStateChange', [state]),
      onSlideComposeProgress: noop, onSlideComposeReady: noop, onSlideComposeFailed: noop, onElementDirective: noop, onSessionDirective: noop,
      onBuildPhase: P.onBuildPhase(forward), onBuildEvent: P.onBuildEvent(forward), onBuildStateSync: P.onBuildStateSync(forward),
      onSlideBuilt: P.onSlideBuilt(forward),
    }
    const ws = hookModule.useDecksterWebSocketV2(options)
    R.useEffect(() => { sources.compiled.cacheSyncEffect({ userMessages, updateCacheUserMessages: ws.updateCacheUserMessages })() }, [userMessages, ws.updateCacheUserMessages])
    // page.tsx: the narration hook, with the page's own argument object (template reuse off, so narration is on).
    const narrationScope = {
      process: env.globals.process, effectiveBuildNarrationEnabled: true, currentSessionId: pageInputs.currentSessionId,
      messages: ws.messages, currentStatus: ws.currentStatus, slideStructure: ws.slideStructure,
      isGeneratingFinal: false, isGeneratingStrawman: false,
      finalPresentationUrl: ws.finalPresentationUrl, finalPresentationId: ws.finalPresentationId,
    }
    const narrationHook = narrationModule.useBuildNarration(P.narrationArgs(narrationScope))
    const onNativeBuildPhase = R.useCallback((payload, owner) => call('page.onNativeBuildPhase', [{ phase: payload?.phase, owner }]), [])
    const routeScope = {
      buildNarrationHandlersRef, effectiveBuildNarrationEnabled: true, onNativeBuildPhase,
      narrationOnBuildPhase: narrationHook.onBuildPhase, narrationOnBuildEvent: narrationHook.onBuildEvent,
      narrationOnSlideBuilt: narrationHook.onSlideBuilt, narrationSyncBuildState: narrationHook.syncBuildState,
    }
    R.useEffect(P.route.fn(routeScope), P.route.deps(routeScope))
    const buildNarration = narrationHook.narration
    const buildNarrationApi = P.buildNarrationApi({
      effectiveBuildNarrationEnabled: true, pinNarrationSlide: narrationHook.pinSlide, features: { buildControlEnabled: true },
      sendBuildControl: (...args) => { const id = ws.sendBuildControl(...args); call('page.sendBuildControl', [...args, id]); return id },
      buildNarration, markNarrationControl: narrationHook.markControl,
    })
    const gatesLocked = P.approvalGatesLocked({ askGatesLocked, isGeneratingFinal: false, buildNarration, directorWorkflowState: ws.directorWorkflowState })
    probe.latest = { ws, narration: buildNarration, gatesLocked, setUserMessages }
    // components/builder/presentation-area.tsx: the ribbon is mounted whenever narration is active.
    return buildNarration.active ? R.createElement(StageRibbon, { narration: buildNarration, control: buildNarrationApi?.control }) : null
  }

  // ---- driver --------------------------------------------------------------------------------------------------------
  let root_ = null
  const settle = async () => {
    for (let quiet = 0, rounds = 0; quiet < 2; rounds++) {
      if (rounds > 80) throw new Error('build-resume harness: the page did not settle')
      await env.macrotask()
      quiet = root_ && root_.flush() ? 0 : quiet + 1
    }
  }
  env.settle = settle
  const advance = async ms => { await env.clock.advance(ms, settle) }
  const mount = async () => { refs = makeRefs(); root_ = new Root(); root_.setElement(React.createElement(PageProbe)); await settle() }
  const unmount = async () => { root_.unmount(); root_ = null; probe.latest = null; await advance(0) }
  const socketFor = step => {
    const socket = env.sockets[step.socket ?? env.sockets.length - 1]
    if (!socket) throw new Error(`build-resume harness: step ${rec.step} (${step.op}) has no socket`)
    return socket
  }
  const ribbonHosts = () => (root_?.tree ? hostNodes(root_.tree) : [])
  const buttons = () => ribbonHosts().filter(node => node.type === 'button')
  const ribbonButtons = () => buttons().filter(node => node.props?.['data-harness-dialog'] === undefined)
  const view = () => {
    const tree = root_?.tree
    const html = tree ? renderToStaticMarkup(toElements(tree)) : ''
    const ribbon = ribbonHosts().find(node => node.props?.['data-testid'] === 'bn-stage-ribbon')
    return {
      ribbon: Boolean(ribbon), headline: ribbon ? textOf(ribbon).trim() : null,
      buttons: buttons().map(node => ({ text: textOf(node).trim(), disabled: Boolean(node.props.disabled) })),
      markupSha: html ? sha256(html).slice(0, 16) : null,
    }
  }
  const digest = label => {
    const { ws, narration: n } = probe.latest
    return {
      label, virtualMs: env.clock.now() - START_MS,
      narration: { active: n.active, phase: n.phase, phaseLabel: n.phaseLabel, buildId: n.buildId, control: n.control, slideCount: n.slideCount,
        slidesDone: n.slidesDone, slideStates: n.slideStates, buildPresentationId: n.buildPresentationId, retiredBuildIds: n.retiredBuildIds },
      deck: { activeVersion: ws.activeVersion, presentationUrl: ws.presentationUrl, presentationId: ws.presentationId, finalUrl: ws.finalPresentationUrl,
        finalId: ws.finalPresentationId, slideCount: ws.slideCount },
      view: view(),
      approvalGatesLocked: probe.latest.gatesLocked, workflowState: ws.directorWorkflowState,
      snapshotStored: env.sessionStorage.getItem(`deckster_narration_${session.id}`) !== null,
    }
  }
  const findButton = text => {
    const hit = ribbonButtons().filter(node => textOf(node).trim() === text)
    if (hit.length !== 1) throw new Error(`build-resume harness: step ${rec.step}: ${hit.length} button(s) read "${text}" (${buttons().map(b => textOf(b).trim()).join(' | ')})`)
    return hit[0]
  }
  const ops = {
    async ensureConnected() { probe.latest.ws.ensureConnected() },
    async open(step) { socketFor(step).serverOpen() },
    async frames(step) {
      const list = fixture.frames[step.from].slice(step.start ?? 0, step.end)
      for (const frame of list) { socketFor(step).serverMessage(JSON.stringify(frame)); await settle() }
    },
    // A frame whose control_request_id answers the page's own last build-control request (Director echoes the request id).
    async ack(step) {
      const frame = JSON.parse(JSON.stringify(fixture.frames[step.from][step.index]))
      const last = controlRequests[controlRequests.length - 1]
      if (!last) throw new Error(`build-resume harness: step ${rec.step}: no build-control request to acknowledge`)
      frame.payload.control_request_id = last.request_id
      socketFor(step).serverMessage(JSON.stringify(frame))
    },
    // The reconnect answer Director gives for the handshake the page actually made (skip_history or not).
    async reconnect(step) {
      const socket = socketFor(step)
      const skip = /[?&]skip_history=true/.test(socket.url)
      call('director.reconnect', [{ skip_history: skip }])
      for (const frame of fixture.frames[skip ? step.skip : step.send]) { socket.serverMessage(JSON.stringify(frame)); await settle() }
    },
    async click(step) {
      const node = findButton(step.text)
      if (node.props.disabled) { rec.failures.push(`step ${rec.step}: "${step.text}" is disabled`); return }
      call('ribbon.click', [step.text])
      await node.props.onClick?.({ type: 'click', preventDefault() {}, stopPropagation() {} })
    },
    // The Stop confirm dialog's own action button ("Stop"), as PauseStopControl renders it.
    async confirm() {
      const hit = buttons().filter(node => node.props?.['data-harness-dialog'] === 'action')
      if (hit.length !== 1) throw new Error(`build-resume harness: step ${rec.step}: ${hit.length} open confirm dialog(s)`)
      call('ribbon.confirm', [textOf(hit[0]).trim()])
      await hit[0].props.onClick?.({ type: 'click', preventDefault() {}, stopPropagation() {} })
    },
    async typed(step) {
      call('page.typed', [step.text])
      const ok = await probe.latest.ws.sendMessageWhenConnected(step.text, undefined, 0, {}, undefined, () => true)
      if (ok !== true) rec.failures.push(`step ${rec.step}: the typed turn was not delivered`)
    },
    async director(step) {
      for (const frame of fixture.frames[director === 'on' ? step.on : step.off]) { socketFor(step).serverMessage(JSON.stringify(frame)); await settle() }
    },
    async advance(step) { await advance(step.ms) },
    async unmount() { await unmount() },
    // A reload in the same tab keeps sessionStorage (the socket hook's session cache and the narration snapshot); a fresh tab has none.
    async mount(step) { if (step.freshTab) env.sessionStorage.clear(); await mount() },
    // hooks/use-builder-session.ts: the database row's deck and chat rows reach the hook through restoreMessages before it connects.
    // The row is what the page saved from Director's presentation_url (onSessionStateChange: final deck, stage 6, its slide count).
    async restore() {
      const saved = [...rec.calls].reverse().find(item => item.name === 'hook.onSessionStateChange' && item.args[0]?.currentStage === 6)?.args[0]
      if (!saved) throw new Error(`build-resume harness: step ${rec.step}: the page never saved a final deck`)
      const row = { id: session.id, finalPresentationUrl: saved.presentationUrl, finalPresentationId: saved.presentationId, slideCount: saved.slideCount,
        currentStage: saved.currentStage, strawmanPreviewUrl: null, strawmanPresentationId: null, blankPresentationUrl: null, blankPresentationId: null,
        stateCache: null, messages: [] }
      const sessionState = sources.compiled.restoredSessionState({ session: row, process: env.globals.process })
      await sources.compiled.restoreBlock({
        session: row, sessionState, restoreMessages: probe.latest.ws.restoreMessages, setUserMessages: list => probe.latest.setUserMessages(list),
        userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef, persistedMessageIdsRef: { current: new Set() },
        setIsResumedSession: noop, hasSeenWelcomeRef: refs.hasSeenWelcomeRef, attachmentsFromPayload,
        debugLog: noop, STUDIO_VOICE_INTERACTIVE_ENABLED: false,
        process: env.globals.process, Date: env.globals.Date, console: env.console,
      })()
      call('session.restore', [{ finalPresentationUrl: row.finalPresentationUrl, currentStage: row.currentStage }])
    },
    async checkpoint(step) { rec.checkpoints.push(digest(step.label)) },
    async expect(step) {
      const want = step[`${flag}/${director}`] || step[flag] || {}
      const d = digest(step.label || `expect@${rec.step}`)
      const check = (label, ok) => { if (!ok) rec.failures.push(`step ${rec.step} (${flag}/${director}): ${label}`) }
      if (want.phase !== undefined) check(`phase ${d.narration.phase} === ${want.phase}`, d.narration.phase === want.phase)
      if (want.active !== undefined) check(`active ${d.narration.active} === ${want.active}`, d.narration.active === want.active)
      if (want.ribbon !== undefined) check(`ribbon ${d.view.ribbon} === ${want.ribbon}`, d.view.ribbon === want.ribbon)
      if (want.button !== undefined) check(`button "${want.button}" (buttons: ${d.view.buttons.map(b => b.text).join(' | ') || 'none'})`, d.view.buttons.some(b => b.text === want.button && !b.disabled))
      if (want.noButton !== undefined) check(`no button "${want.noButton}"`, !d.view.buttons.some(b => b.text === want.noButton))
      if (want.headlineIncludes !== undefined) check(`ribbon text ${JSON.stringify(d.view.headline)} includes ${JSON.stringify(want.headlineIncludes)}`, (d.view.headline || '').includes(want.headlineIncludes))
      if (want.slidesDone !== undefined) check(`slidesDone ${d.narration.slidesDone} === ${want.slidesDone}`, d.narration.slidesDone === want.slidesDone)
      if (want.finalUrl !== undefined) check(`finalUrl ${d.deck.finalUrl} === ${want.finalUrl}`, d.deck.finalUrl === want.finalUrl)
      if (want.buildId !== undefined) check(`buildId ${d.narration.buildId} === ${want.buildId}`, d.narration.buildId === want.buildId)
    },
  }

  await mount()
  for (const [index, step] of steps.entries()) {
    rec.step = index
    if (!ops[step.op]) throw new Error(`fixture ${fixture.name} / ${scenario}: unknown op "${step.op}" at step ${index}`)
    if (step.op !== 'advance') await advance(step.dt ?? DEFAULT_DT)
    await ops[step.op](step)
    await settle()
  }
  if (root_) await unmount()
  const outbound = [
    ...env.handshakes.map(h => JSON.stringify({ handshake: h.socket, at: h.at, url: h.url })),
    ...env.outbound.map(o => JSON.stringify({ socket: o.socket, at: o.at, data: o.data })),
    ...env.clientCloses.map(c => JSON.stringify({ close: c.socket, code: c.code, reason: c.reason })),
  ].join('\n') + '\n'
  return {
    checkpoints: rec.checkpoints, outbound, calls: rec.calls, notes: rec.notes, failures: rec.failures, controlRequests,
    diagnostics: { console: env.consoleEvents.filter(e => e.level === 'error').map(e => e.text), blockedNetwork: env.blockedNetwork, uncaught: env.clock.uncaught },
  }
}
