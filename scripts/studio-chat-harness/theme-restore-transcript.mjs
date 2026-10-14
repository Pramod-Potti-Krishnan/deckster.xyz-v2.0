// THEME-RESET-ON-RECONNECT-P1, Studio half (NEXT_PUBLIC_STUDIO_THEME_RESTORE): runs one theme-restore transcript through the
// REAL Director socket hook (hooks/use-deckster-websocket-v2.ts, unmodified) and the REAL page code that decides whether a
// `set_theme` leaves the tab, on the PR #371 harness (fake socket, virtual clock, offline loader, mini React host).
//
// Page regions, each read from app/builder/page.tsx by AST and run in the harness's strict scope (a name the harness does
// not provide throws): the hook's `onMessage` option, `commitThemeSync`, `clearThemeSyncTimeout`, `handleBuildThemeChange`
// (a user's theme pick), `requestThemeSyncForPresentation`, `getThemeSyncSnapshot` and `ensureThemeReady` (Add Element's
// theme preflight, `elementPreflight` op), `themeSyncTargetRef` (initial and per render), the composer
// theme policy (`composerLibraryEnabled`, `composerThemeBlocked`, `composerThemeFrozen`), `buildThemeProfileMatchesSelection`
// and the deck-theme sync effect (the socket-ready `set_theme`); and, where the tree has them (this change), the restore
// gate's `commitThemeRestoreGate`, `observeThemeRestoreFrame`, `themeRestoreSession` and its reset effect. A tree without
// them (the base) runs exactly its own page, so its output is the flag-off baseline.
//
// Director's side is recorded frames: THEME-2's (director !485 @ 50772ff, real connect handler on a fake socket) and the
// real `_send_theme_sync` acknowledgement template. Each run records every byte the tab put on the socket.
import path from 'node:path'
import React from 'react'
import ts from 'typescript'
import { Root } from './mini-react.mjs'
import { createEnvironment, START_MS } from './fake-env.mjs'
import { createModuleLoader } from './module-loader.mjs'
import { pageSources } from './page-sources.mjs'
import * as extract from './page-extract.mjs'
import { BASE_ENV, PROFILES } from './profiles.mjs'
import { canonical } from './snapshot.mjs'
import { esmPackages, lucideStub } from './esm-packages.mjs'

export const THEME_RESTORE_FLAG = 'NEXT_PUBLIC_STUDIO_THEME_RESTORE'
const DEFAULT_DT = 500

function find(source, predicate, what) {
  let hit = null
  const visit = node => { if (!hit && predicate(node)) hit = node; if (!hit) ts.forEachChild(node, visit) }
  visit(source)
  if (!hit) throw new Error(`theme-restore harness: could not find ${what} in app/builder/page.tsx`)
  return hit
}

const regionCache = new Map()
// The page regions this runner executes, compiled once per tree. `restore` is null for a tree without the restore gate.
export function themeRestoreRegions(root) {
  if (regionCache.has(root)) return regionCache.get(root)
  const page = extract.parseSource(path.join(root, 'app/builder/page.tsx'))
  const anchors = []
  const compile = (label, node) => { anchors.push(extract.anchor(label, node, page)); return extract.compile(node, page, label) }
  const callback = name => {
    const call = extract.findVariableInitializer(page, name)
    if (!ts.isCallExpression(call) || call.expression.getText(page) !== 'useCallback') throw new Error(`theme-restore harness: ${name} is no longer a useCallback`)
    return { fn: compile(`page.${name}`, call.arguments[0]), deps: compile(`page.${name}.deps`, call.arguments[1]) }
  }
  const fnDecl = name => compile(`page.${name}`, find(page, node => ts.isFunctionDeclaration(node) && node.name?.text === name, `function ${name}`))
  const effects = extract.findCalls(page, 'useEffect')
  const effectBy = (label, test) => {
    const call = effects.find(item => test(item.arguments[0].getText(page)))
    if (!call) return null
    return { fn: compile(label, call.arguments[0]), deps: compile(`${label}.deps`, call.arguments[1]) }
  }
  const themeSyncEffect = effectBy('page.themeSyncEffect', text => text.includes('composerThemeBlocked') && text.includes('requestThemeSyncForPresentation(effectivePresentationId)'))
  if (!themeSyncEffect) throw new Error('theme-restore harness: the deck-theme sync effect is gone')
  const targetRef = extract.findVariableInitializer(page, 'themeSyncTargetRef')
  const targetAssign = find(page, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && node.left.getText(page) === 'themeSyncTargetRef.current', '`themeSyncTargetRef.current = {...}`')
  const hasRestore = page.getText().includes('observeThemeRestoreFrame')
  const regions = {
    themeSyncTimeoutMs: compile('page.THEME_SYNC_TIMEOUT_MS', extract.findVariableInitializer(page, 'THEME_SYNC_TIMEOUT_MS')),
    composerLibraryEnabled: compile('page.composerLibraryEnabled', extract.findVariableInitializer(page, 'composerLibraryEnabled')),
    composerThemeBlocked: compile('page.composerThemeBlocked', extract.findVariableInitializer(page, 'composerThemeBlocked')),
    composerThemeFrozen: compile('page.composerThemeFrozen', extract.findVariableInitializer(page, 'composerThemeFrozen')),
    stableStringifyRecord: fnDecl('stableStringifyRecord'),
    buildThemeSelectionsEqual: fnDecl('buildThemeSelectionsEqual'),
    buildThemeProfileMatchesSelection: fnDecl('buildThemeProfileMatchesSelection'),
    commitThemeSync: callback('commitThemeSync'),
    clearThemeSyncTimeout: callback('clearThemeSyncTimeout'),
    handleBuildThemeChange: callback('handleBuildThemeChange'),
    requestThemeSyncForPresentation: callback('requestThemeSyncForPresentation'),
    getThemeSyncSnapshot: callback('getThemeSyncSnapshot'),
    ensureThemeReady: callback('ensureThemeReady'),
    themeSyncTargetInitial: compile('page.themeSyncTargetRef(initial)', targetRef.arguments[0]),
    themeSyncTargetCurrent: compile('page.themeSyncTargetRef.current', targetAssign.right),
    themeSyncEffect,
    restore: hasRestore ? {
      gateInitial: compile('page.themeRestoreGate(initial)', find(page, node => ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
        && node.name.getText(page).startsWith('[themeRestoreGate,'), '`const [themeRestoreGate, ...] = useState(...)`').initializer.arguments[0]),
      commitThemeRestoreGate: callback('commitThemeRestoreGate'),
      observeThemeRestoreFrame: callback('observeThemeRestoreFrame'),
      themeRestoreSession: compile('page.themeRestoreSession', extract.findVariableInitializer(page, 'themeRestoreSession')),
      sessionAssign: compile('page.themeRestoreSessionRef.current', find(page, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && node.left.getText(page) === 'themeRestoreSessionRef.current', '`themeRestoreSessionRef.current = ...`').right),
      resetEffect: effectBy('page.themeRestoreResetEffect', text => text.includes('isFreshThemeRestoreGate')),
    } : null,
  }
  if (hasRestore && !regions.restore.resetEffect) throw new Error('theme-restore harness: the restore gate reset effect is gone')
  const result = { regions, anchors: anchors.sort((a, b) => (a.label < b.label ? -1 : 1)) }
  regionCache.set(root, result)
  return result
}

/**
 * Run one fixture. `mode` 'off' leaves NEXT_PUBLIC_STUDIO_THEME_RESTORE unset; 'on' sets it to "true".
 * Returns { outbound (ndjson text), state (checkpoint digests), calls, notes, setThemes, failures }.
 */
export async function runThemeRestoreTranscript({ root, fixture, mode }) {
  const sources = pageSources(root)
  const { regions: T } = themeRestoreRegions(root)
  const processEnv = { ...BASE_ENV, ...PROFILES.studio, ...(fixture.env || {}), ...(mode === 'on' ? { [THEME_RESTORE_FLAG]: 'true' } : {}) }
  const env = createEnvironment({ processEnv })
  const session = fixture.session
  const authUser = { id: session.userId, email: `${session.userId}@example.invalid` }
  const loader = createModuleLoader({
    root, globals: env.globals,
    // One React for the host and the repo code, also when `root` is another checkout (the base, for the flag-off baseline).
    stubs: { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React) },
    fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) } },
  })
  const hookModule = loader.load('hooks/use-deckster-websocket-v2.ts')
  const themeSyncLib = loader.load('lib/theme-sync.ts')
  const themeBuilderLib = loader.load('lib/theme-builder.ts')
  const { themeFontsEqual } = loader.load('lib/theme-fonts.ts')
  const { composerThemeSyncBlocked } = loader.load('lib/composer-theme-policy.ts')
  const { getLayoutServiceUrl } = loader.load('lib/layout-service-client.ts')
  const { resolveEffectivePresentation } = loader.load('lib/builder-presentation-ownership.ts')
  const restoreLib = T.restore ? loader.load('lib/studio-theme-restore.ts') : {}
  const voice = loader.load('lib/studio-voice-interactive.ts')
  const { attachmentsFromPayload } = loader.load('lib/user-message-attachments.ts')

  // ---- recorders ---------------------------------------------------------------------------------------------------
  const rec = { step: -1, calls: [], checkpoints: [], notes: [], failures: [] }
  const PREFLIGHT_CAP_MS = 30_000
  let lastPreflight = null
  const call = (name, args) => rec.calls.push({ step: rec.step, at: env.clock.now() - START_MS, name, args: canonical(args) })
  const toasts = []
  const toast = value => { toasts.push(value); call('page.toast', [value]) }
  const acked = new Set()
  const sentThemes = () => env.outbound.filter(o => o.data.startsWith('{"type":"set_theme"')).map(o => ({ socket: o.socket, at: o.at, ...JSON.parse(o.data).data }))

  const pageInputs = { currentSessionId: session.currentSessionId === undefined ? session.id : session.currentSessionId }
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
  const saveSessionOnFirstAction = () => call('page.saveSessionOnFirstAction', [])

  function PageProbe() {
    const R = React
    const [userMessages, setUserMessages] = R.useState([])
    const [isGeneratingFinal, setIsGeneratingFinal] = R.useState(false)
    const [templateReuseAwaitingInput, setTemplateReuseAwaitingInput] = R.useState(false)
    refs.isGeneratingFinalRef.current = isGeneratingFinal
    // page.tsx: the deck-theme state next to the hook (buildThemeSelection starts on Auto, as useState does in a fresh tab).
    const [buildThemeSelection, setBuildThemeSelection] = R.useState({ mode: 'auto' })
    const [activeBuildThemeProfile, setActiveBuildThemeProfile] = R.useState(null)
    const [themeSync, setThemeSync] = R.useState(themeSyncLib.IDLE_THEME_SYNC)
    const themeSyncRef = R.useRef(themeSync)
    themeSyncRef.current = themeSync
    const theme = {
      ...themeSyncLib, themeSelectionFingerprint: themeBuilderLib.themeSelectionFingerprint, themeFontsEqual, composerThemeSyncBlocked, getLayoutServiceUrl,
      ...restoreLib,
      process: env.globals.process, crypto: env.crypto, console: env.console, setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout,
      buildThemeSelection, setBuildThemeSelection, activeBuildThemeProfile, setActiveBuildThemeProfile, themeSync, setThemeSync, themeSyncRef,
      latestThemeSyncRequestRef: R.useRef(null), latestThemeSyncKeyRef: R.useRef(null), themeSyncTimeoutRef: R.useRef(null),
      themeSelectionChangedLocallyRef: R.useRef(false), templateSelectionLockedRef: R.useRef(false), templateModeOn: false,
      toast, saveSessionOnFirstAction,
    }
    theme.THEME_SYNC_TIMEOUT_MS = T.themeSyncTimeoutMs(theme)
    theme.composerLibraryEnabled = T.composerLibraryEnabled(theme)
    theme.stableStringifyRecord = T.stableStringifyRecord(theme)
    theme.buildThemeSelectionsEqual = T.buildThemeSelectionsEqual(theme)
    theme.buildThemeProfileMatchesSelection = T.buildThemeProfileMatchesSelection(theme)
    for (const name of ['commitThemeSync', 'clearThemeSyncTimeout']) theme[name] = R.useCallback(T[name].fn(theme), T[name].deps(theme))
    if (T.restore) {
      const [themeRestoreGate, setThemeRestoreGate] = R.useState(T.restore.gateInitial(theme))
      Object.assign(theme, { themeRestoreGate, setThemeRestoreGate, themeRestoreGateRef: R.useRef(themeRestoreGate), themeRestoreSessionRef: R.useRef(null) })
      theme.commitThemeRestoreGate = R.useCallback(T.restore.commitThemeRestoreGate.fn(theme), T.restore.commitThemeRestoreGate.deps(theme))
      theme.observeThemeRestoreFrame = R.useCallback(T.restore.observeThemeRestoreFrame.fn(theme), T.restore.observeThemeRestoreFrame.deps(theme))
    }
    theme.handleBuildThemeChange = R.useCallback(T.handleBuildThemeChange.fn(theme), T.handleBuildThemeChange.deps(theme))

    const sessionApi = {
      userMessages, setUserMessages, isLoadingSession: false,
      answeredActionsRef: refs.answeredActionsRef, userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef,
      hasSeenWelcomeRef: refs.hasSeenWelcomeRef, hasTitleFromUserMessageRef: { current: false }, hasTitleFromPresentationRef: { current: false },
      markStudioUserIntent: () => {}, hasStudioUserIntent: () => false, studioFrontendTranscriptReceipt: null,
    }
    const base = {
      React: R, process: env.globals.process, console: env.console, Date: env.globals.Date, crypto: env.crypto,
      setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout, requestAnimationFrame: env.clock.requestAnimationFrame,
      studioShell: env.globals.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true', features: { immediateConnection: true },
      STUDIO_VOICE_INTERACTIVE_ENABLED: voice.STUDIO_VOICE_INTERACTIVE_ENABLED,
      currentSessionId: pageInputs.currentSessionId, researchEnabled: false, webSearchEnabled: false, extendedGenerationEnabled: true, knowledgeGraphEnabled: false,
      canUseKnowledgeGraph: false, showKnowledgeGraphToggle: false, sessionStoreName: null, buildSendOptions: {}, deckIdentity: null,
      askGatesLocked: false, suppressEphemeral: false, activeTemplate: null,
      user: authUser, toast, persistence: { queueMessage: () => {}, generateTitle: text => text.slice(0, 50), updateMetadata: () => {} }, session: sessionApi,
      ...refs, isGeneratingFinal, setIsGeneratingFinal, templateReuseAwaitingInput, setTemplateReuseAwaitingInput,
      inputMessage: '', setInputMessage: () => {}, pendingActionInput: null, setPendingActionInput: () => {}, setWorkflowBrief: () => {},
      awaitingDirectorReply: false, uploadedFiles: [], quota: { status: null }, STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: false,
      studioOutlineCanvas: undefined, turnContext: undefined, effectivePresentationUrl: undefined,
      // The page's real theme_sync collaborators (the #371 chat fixtures stub them; these transcripts are about them).
      latestThemeSyncRequestRef: theme.latestThemeSyncRequestRef, themeSyncRef, clearThemeSyncTimeout: theme.clearThemeSyncTimeout,
      commitThemeSync: theme.commitThemeSync, themeSelectionChangedLocallyRef: theme.themeSelectionChangedLocallyRef,
      isThemeSyncTerminal: themeSyncLib.isThemeSyncTerminal, applyThemeSyncResponse: themeSyncLib.applyThemeSyncResponse,
      ...(T.restore ? { observeThemeRestoreFrame: theme.observeThemeRestoreFrame } : {}),
    }
    const hookOptions = {}
    for (const [name, evaluate] of Object.entries(sources.compiled.hookOptions)) hookOptions[name] = evaluate(base)
    const noop = () => {}
    const options = {
      ...hookOptions,
      onSessionStateChange: noop, onSlideComposeProgress: noop, onSlideBuilt: noop, onSlideComposeReady: noop, onSlideComposeFailed: noop,
      onElementDirective: noop, onSessionDirective: noop, onBuildPhase: noop, onBuildEvent: noop, onBuildStateSync: noop,
    }
    options.onMessage = message => {
      call('page.onMessage', [{ type: message.type, ...(message.type === 'theme_sync' ? { status: message.payload?.status, request_id: message.payload?.request_id } : {}) }])
      return sources.compiled.onMessage(base)(message)
    }
    const ws = hookModule.useDecksterWebSocketV2(options)
    R.useEffect(() => { sources.compiled.cacheSyncEffect({ userMessages, updateCacheUserMessages: ws.updateCacheUserMessages })() }, [userMessages, ws.updateCacheUserMessages])

    // After the hook, in page order: the composer policy, the displayed presentation, the theme-sync target, the request.
    Object.assign(theme, {
      isReady: ws.isReady, composerAdoption: ws.composerAdoption, composerThemeResolved: ws.composerThemeResolved, studioShell: base.studioShell,
      currentSessionId: pageInputs.currentSessionId, wsSessionId: ws.sessionId,
      // The page's default branch (no final_fill, no Template Mode) through the real resolver.
      effectivePresentationId: resolveEffectivePresentation({ livePresentationUrl: ws.presentationUrl, livePresentationId: ws.presentationId, liveSlideCount: ws.slideCount, override: null }).presentationId,
    })
    // The hook's own sendThemeSelection (stable, as in the page), recorded.
    theme.sendThemeSelection = R.useCallback((selection, requestId, presentationId) => {
      const ok = ws.sendThemeSelection(selection, requestId, presentationId)
      call('hook.sendThemeSelection', [selection, requestId, presentationId, ok])
      return ok
    }, [ws.sendThemeSelection])
    theme.composerThemeBlocked = T.composerThemeBlocked(theme)
    theme.composerThemeFrozen = T.composerThemeFrozen(theme)
    theme.themeSyncTargetRef = R.useRef(T.themeSyncTargetInitial(theme))
    theme.themeSyncTargetRef.current = T.themeSyncTargetCurrent(theme)
    theme.requestThemeSyncForPresentation = R.useCallback(T.requestThemeSyncForPresentation.fn(theme), T.requestThemeSyncForPresentation.deps(theme))
    // Add Element's theme preflight (page.tsx ensureThemeReady -> lib/theme-sync.ts waitForAuthoritativeTheme, unmodified).
    theme.getThemeSyncSnapshot = R.useCallback(T.getThemeSyncSnapshot.fn(theme), T.getThemeSyncSnapshot.deps(theme))
    theme.ensureThemeReady = R.useCallback(T.ensureThemeReady.fn(theme), T.ensureThemeReady.deps(theme))
    if (T.restore) {
      theme.themeRestoreSession = T.restore.themeRestoreSession(theme)
      theme.themeRestoreSessionRef.current = T.restore.sessionAssign(theme)
      R.useEffect(T.restore.resetEffect.fn(theme), T.restore.resetEffect.deps(theme))
    }
    R.useEffect(T.themeSyncEffect.fn(theme), T.themeSyncEffect.deps(theme))
    probe.latest = { ws, theme, setUserMessages }
    return null
  }

  // ---- driver --------------------------------------------------------------------------------------------------------
  let root_ = null
  const settle = async () => {
    for (let quiet = 0, rounds = 0; quiet < 2; rounds++) {
      if (rounds > 80) throw new Error('theme-restore harness: the page did not settle')
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
    if (!socket) throw new Error(`theme-restore harness: step ${rec.step} (${step.op}) has no socket`)
    return socket
  }
  const digest = label => {
    const { ws, theme } = probe.latest
    return {
      label, virtualMs: env.clock.now() - START_MS,
      connection: { connected: ws.connected, generation: ws.connectionGeneration, sockets: env.sockets.length },
      deck: { presentationId: ws.presentationId, effectivePresentationId: theme.effectivePresentationId },
      messages: ws.messages.map(m => `${m.message_id} | ${m.type}`),
      buildThemeSelection: theme.buildThemeSelection, activeBuildThemeProfile: theme.activeBuildThemeProfile, themeSync: theme.themeSync,
      themeSelectionChangedLocally: theme.themeSelectionChangedLocallyRef.current,
      setThemeSent: sentThemes().map(s => ({ socket: s.socket, at: s.at, theme: s.theme })),
      toasts: toasts.length,
      // The gate exists only with this change and is reported only with the flag on, so a flag-off digest compares with the base.
      ...(mode === 'on' && theme.themeRestoreGate ? { gate: theme.themeRestoreGate } : {}),
    }
  }
  const ops = {
    async ensureConnected() { probe.latest.ws.ensureConnected() },
    async open(step) { socketFor(step).serverOpen() },
    async frame(step) { socketFor(step).serverMessage(JSON.stringify(step.frame)) },
    async frames(step) { for (const frame of step.frames) { socketFor(step).serverMessage(JSON.stringify(frame)); await settle() } },
    async close(step) { socketFor(step).serverClose(step.code ?? 1006, step.reason ?? '') },
    async advance(step) { await advance(step.ms) },
    async unmount() { await unmount() },
    // A fresh tab: new page instance, empty sessionStorage (it is per tab).
    async mount(step) { if (step.freshTab) env.sessionStorage.clear(); await mount() },
    // The Builder's session load before it connects (hooks/use-builder-session.ts, PR #371's restore): the database row's deck
    // and chat rows reach the hook through restoreMessages, so the page knows the presentation before Director answers.
    async restore(step) {
      const row = step.session
      const sessionState = sources.compiled.restoredSessionState({ session: row, process: env.globals.process })
      await sources.compiled.restoreBlock({
        session: row, sessionState, restoreMessages: probe.latest.ws.restoreMessages, setUserMessages: list => probe.latest.setUserMessages(list),
        userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef, persistedMessageIdsRef: { current: new Set() },
        setIsResumedSession: () => {}, hasSeenWelcomeRef: refs.hasSeenWelcomeRef, attachmentsFromPayload,
        debugLog: () => {}, STUDIO_VOICE_INTERACTIVE_ENABLED: voice.STUDIO_VOICE_INTERACTIVE_ENABLED,
        process: env.globals.process, Date: env.globals.Date, console: env.console,
      })()
    },
    // Add Element in this tab: the page's element-generation theme preflight. Virtual time runs in 50 ms steps until it answers
    // (at most PREFLIGHT_CAP_MS), so a preflight that waits on Director shows as the time it waited; one that proceeds at once
    // answers in 0 ms.
    async elementPreflight() {
      const { theme } = probe.latest
      const startedAt = env.clock.now()
      let outcome = null
      call('page.ensureThemeReady', [theme.effectivePresentationId])
      theme.ensureThemeReady(theme.effectivePresentationId).then(
        result => { outcome = { result, at: env.clock.now() } },
        error => { outcome = { error: String(error?.message ?? error).slice(0, 160), at: env.clock.now() } },
      )
      await settle()
      for (let waited = 0; !outcome && waited < PREFLIGHT_CAP_MS; waited += 50) await advance(50)
      if (!outcome) lastPreflight = { settled: false, ready: false, code: 'pending', elapsedMs: env.clock.now() - startedAt }
      else if (outcome.error) lastPreflight = { settled: true, ready: false, code: `threw: ${outcome.error}`, elapsedMs: outcome.at - startedAt }
      else lastPreflight = { settled: true, ready: outcome.result.ready === true, code: outcome.result.ready ? outcome.result.source : outcome.result.code, elapsedMs: outcome.at - startedAt }
      rec.notes.push(`step ${rec.step}: element preflight ${lastPreflight.settled ? '' : 'still pending, '}${lastPreflight.ready ? 'ready' : 'not ready'} (${lastPreflight.code}) after ${lastPreflight.elapsedMs} ms virtual`)
    },
    async themePick(step) { call('page.handleBuildThemeChange', [step.theme]); probe.latest.theme.handleBuildThemeChange(step.theme) },
    // Director's real _send_theme_sync frames (fixture.ackTemplate) for the newest set_theme this socket sent and Director has
    // not answered yet (Director answers on the socket that asked).
    async themeAck(step) {
      const socket = socketFor(step)
      const pending = sentThemes().filter(s => s.socket === socket.id && !acked.has(s.request_id))
      const last = pending[pending.length - 1]
      if (!last) { rec.notes.push(`step ${rec.step}: themeAck skipped, no unanswered set_theme`); return }
      acked.add(last.request_id)
      for (const status of step.statuses || ['syncing', 'applied']) {
        const template = fixture.ackTemplate.find(frame => frame.payload.status === status)
        const frame = JSON.parse(JSON.stringify(template))
        frame.session_id = step.sessionId ?? session.id
        Object.assign(frame.payload, { request_id: last.request_id, presentation_id: last.presentation_id, theme: last.theme })
        socket.serverMessage(JSON.stringify(frame))
        await settle()
      }
    },
    async checkpoint(step) { rec.checkpoints.push(digest(step.label)) },
    async expect(step) {
      const want = step[mode] || {}
      const { theme } = probe.latest
      const check = (label, ok) => { if (!ok) rec.failures.push(`step ${rec.step} (${mode}): ${label}`) }
      if (want.setTheme !== undefined) check(`set_theme sent ${sentThemes().length} === ${want.setTheme}`, sentThemes().length === want.setTheme)
      if (want.lastSetTheme !== undefined) check(`last set_theme theme ${JSON.stringify(sentThemes().at(-1)?.theme)} === ${JSON.stringify(want.lastSetTheme)}`, JSON.stringify(sentThemes().at(-1)?.theme) === JSON.stringify(want.lastSetTheme))
      if (want.selection !== undefined) check(`selection ${JSON.stringify(theme.buildThemeSelection)} === ${JSON.stringify(want.selection)}`, JSON.stringify(theme.buildThemeSelection) === JSON.stringify(want.selection))
      if (want.themeSyncStatus !== undefined) check(`themeSync.status ${theme.themeSync.status} === ${want.themeSyncStatus}`, theme.themeSync.status === want.themeSyncStatus)
      if (want.gatePhase !== undefined) check(`gate ${theme.themeRestoreGate?.phase} === ${want.gatePhase}`, theme.themeRestoreGate?.phase === want.gatePhase)
      if (want.locallyChanged !== undefined) check(`themeSelectionChangedLocally ${theme.themeSelectionChangedLocallyRef.current} === ${want.locallyChanged}`, theme.themeSelectionChangedLocallyRef.current === want.locallyChanged)
      if (want.themeSyncRequestId !== undefined) check(`themeSync.requestId ${theme.themeSync.requestId} === ${want.themeSyncRequestId}`, theme.themeSync.requestId === want.themeSyncRequestId)
      // The committed state is fingerprinted with the given selection (the lib's own fingerprint, as the deck-theme effect compares).
      if (want.themeSyncFingerprintOf !== undefined) check(`themeSync.themeFingerprint ${theme.themeSync.themeFingerprint} === fingerprint of ${JSON.stringify(want.themeSyncFingerprintOf)}`, theme.themeSync.themeFingerprint === themeBuilderLib.themeSelectionFingerprint(want.themeSyncFingerprintOf))
      if (want.activeProfile !== undefined) check(`activeBuildThemeProfile ${JSON.stringify(theme.activeBuildThemeProfile)} === ${JSON.stringify(want.activeProfile)}`, JSON.stringify(theme.activeBuildThemeProfile) === JSON.stringify(want.activeProfile))
      if (want.themeSyncError !== undefined) check(`themeSync.error ${JSON.stringify(theme.themeSync.error)} === ${JSON.stringify(want.themeSyncError)}`, theme.themeSync.error === want.themeSyncError)
      if (want.preflightReady !== undefined) check(`element preflight ready ${lastPreflight?.ready} (${lastPreflight?.code}) === ${want.preflightReady}`, lastPreflight?.ready === want.preflightReady)
      if (want.preflightSource !== undefined) check(`element preflight source ${lastPreflight?.code} === ${want.preflightSource}`, lastPreflight?.code === want.preflightSource)
      if (want.preflightElapsedMs !== undefined) check(`element preflight answered after ${lastPreflight?.elapsedMs} ms virtual === ${want.preflightElapsedMs}`, lastPreflight?.elapsedMs === want.preflightElapsedMs)
      if (want.sockets !== undefined) check(`sockets ${env.sockets.length} === ${want.sockets}`, env.sockets.length === want.sockets)
    },
  }

  await mount()
  for (const [index, step] of fixture.steps.entries()) {
    rec.step = index
    if (!ops[step.op]) throw new Error(`fixture ${fixture.name}: unknown op "${step.op}" at step ${index}`)
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
    outbound, state: rec.checkpoints, calls: rec.calls, notes: rec.notes, failures: rec.failures, setThemes: sentThemes(),
    diagnostics: { console: env.consoleEvents.filter(e => e.level === 'error').map(e => e.text), blockedNetwork: env.blockedNetwork, uncaught: env.clock.uncaught },
  }
}
