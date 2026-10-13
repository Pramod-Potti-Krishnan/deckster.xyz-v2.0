// Runs one recorded transcript against the real Director chat code and returns a snapshot
// (a map of file name -> text) describing everything observable:
//   outbound.ndjson   every byte the client put on the fake socket (+ handshake URLs)
//   keys.json         ordered React keys of MessageList + ordered hook message ids, per checkpoint
//   calls.json        every handler / hook-callback invocation with its arguments
//   state.json        hook + page state digest per checkpoint
//   cache.json        the session cache (sessionStorage) as the hook left it
//   markup/*.html     rendered chat markup + header/notice ("chrome") per checkpoint; markup.json holds hashes
//   env.json, meta.json   profile environment, fixture hash, diagnostics (console errors, blocked network)
import crypto from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Root, hostNodes, keyedChildren, textOf, toElements } from './mini-react.mjs'
import { createEnvironment, START_MS } from './fake-env.mjs'
import { createModuleLoader } from './module-loader.mjs'
import { pageSources } from './page-sources.mjs'
import { pageThemeSources } from './page-theme-sources.mjs'
import { evaluateProps } from './page-extract.mjs'
import { BASE_ENV } from './profiles.mjs'
import { canonical, pretty, prettyHtml, sha256 } from './snapshot.mjs'
import { esmPackages, lucideStub } from './esm-packages.mjs'

const DEFAULT_DT = 500
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'checkpoint'

export async function runTranscript({ root, fixture, profile, processEnv: callerEnv, includeMarkup = true, crossCheck = false }) {
  // A fixture's own "env" (the element-preflight fixtures) sits under whatever the caller passes, so every runner replays it the same way
  // and a caller's --env can still override it. Fixtures without "env" get exactly the caller's environment, as before.
  const processEnv = fixture.env ? { ...fixture.env, ...callerEnv } : callerEnv
  const sources = pageSources(root)
  const env = createEnvironment({ processEnv: { ...BASE_ENV, ...processEnv } })
  const session = fixture.session
  const authUser = { id: session.userId, email: `${session.userId}@example.invalid` }
  // Fixtures with `composer: true` also render the real composer (ChatInput). Its popups are Radix portals that need providers the offline
  // host does not model (and no transcript opens them), so those leaf components are replaced by inert stand-ins; everything ChatInput itself
  // renders and every handler it owns is the repo's own code.
  const composerOn = Boolean(fixture.composer)
  const inert = () => null
  const passChildren = ({ children }) => children ?? null
  const composerStubs = composerOn ? {
    'components/ui/dropdown-menu': new Proxy({ __esModule: true }, { get: (target, key) => key in target ? target[key] : typeof key !== 'string' ? undefined : (key === 'DropdownMenu' || key === 'DropdownMenuTrigger' ? passChildren : inert) }),
    'components/ui/switch': { __esModule: true, Switch: inert },
    'components/builder/studio-composer-hint': { __esModule: true, StudioComposerHint: passChildren },
    'components/builder/template-picker': { __esModule: true, TemplatePicker: inert },
    'components/builder/studio-theme-menu': { __esModule: true, StudioThemeMenu: inert },
  } : {}
  const loader = createModuleLoader({
    root, globals: env.globals,
    stubs: { ...(await esmPackages(root)), 'lucide-react': lucideStub(React) },
    fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) }, ...composerStubs },
  })
  const hookModule = loader.load('hooks/use-deckster-websocket-v2.ts')
  const { MessageList } = loader.load('components/builder/message-list.tsx')
  const { StudioDirectorHeader } = loader.load('components/builder/chat/studio-director-header.tsx')
  const { StudioDirectorNotice } = loader.load('components/builder/studio-director-notice.tsx')
  const ChatInput = composerOn ? loader.load('components/builder/chat-input.tsx').ChatInput : null
  const templateHelpers = composerOn ? loader.load('hooks/use-templates.ts') : {}
  const composerContextLib = composerOn ? loader.load('lib/studio-chat-composer-context.ts') : {}
  const { attachmentsFromPayload } = loader.load('lib/user-message-attachments.ts')
  const voice = loader.load('lib/studio-voice-interactive.ts')
  // Fixtures with `"elementPreflight": true` (PASS2-J3 P0) also run the page's deck-theme preflight and the REAL Add Element
  // generation hook (page-theme-sources.mjs, `useTextLabsGeneration`), against a synthetic Text Labs that only answers them.
  const preflightOn = Boolean(fixture.elementPreflight)
  const themeSources = preflightOn ? pageThemeSources(root) : null
  const themeLibs = preflightOn ? {
    ...loader.load('lib/theme-sync.ts'),
    themeSelectionFingerprint: loader.load('lib/theme-builder.ts').themeSelectionFingerprint,
    composerThemeSyncBlocked: loader.load('lib/composer-theme-policy.ts').composerThemeSyncBlocked,
    getLayoutServiceUrl: loader.load('lib/layout-service-client.ts').getLayoutServiceUrl,
  } : null
  const resolveEffectivePresentation = preflightOn ? loader.load('lib/builder-presentation-ownership.ts').resolveEffectivePresentation : null
  const generationHook = preflightOn ? loader.load('hooks/use-textlabs-generation.ts') : null
  const textLabsRequests = []
  if (preflightOn) {
    const base = processEnv.NEXT_PUBLIC_ELEMENTOR_URL
    if (!base) throw new Error('harness: an elementPreflight fixture needs NEXT_PUBLIC_ELEMENTOR_URL in its "env"')
    env.textLabs = {
      base,
      answer: async (url, init) => {
        const body = typeof init?.body === 'string' ? init.body : null
        textLabsRequests.push({ at: env.clock.now() - START_MS, method: init?.method || 'GET', path: url.slice(base.length), body: body ? JSON.parse(body) : null })
        call('textlabs.request', [{ method: init?.method || 'GET', path: url.slice(base.length) }])
        const answer = fixture.textLabsResponse || { success: true, elements: [] }
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(answer)) }
      },
    }
  }

  // ---- recorders ----------------------------------------------------------
  const rec = { step: -1, calls: [], steps: [], checkpoints: [], markup: {}, notes: [], crossCheck: [] }
  const call = (name, args) => rec.calls.push({ step: rec.step, name, args: canonical(args) })
  const pendingWork = new Set()
  // Wrap a handler so each invocation is recorded and any promise it returns is awaited by the
  // step that triggered it. By default a fresh wrapper is made per render, exactly like the
  // page's inline callbacks. With fixture.stableHandlers the wrapper identity is kept fixed
  // (still calling the latest function) so effects keyed on handler identity are not re-run.
  const latestByName = new Map(), stableByName = new Map()
  const track = (name, fn) => {
    if (typeof fn !== 'function') return fn
    const tracked = function (...args) {
      call(name, args)
      const target = fixture.stableHandlers ? latestByName.get(name) : fn
      const result = target.apply(this, args)
      if (result && typeof result.then === 'function') {
        const watched = Promise.resolve(result).catch(error => { rec.notes.push(`${name} rejected: ${String(error?.message ?? error).slice(0, 160)}`) })
        pendingWork.add(watched)
        watched.finally(() => pendingWork.delete(watched))
      }
      return result
    }
    if (!fixture.stableHandlers) return tracked
    latestByName.set(name, fn)
    if (!stableByName.has(name)) stableByName.set(name, tracked)
    return stableByName.get(name)
  }
  const macrotask = env.macrotask

  // ---- page-owned state (what app/builder/page.tsx keeps outside the hook) -------------
  const pageInputs = {
    currentSessionId: session.currentSessionId ?? session.id,
    researchEnabled: false, webSearchEnabled: false, extendedGenerationEnabled: true, knowledgeGraphEnabled: false,
    canUseKnowledgeGraph: false, showKnowledgeGraphToggle: false, sessionStoreName: null, buildSendOptions: {}, deckIdentity: null,
    askGatesLocked: false, suppressEphemeral: false, activeTemplate: null,
    // What the composer's prop expressions read from the page (fixtures with `composer: true`); each is a plain value or an inert handler.
    ...(composerOn ? {
      savedThemeWorkflowId: null, workflowKey: null, studioComposerDeckOpen: undefined, researchSettingsLocked: false,
      knowledgeGraphAccess: 'locked', templateBuilderEnabled: false, composerLibraryEnabled: false, generationSelectionsLocked: false,
      buildThemeSelection: { mode: 'auto' }, activeBuildThemeProfileForSelection: null, themeSync: { status: 'idle', error: null }, currentSlideIndex: 0,
    } : {}),
    ...(fixture.page || {}),
  }
  const makeRefs = () => ({
    answeredActionsRef: { current: new Set() }, userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() },
    hasSeenWelcomeRef: { current: false }, messagesEndRef: { current: null }, textareaRef: { current: null },
    actionSubmissionPendingRef: { current: new Set() }, questionSubmissionPendingRef: { current: false }, isExecutingSendRef: { current: false },
    isGeneratingFinalRef: { current: false },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: session.id, userId: session.userId, routeSessionId: session.id, freshRouteSourceSessionId: null } },
    transcriptScopeRef: { current: { userIntentSeen: false, generation: 1 } },
  })
  let refs = makeRefs()
  const toasts = []
  const persistence = {
    queueMessage: (...args) => call('page.persistence.queueMessage', args),
    generateTitle: text => text.slice(0, 50), updateMetadata: (...args) => call('page.persistence.updateMetadata', args),
  }

  // ---- elementPreflight: the Add Element panel's collaborators (recording stand-ins; the generation hook itself is real) ----
  // The panel is open on the blank placeholder the gallery card created; the Layout viewer acknowledges every command.
  const elementBlank = { elementId: 'synthetic-blank-element-1', componentType: fixture.elementType || 'TEXT_BOX', slideIndex: 0, startCol: 5, startRow: 4, width: 10, height: 6, status: 'blank' }
  const elementPanelState = { blankElementId: elementBlank.elementId, editElementId: null, isOpen: true, elementType: elementBlank.componentType, isGenerating: false,
    error: null, retryStrategy: null, mode: 'generate', refineContext: null, researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false }
  const elementPanel = Object.assign(elementPanelState, {
    setIsGenerating: value => { elementPanelState.isGenerating = value; call('panel.setIsGenerating', [value]) },
    setError: value => { elementPanelState.error = value; call('panel.setError', [value]) },
    setRetryStrategy: value => { elementPanelState.retryStrategy = value; call('panel.setRetryStrategy', [value]) },
    getSnapshot: () => ({ ...elementPanelState }), getIntentRevision: () => 0,
    closePanel: () => { elementPanelState.isOpen = false; call('panel.closePanel', []) },
    rememberDraftForElement: () => {}, openPanelForElement: () => {}, openPanelForRefine: () => {}, changeElementType: () => {},
    resumePanelForElement: () => call('panel.resumePanelForElement', []), completeBlankReplacement: () => call('panel.completeBlankReplacement', []),
  })
  const elementBlanks = {
    getElement: id => (id === elementBlank.elementId ? elementBlank : undefined), updatePosition: () => {}, updateGenerationMetadata: () => {},
    setStatus: (id, status) => { elementBlank.status = status; call('blank.setStatus', [id, status]) },
    removeElement: id => { if (id === elementBlank.elementId) elementBlank.status = 'removed'; call('blank.removeElement', [id]) }, addElement: info => call('blank.addElement', [info.elementId]), trackElement: id => call('blank.trackElement', [id]),
  }
  const elementSession = { ensureSession: async () => { call('textlabs.ensureSession', []); return 'synthetic-textlabs-session' } }
  let insertedElements = 0
  const sendElementCommand = async (action, args = {}) => {
    call('layout.sendElementCommand', [action, { elementId: args.elementId ?? null }])
    if (action === 'getElementGeometry') return { success: true, action, elementId: args.elementId, position: { gridRow: '4/10', gridColumn: '5/15' } }
    if (action.startsWith('insert') || action.startsWith('upsert')) return { success: true, elementId: `synthetic-generated-${++insertedElements}` }
    if (action === 'getElementMutationReceipt') return { status: 'unknown' }
    if (action === 'getElementGenerationMetadata') return { success: true, componentType: elementBlank.componentType, themeVariantSource: 'manual' }
    if (action === 'refreshElementThemeMetadata') return { themeVariantId: 'synthetic-variant', themeBindings: { text: '--theme-text' } }
    return { success: true, elementId: args.elementId ?? null }
  }
  const elementLayout = { sendElementCommand, captureStudioElementGeneration: () => ({ sendElementCommand, isCurrent: () => true }) }

  // ---- the probe ---------------------------------------------------------------------
  const probe = { latest: null }
  const toast = value => { toasts.push(value); call('page.toast', [value]) }
  function PageProbe() {
    const R = React
    const [userMessages, setUserMessages] = R.useState([])
    const [isGeneratingFinal, setIsGeneratingFinal] = R.useState(false)
    const [templateReuseAwaitingInput, setTemplateReuseAwaitingInput] = R.useState(false)
    const [inputMessage, setInputMessage] = R.useState('')
    const [pendingActionInput, setPendingActionInput] = R.useState(null)
    const [transcriptReceipt, setTranscriptReceipt] = R.useState(null)
    const [isLoadingSession, setIsLoadingSession] = R.useState(false)
    refs.isGeneratingFinalRef.current = isGeneratingFinal
    // elementPreflight: the page's deck-theme state (page.tsx keeps it next to the hook) and its early callbacks.
    const theme = preflightOn ? (() => {
      const T = themeSources.compiled
      const [buildThemeSelection, setBuildThemeSelection] = R.useState({ mode: 'auto' })
      const [activeBuildThemeProfile, setActiveBuildThemeProfile] = R.useState(null)
      const [themeSync, setThemeSync] = R.useState(themeLibs.IDLE_THEME_SYNC)
      const themeSyncRef = R.useRef(themeSync)
      themeSyncRef.current = themeSync
      const scope = {
        ...themeLibs, process: env.globals.process, crypto: env.crypto, console: env.console,
        setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout,
        buildThemeSelection, setBuildThemeSelection, activeBuildThemeProfile, setActiveBuildThemeProfile, themeSync, setThemeSync, themeSyncRef,
        latestThemeSyncRequestRef: R.useRef(null), latestThemeSyncKeyRef: R.useRef(null), themeSyncTimeoutRef: R.useRef(null),
        themeSelectionChangedLocallyRef: R.useRef(false), templateSelectionLockedRef: R.useRef(false), templateModeOn: false,
        toast, saveSessionOnFirstAction: () => call('page.saveSessionOnFirstAction', []),
      }
      scope.THEME_SYNC_TIMEOUT_MS = T.themeSyncTimeoutMs(scope)
      scope.buildThemeProfileMatchesSelection = T.buildThemeProfileMatchesSelection(scope)
      scope.composerLibraryEnabled = T.composerLibraryEnabled(scope)
      for (const name of ['getThemeSyncSnapshot', 'commitThemeSync', 'clearThemeSyncTimeout']) scope[name] = R.useCallback(T[name].fn(scope), T[name].deps(scope))
      return scope
    })() : null
    const studioShell = env.globals.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
    const sessionApi = {
      userMessages, setUserMessages, isLoadingSession,
      answeredActionsRef: refs.answeredActionsRef, userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef,
      hasSeenWelcomeRef: refs.hasSeenWelcomeRef,
      hasTitleFromUserMessageRef: { current: false }, hasTitleFromPresentationRef: { current: false },
      markStudioUserIntent: () => { refs.transcriptScopeRef.current.userIntentSeen = true },
      hasStudioUserIntent: () => refs.transcriptScopeRef.current.userIntentSeen,
      studioFrontendTranscriptReceipt: transcriptReceipt,
      ...(composerOn ? { handleRequestSession: async () => {} } : {}),
    }
    const composerHandlers = composerOn ? Object.fromEntries(['stopAwaitingReply', 'handleFilesSelected', 'removeFile', 'clearAllFiles', 'handleResearchEnabledChange',
      'handleWebSearchEnabledChange', 'setKnowledgeGraphEnabled', 'handleSelectTemplate', 'setShowComposerLibrary', 'handleClearTemplate', 'handleCancelTemplateReuse',
      'handleBuildThemeChange', 'handleActiveBuildThemeProfileChange'].map(name => [name, () => {}])) : {}
    const base = {
      React: R, process: env.globals.process, console: env.console, Date: env.globals.Date, crypto: env.crypto,
      setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout, requestAnimationFrame: env.clock.requestAnimationFrame,
      studioShell, features: { immediateConnection: true }, STUDIO_VOICE_INTERACTIVE_ENABLED: voice.STUDIO_VOICE_INTERACTIVE_ENABLED,
      ...pageInputs, user: authUser, toast, persistence, session: sessionApi,
      ...refs, isGeneratingFinal, setIsGeneratingFinal, templateReuseAwaitingInput, setTemplateReuseAwaitingInput,
      inputMessage, setInputMessage, pendingActionInput, setPendingActionInput, setWorkflowBrief: () => {},
      awaitingDirectorReply: false, uploadedFiles: [], quota: { status: null }, STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: false,
      studioOutlineCanvas: undefined, turnContext: undefined, effectivePresentationUrl: undefined,
      isThemeSyncTerminal: () => false,
      ...(preflightOn ? { isThemeSyncTerminal: themeLibs.isThemeSyncTerminal, applyThemeSyncResponse: themeLibs.applyThemeSyncResponse,
        latestThemeSyncRequestRef: theme.latestThemeSyncRequestRef, themeSyncRef: theme.themeSyncRef, clearThemeSyncTimeout: theme.clearThemeSyncTimeout,
        commitThemeSync: theme.commitThemeSync, themeSelectionChangedLocallyRef: theme.themeSelectionChangedLocallyRef } : {}),
      // Page names a sibling PR's ChatInput props read (the composer template popup's library action, PR #380); inert here, the popup is stubbed.
      ...(composerOn ? { studioComposerContextLabel: composerContextLib.studioComposerContextLabel } : {}),
      ...(composerOn ? { studioPopupsV2: studioShell && env.globals.process.env.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true', setComposerLibraryRequest: () => {} } : {}),
      ...(composerOn ? { ...composerHandlers, isTemplateGenerationReady: templateHelpers.isTemplateGenerationReady, router: { push: track('composer.page.router.push', () => {}) }, subscribeToKnowledgeGraph: async () => false,
        handleSendMessage: event => { event?.preventDefault?.(); return composerSubmit() } } : {}),
    }
    const hookOptions = {}
    for (const [name, evaluate] of Object.entries(sources.compiled.hookOptions)) hookOptions[name] = evaluate(base)
    const options = {
      ...hookOptions,
      onSessionStateChange: track('hook.onSessionStateChange', () => {}),
      onSlideComposeProgress: track('hook.onSlideComposeProgress', () => {}),
      onSlideBuilt: track('hook.onSlideBuilt', () => {}),
      onSlideComposeReady: track('hook.onSlideComposeReady', () => {}),
      onSlideComposeFailed: track('hook.onSlideComposeFailed', () => {}),
      onElementDirective: track('hook.onElementDirective', () => {}),
      onSessionDirective: track('hook.onSessionDirective', () => {}),
      onBuildPhase: track('hook.onBuildPhase', () => {}),
      onBuildEvent: track('hook.onBuildEvent', () => {}),
      onBuildStateSync: track('hook.onBuildStateSync', () => {}),
    }
    // The page's own onMessage handler (extracted); only {type, message_id} is recorded because the
    // full frame is already in the hook state digest.
    options.onMessage = message => { call('hook.onMessage', [{ type: message.type, message_id: message.message_id }]); return sources.compiled.onMessage(base)(message) }
    const ws = hookModule.useDecksterWebSocketV2(options)
    // use-builder-session: keep the session cache's user turns in step (drives skip_history).
    R.useEffect(() => { sources.compiled.cacheSyncEffect({ userMessages, updateCacheUserMessages: ws.updateCacheUserMessages })() }, [userMessages, ws.updateCacheUserMessages])
    const values = {
      ...base, ...ws, wsError: ws.error, wsSessionId: ws.sessionId, session: sessionApi,
      connected: ws.connected, connecting: ws.connecting, transportNotice: ws.transportNotice,
      effectiveBuildNarrationEnabled: pageInputs.suppressEphemeral, approvalGatesLocked: pageInputs.askGatesLocked,
      effectiveSlideCount: ws.slideCount, effectivePresentationUrl: ws.presentationUrl,
      isReady: ws.isReady,
    }
    if (preflightOn) {
      const T = themeSources.compiled
      Object.assign(theme, { composerAdoption: ws.composerAdoption, composerThemeResolved: ws.composerThemeResolved, isReady: ws.isReady,
        studioShell: base.studioShell, sendThemeSelection: ws.sendThemeSelection,
        // The default (not final_fill, no Template Mode) branch of the page's effectivePresentationId, through the real resolver.
        effectivePresentationId: resolveEffectivePresentation({ livePresentationUrl: ws.presentationUrl, livePresentationId: ws.presentationId, liveSlideCount: ws.slideCount, override: null }).presentationId })
      theme.composerThemeBlocked = T.composerThemeBlocked(theme)
      theme.composerThemeFrozen = T.composerThemeFrozen(theme)
      theme.themeSyncTargetRef = R.useRef(T.themeSyncTargetInitial(theme))
      theme.themeSyncTargetRef.current = T.themeSyncTargetCurrent(theme)
      for (const name of ['requestThemeSyncForPresentation', 'ensureThemeReady', 'handleBuildThemeChange']) theme[name] = R.useCallback(T[name].fn(theme), T[name].deps(theme))
      R.useEffect(T.themeSyncEffect.fn(theme), T.themeSyncEffect.deps(theme))
      theme.generation = generationHook.useTextLabsGeneration({
        generationPanel: elementPanel, blankElements: elementBlanks, textLabsSession: elementSession, layoutServiceApis: elementLayout,
        presentationId: theme.effectivePresentationId, currentSlideIndex: 0, deckContext: null, researchSessionId: pageInputs.currentSessionId,
        researchStoreName: null, researchUserId: authUser.id, researchCapabilities: {},
        getThemeSyncSnapshot: theme.getThemeSyncSnapshot, ensureThemeReady: theme.ensureThemeReady, toast,
      })
    }
    values.preflightDirectorTurn = sources.compiled.preflightDirectorTurn(values)
    values.handleActionClick = sources.compiled.handleActionClick(values)
    const listProps = evaluateProps(sources.compiled.messageList, values, (name, value) => name.startsWith('on') ? track(`ml.${name}`, value) : value)
    probe.latest = { ws, values, listProps, userMessages, isGeneratingFinal, templateReuseAwaitingInput, sessionApi, studioShell, isLoadingSession, setIsLoadingSession, setTranscriptReceipt, setUserMessages, setIsGeneratingFinal, theme }
    if (!composerOn) return R.createElement(MessageList, listProps)
    // The composer, with the page's own prop expressions. Handlers are recorded (composer.<prop>); the send handler runs the page's typed-turn path.
    const chatProps = evaluateProps(sources.compiled.chatInput, values, (name, value) => name.startsWith('on') ? track(`composer.${name}`, value) : value)
    probe.latest.chatProps = chatProps
    return R.createElement(R.Fragment, null, R.createElement(MessageList, listProps), R.createElement(ChatInput, chatProps))
  }

  // ---- renderer wiring ---------------------------------------------------------------------
  let root_ = null
  const settle = async () => {
    for (let quiet = 0, rounds = 0; quiet < 2; rounds++) {
      if (rounds > 80) throw new Error('harness: the page did not settle after 80 rounds')
      await macrotask()
      quiet = root_ && root_.flush() ? 0 : quiet + 1
    }
  }
  env.settle = settle
  const advance = async ms => { await env.clock.advance(ms, settle) }
  const mount = async () => {
    refs = makeRefs()
    root_ = new Root()
    root_.setElement(React.createElement(PageProbe))
    await settle()
  }
  const unmount = async () => {
    root_.unmount()
    root_ = null
    probe.latest = null
    await advance(0)
  }
  const flushPending = async () => {
    for (let i = 0; pendingWork.size && i < 400; i++) {
      await settle()
      if (pendingWork.size) await advance(50)
    }
    if (pendingWork.size) throw new Error('harness: page work never completed (a promise is still pending after 20s of virtual time)')
  }

  // ---- node finding / events ------------------------------------------------------------------
  // A named component's node anywhere in the expanded tree (the chat and the composer are siblings when a fixture opts into the composer).
  const findComp = (node, name) => {
    if (!node) return null
    if (node.t === 'comp') return node.name === name ? node : findComp(node.child, name)
    if (node.t === 'frag' || node.t === 'host') { for (const child of node.children) { const hit = findComp(child, name); if (hit) return hit } }
    return null
  }
  // Presentation-only additions a flag may draw (today: the PR D recovery card). They carry a marker attribute and are left out of the ordered
  // keys, so flag-on `keys.json` is comparable with flag-off: a card is not a message and has no key.
  const isAdditive = node => hostNodes(node)[0]?.props?.['data-studio-chat-recovery'] !== undefined
  const describe = node => {
    const hosts = hostNodes(node)
    const first = hosts[0]
    const attr = name => hosts.map(h => h.props?.[name]).find(v => v !== undefined)
    return { role: attr('data-studio-director-message') ?? null, action: attr('data-director-action-id') ?? null, tag: first?.type ?? null, empty: hosts.length === 0, buttons: hosts.filter(h => h.type === 'button').length, inputs: hosts.filter(h => h.type === 'input').length }
  }
  const findNode = selector => {
    const tree = root_.tree
    let pool = hostNodes(tree)
    if (selector.within) {
      const top = keyedChildren(tree, 'MessageList') || []
      if (selector.within.key !== undefined) {
        const hit = top.find(node => node.key === selector.within.key)
        if (!hit) throw new Error(`harness: no MessageList child with key "${selector.within.key}" (keys: ${top.map(n => n.key).join(', ')})`)
        pool = hostNodes(hit)
      } else if (selector.within.composer) {
        const composer = findComp(tree, 'ChatInput')
        if (!composer) throw new Error('harness: this fixture does not render the composer (set "composer": true)')
        pool = hostNodes(composer)
      } else if (selector.within.action !== undefined) {
        const holder = pool.find(node => node.props?.['data-director-action-id'] === selector.within.action)
        if (!holder) throw new Error(`harness: no element with data-director-action-id="${selector.within.action}"`)
        pool = hostNodes(holder)
      }
    }
    const matches = pool.filter(node =>
      (!selector.tag || node.type === selector.tag) &&
      Object.entries(selector.attrs || {}).every(([k, v]) => String(node.props?.[k]) === String(v)) &&
      (selector.text === undefined || textOf(node).includes(selector.text)))
    const index = selector.index ?? 0
    if (!matches[index]) throw new Error(`harness: selector matched ${matches.length} element(s), wanted index ${index}: ${JSON.stringify(selector)}`)
    return matches[index]
  }
  const syntheticEvent = (type, value) => ({ type, preventDefault() {}, stopPropagation() {}, target: { value }, currentTarget: { value } })

  // ---- checkpoints -------------------------------------------------------------------------------
  // One compact token per transcript message: id | type | role | arrival offset (+ projection flags).
  const digestMessage = message => [
    message.message_id, message.type, message.role ?? '-',
    typeof message.clientTimestamp === 'number' ? `+${message.clientTimestamp - START_MS}ms` : 'no-ts',
    ...(message.clientOutlineReplayOf ? [`replayOf=${message.clientOutlineReplayOf}`] : []),
    ...(message.clientTerminalOutlineRevisionOf ? [`terminalRevisionOf=${message.clientTerminalOutlineRevisionOf}`] : []),
    ...(message.clientOutlineHistoryStatus ? [`history=${message.clientOutlineHistoryStatus}`] : []),
  ].join(' | ')
  const digest = () => {
    const { ws, userMessages, isGeneratingFinal } = probe.latest
    return {
      virtualMs: env.clock.now() - START_MS,
      connection: { state: ws.connectionState, connected: ws.connected, connecting: ws.connecting, reconnectStatus: ws.reconnectStatus, reconnectAttempt: ws.reconnectAttempt, awaitingDirectorReply: ws.awaitingDirectorReply, connectionGeneration: ws.connectionGeneration, sockets: env.sockets.length },
      error: ws.error ? { name: ws.error.name, message: ws.error.message } : null,
      transportNotice: ws.transportNotice,
      status: ws.currentStatus,
      messages: ws.messages.map(digestMessage),
      messagesSha: sha256(JSON.stringify(canonical(ws.messages))),
      ephemeralMessageIds: ws.ephemeralMessageIds, ephemeralFadeToken: ws.ephemeralFadeToken,
      deck: {
        activeVersion: ws.activeVersion, presentationUrl: ws.presentationUrl, presentationId: ws.presentationId, blankUrl: ws.blankPresentationUrl, strawmanUrl: ws.strawmanPreviewUrl,
        finalUrl: ws.finalPresentationUrl, finalId: ws.finalPresentationId, slideCount: ws.slideCount, isBlank: ws.isBlankPresentation, owner: ws.deckOwnerSessionId,
        workflow: ws.directorWorkflowState, hasStrawman: ws.hasStrawman, slideStructureSha: ws.slideStructure ? sha256(JSON.stringify(canonical(ws.slideStructure))) : null,
        slideContextIndexes: ws.slideContextByIndex ? Object.keys(ws.slideContextByIndex) : null,
      },
      page: {
        userMessages: userMessages.map(m => ({ id: m.id, text: m.text, timestamp: m.timestamp - START_MS, attachments: (m.attachments || []).length })),
        answeredActions: [...refs.answeredActionsRef.current], userMessageIds: [...refs.userMessageIdsRef.current], isGeneratingFinal,
        pendingActionInput: probe.latest.values.pendingActionInput ? { value: probe.latest.values.pendingActionInput.action?.value } : null,
        toasts: toasts.length,
        ...(composerOn ? { composer: { inputMessage: probe.latest.values.inputMessage, activeTemplate: pageInputs.activeTemplate ? { id: pageInputs.activeTemplate.id, name: pageInputs.activeTemplate.name } : null, buildTheme: pageInputs.buildThemeSelection, currentSlideIndex: pageInputs.currentSlideIndex } } : {}),
      },
      ...(probe.latest.theme ? { theme: (({ theme: t }) => ({
        composerAdoption: t.composerAdoption, composerThemeResolved: t.composerThemeResolved, composerThemeBlocked: t.composerThemeBlocked, composerThemeFrozen: t.composerThemeFrozen,
        effectivePresentationId: t.effectivePresentationId, buildThemeSelection: t.buildThemeSelection, themeSync: t.themeSync,
        panelError: elementPanelState.error, blankStatus: elementBlank.status, textLabsRequests: textLabsRequests.length,
      }))(probe.latest) } : {}),
    }
  }
  const checkpoint = label => {
    const n = String(rec.checkpoints.length + 1).padStart(2, '0')
    const name = `${n}-${slug(label)}`
    const latest = probe.latest
    const top = (keyedChildren(root_.tree, 'MessageList') || []).filter(node => !isAdditive(node))
    const chat = renderToStaticMarkup(toElements(composerOn ? findComp(root_.tree, 'MessageList') : root_.tree))
    const composerNode = composerOn ? findComp(root_.tree, 'ChatInput') : null
    const composerHtml = composerNode ? renderToStaticMarkup(toElements(composerNode)) : null
    // Every control of the composer and the handlers it carries (names only): a flag that restyled the composer must leave this list as it was.
    const composerControls = composerNode ? hostNodes(composerNode).filter(host => Object.keys(host.props || {}).some(key => /^on[A-Z]/.test(key) && typeof host.props[key] === 'function'))
      .map(host => ({ tag: host.type, type: host.props.type ?? null, label: host.props['aria-label'] ?? host.props.title ?? null, disabled: Boolean(host.props.disabled),
        handlers: Object.keys(host.props).filter(key => /^on[A-Z]/.test(key) && typeof host.props[key] === 'function').sort() })) : null
    const headerProps = evaluateProps(sources.compiled.header, latest.values)
    const noticeProps = evaluateProps(sources.compiled.notice, latest.values)
    const header = latest.studioShell ? renderToStaticMarkup(React.createElement(StudioDirectorHeader, headerProps)) : ''
    const notice = latest.studioShell ? renderToStaticMarkup(React.createElement(StudioDirectorNotice, noticeProps)) : ''
    if (crossCheck) {
      // Diagnostic: server-render MessageList from the same props (refs cloned, so its memo
      // side effects do not leak) and compare with the mini-renderer's post-effect tree.
      const clone = ref => ({ current: ref.current instanceof Set ? new Set(ref.current) : ref.current instanceof Map ? new Map(ref.current) : ref.current })
      const ssr = renderToStaticMarkup(React.createElement(MessageList, { ...latest.listProps, userMessageIdsRef: clone(latest.listProps.userMessageIdsRef), userMessageContentMapRef: clone(latest.listProps.userMessageContentMapRef), answeredActionsRef: clone(latest.listProps.answeredActionsRef), hasSeenWelcomeRef: clone(latest.listProps.hasSeenWelcomeRef) }))
      rec.crossCheck.push({ checkpoint: name, equal: ssr === chat, ...(ssr === chat ? {} : { ssr: prettyHtml(ssr), mini: prettyHtml(chat) }) })
    }
    rec.markup[`markup/${name}.chat.html`] = prettyHtml(chat)
    rec.markup[`markup/${name}.chrome.html`] = `<!-- StudioDirectorHeader -->\n${prettyHtml(header)}<!-- StudioDirectorNotice -->\n${prettyHtml(notice)}`
    if (composerHtml !== null) rec.markup[`markup/${name}.composer.html`] = prettyHtml(composerHtml)
    rec.checkpoints.push({
      name, label,
      keys: top.map(node => ({ key: node.key ?? null, ...describe(node) })),
      messageIds: latest.ws.messages.map(m => m.message_id),
      state: digest(),
      markup: { chat: sha256(chat), header: sha256(header), notice: sha256(notice), ...(composerHtml !== null ? { composer: sha256(composerHtml) } : {}) },
      composerControls,
    })
  }

  // ---- operations -------------------------------------------------------------------------------
  const socketFor = step => {
    const index = step.socket ?? env.sockets.length - 1
    const socket = env.sockets[index]
    if (!socket) throw new Error(`harness: step ${rec.step} (${step.op}) needs socket ${index} but only ${env.sockets.length} exist`)
    return socket
  }
  // The page's normal typed-turn path (handleSendMessage -> sendTypedTurn): its option object is the page's own expression, the send is the hook's.
  // Returns whether the turn was delivered.
  const submitTyped = async step => {
    const text = step.text.trim()
    const values = probe.latest.values
    if (!values.preflightDirectorTurn()) { rec.notes.push(`step ${rec.step}: typed turn blocked by preflight`); return false }
    const options = { ...sources.compiled.typedOptions(values), ...(step.options || {}) }
    call('page.sendTypedTurn', [text, step.fileCount ?? 0, options])
    let ok = false
    try { ok = await probe.latest.ws.sendMessageWhenConnected(text, undefined, step.fileCount ?? 0, options, undefined, () => true) } catch (error) { rec.notes.push(`typed send rejected: ${error?.message}`) }
    await settle()
    if (ok !== true) { toast({ title: "Couldn't reach the Director" }); return false }
    // Deliver first, commit after (mirrors the tail of handleSendMessage).
    const id = env.crypto.randomUUID(), timestamp = env.clock.now()
    refs.userMessageIdsRef.current.add(id)
    probe.latest.setUserMessages(prev => [...prev, { id, text, timestamp, attachments: [] }])
    persistence.queueMessage({ message_id: id, type: 'chat_message', payload: { text } }, text)
    return true
  }
  // What the composer's Send does in the page: nothing for an empty draft, else the typed-turn path, then the draft is cleared.
  const composerSubmit = async () => {
    const draft = probe.latest.values.inputMessage
    if (!draft.trim()) return
    if (await submitTyped({ text: draft })) probe.latest.values.setInputMessage('')
  }
  const operations = {
    async ensureConnected() { probe.latest.ws.ensureConnected() },
    async open(step) { socketFor(step).serverOpen() },
    async frame(step) { socketFor(step).serverMessage(JSON.stringify(step.frame)) },
    async raw(step) { socketFor(step).serverMessage(step.data) },
    async close(step) { socketFor(step).serverClose(step.code ?? 1006, step.reason ?? '') },
    async advance(step) { await advance(step.ms) },
    async offline() { env.navigator.onLine = false; env.window.dispatchEvent({ type: 'offline' }) },
    async online() { env.navigator.onLine = true; env.window.dispatchEvent({ type: 'online' }) },
    async props(step) { Object.assign(pageInputs, step.set); root_.schedule() },
    async unmount() { await unmount() },
    async mount() { await mount() },
    async checkpoint(step) { checkpoint(step.label) },
    async typed(step) { await submitTyped(step) },
    // The composer, through the REAL ChatInput elements: typing fires its textarea onChange, Enter its onKeyDown, Send its form onSubmit.
    async compose(step) { await findNode({ within: { composer: true }, tag: 'textarea' }).props.onChange?.(syntheticEvent('change', step.text)) },
    async key(step) {
      const textarea = findNode({ within: { composer: true }, tag: 'textarea' })
      await textarea.props.onKeyDown?.({ ...syntheticEvent('keydown'), key: step.key, shiftKey: Boolean(step.shift) })
      await flushPending()
    },
    async submit() {
      await findNode({ within: { composer: true }, tag: 'form' }).props.onSubmit?.(syntheticEvent('submit'))
      await flushPending()
    },
    // Direct hook sends: pin the wire format of every optional field and each control frame.
    async send(step) {
      call('hook.sendMessageWhenConnected', [step.text, step.storeName, step.fileCount, step.options || {}])
      const ok = await probe.latest.ws.sendMessageWhenConnected(step.text, step.storeName, step.fileCount, step.options || {}, undefined, () => true)
      rec.notes.push(`step ${rec.step}: hook send returned ${ok}`)
    },
    async control(step) { call('hook.sendControlMessage', [step.type, step.data]); rec.notes.push(`step ${rec.step}: control returned ${probe.latest.ws.sendControlMessage(step.type, step.data)}`) },
    async theme(step) { call('hook.sendThemeSelection', [step.theme, step.requestId, step.presentationId]); rec.notes.push(`step ${rec.step}: theme returned ${probe.latest.ws.sendThemeSelection(step.theme, step.requestId, step.presentationId)}`) },
    // elementPreflight fixtures: a theme picked in the Theme dialog (the page's own handleBuildThemeChange).
    async themePick(step) { call('page.handleBuildThemeChange', [step.theme]); probe.latest.theme.handleBuildThemeChange(step.theme) },
    // Director acknowledges the LAST set_theme on the wire (its request id is a client uuid, so the fixture cannot spell it).
    async themeAck(step) {
      const last = [...env.outbound].reverse().find(o => o.data.startsWith('{"type":"set_theme"'))
      // Nothing to acknowledge (a refused theme never reached Director): recorded, so a flag-off replay still runs to the end.
      if (!last) { rec.notes.push(`step ${rec.step}: themeAck skipped, no set_theme was sent`); return }
      const sent = JSON.parse(last.data).data
      socketFor(step).serverMessage(JSON.stringify({ message_id: step.messageId, session_id: session.id, timestamp: step.timestamp, type: 'theme_sync', role: 'assistant',
        payload: { request_id: sent.request_id, status: step.status ?? 'applied', presentation_id: sent.presentation_id, theme: sent.theme } }))
    },
    // Composer "Use original": the page hands the use result to the hook (page.tsx applyTemplateIngestReady call sites).
    async useOriginal(step) { call('hook.applyTemplateIngestReady', [step.result, session.id]); rec.notes.push(`step ${rec.step}: applyTemplateIngestReady returned ${probe.latest.ws.applyTemplateIngestReady(step.result, session.id)}`) },
    // Add Element > Generate: the REAL useTextLabsGeneration().handleGenerate with the page's real theme preflight.
    async generate(step) {
      const t = probe.latest.theme
      const form = { ...step.form, presentationId: step.form.presentationId ?? t.effectivePresentationId }
      const run = track('page.handleTextLabsGenerate', async value => { const result = await t.generation.handleGenerate(value); call('page.handleTextLabsGenerate.result', [result]); return result })
      run(form)
      await flushPending()
    },
    async elementResult(step) { call('hook.sendElementDirectiveResult', [step.data]); rec.notes.push(`step ${rec.step}: element result returned ${probe.latest.ws.sendElementDirectiveResult(step.data)}`) },
    async click(step) {
      const node = findNode(step.target)
      if (node.props.disabled) { rec.notes.push(`step ${rec.step}: click skipped, target disabled`); return }
      await node.props.onClick?.(syntheticEvent('click'))
      await flushPending()
    },
    async change(step) {
      const node = findNode(step.target)
      await node.props.onChange?.(syntheticEvent('change', step.value))
    },
    async restore(step) {
      // The Builder's session load: DB rows -> user turns + Director frames, then restoreMessages.
      const row = step.session
      const restoredSessionState = sources.compiled.restoredSessionState({ session: row, process: env.globals.process })
      let userMsgs = null
      const ids = { user: refs.userMessageIdsRef, content: refs.userMessageContentMapRef }
      const persisted = { current: new Set() }
      const setUserMessagesCaptured = list => { userMsgs = list; probe.latest.setUserMessages(list) }
      const scope = {
        session: row, sessionState: restoredSessionState, restoreMessages: probe.latest.ws.restoreMessages,
        setUserMessages: setUserMessagesCaptured, userMessageIdsRef: ids.user, userMessageContentMapRef: ids.content, persistedMessageIdsRef: persisted,
        setIsResumedSession: () => {}, hasSeenWelcomeRef: refs.hasSeenWelcomeRef, attachmentsFromPayload,
        debugLog: () => {}, STUDIO_VOICE_INTERACTIVE_ENABLED: voice.STUDIO_VOICE_INTERACTIVE_ENABLED,
        process: env.globals.process, Date: env.globals.Date, console: env.console,
      }
      await sources.compiled.restoreBlock(scope)()
      refs.transcriptScopeRef.current.generation = 1
      const receiptScope = {
        transcriptScopeRef: refs.transcriptScopeRef, transcriptScope: refs.transcriptScopeRef.current, transcriptLoadRequestRef: { current: 1 }, transcriptRequest: 1,
        builderCacheOwner: session.userId, session: row, sessionParam: row.id, Array,
        setStudioFrontendTranscriptReceipt: receipt => { call('session.setStudioFrontendTranscriptReceipt', [receipt]); probe.latest.setTranscriptReceipt(receipt) },
        Object,
      }
      sources.compiled.receiptBlock(receiptScope)()
      rec.notes.push(`step ${rec.step}: restored ${userMsgs?.length ?? 0} user turns`)
    },
    async expect(step) {
      const ws = probe.latest.ws
      const failures = []
      const check = (label, ok) => { if (!ok) failures.push(label) }
      if (step.outbound !== undefined) check(`outbound ${env.outbound.filter(o => o.data !== 'ping').length} === ${step.outbound}`, env.outbound.filter(o => o.data !== 'ping').length === step.outbound)
      if (step.sockets !== undefined) check(`sockets ${env.sockets.length} === ${step.sockets}`, env.sockets.length === step.sockets)
      if (step.messageCount !== undefined) check(`messages ${ws.messages.length} === ${step.messageCount}`, ws.messages.length === step.messageCount)
      if (step.connectionState !== undefined) check(`connectionState ${ws.connectionState} === ${step.connectionState}`, ws.connectionState === step.connectionState)
      if (step.reconnectStatus !== undefined) check(`reconnectStatus ${ws.reconnectStatus} === ${step.reconnectStatus}`, ws.reconnectStatus === step.reconnectStatus)
      if (step.textLabsRequests !== undefined) check(`Text Labs requests ${textLabsRequests.length} === ${step.textLabsRequests}`, textLabsRequests.length === step.textLabsRequests)
      for (const [type, n] of Object.entries(step.outboundOfType || {})) {
        const count = env.outbound.filter(o => { try { return JSON.parse(o.data).type === type } catch { return false } }).length
        check(`${type} sends ${count} === ${n}`, count === n)
      }
      if (step.themeBlocked !== undefined) check(`composerThemeBlocked ${probe.latest.theme?.composerThemeBlocked} === ${step.themeBlocked}`, probe.latest.theme?.composerThemeBlocked === step.themeBlocked)
      if (step.themeSyncStatus !== undefined) check(`themeSync.status ${probe.latest.theme?.themeSync.status} === ${step.themeSyncStatus}`, probe.latest.theme?.themeSync.status === step.themeSyncStatus)
      if (step.toast !== undefined) check(`a toast titled "${step.toast}"`, toasts.some(item => item?.title === step.toast))
      if (step.noToast !== undefined) check(`no toast titled "${step.noToast}"`, !toasts.some(item => item?.title === step.noToast))
      if (step.exists) check(`element exists ${JSON.stringify(step.exists)}`, (() => { try { findNode(step.exists); return true } catch { return false } })())
      if (step.absent) check(`element absent ${JSON.stringify(step.absent)}`, (() => { try { findNode(step.absent); return false } catch { return true } })())
      if (failures.length) throw new Error(`fixture guard failed at step ${rec.step}: ${failures.join('; ')}`)
    },
  }

  // ---- run ----------------------------------------------------------------------------------------
  await mount()
  for (const [index, step] of fixture.steps.entries()) {
    rec.step = index
    if (!operations[step.op]) throw new Error(`fixture ${fixture.name}: unknown op "${step.op}" at step ${index}`)
    if (step.profiles && !step.profiles.includes(profile)) { rec.steps.push({ step: index, op: step.op, skipped: `profile ${profile}` }); continue }
    if (step.op !== 'advance') await advance(step.dt ?? DEFAULT_DT)
    try {
      await operations[step.op](step)
      await settle()
    } catch (error) {
      error.message = `[${fixture.name} / ${profile}] step ${index} (${step.op}${step.comment ? `: ${step.comment}` : ''}) failed: ${error.message}`
      throw error
    }
    rec.steps.push({ step: index, op: step.op, ...(step.comment ? { comment: step.comment } : {}) })
  }
  await advance(0)
  if (probe.latest) checkpoint('final')

  // ---- assemble the snapshot ----------------------------------------------------------------------------
  const files = {}
  const outboundLines = [
    ...env.handshakes.map(h => JSON.stringify({ kind: 'handshake', ...h })),
    ...env.outbound.map((o, n) => JSON.stringify({ kind: o.data === 'ping' ? 'heartbeat' : (() => { try { return `json:${JSON.parse(o.data).type}` } catch { return 'raw' } })(), n, socket: o.socket, at: o.at, sha256: sha256(o.data), bytes: o.data })),
    ...env.clientCloses.map(c => JSON.stringify({ kind: 'client-close', ...c })),
  ]
  files['outbound.ndjson'] = outboundLines.join('\n') + '\n'
  files['keys.json'] = pretty(rec.checkpoints.map(c => ({ checkpoint: c.name, keys: c.keys, hookMessageIds: c.messageIds })))
  files['calls.json'] = pretty(rec.calls)
  files['state.json'] = pretty({ checkpoints: rec.checkpoints.map(c => ({ checkpoint: c.name, label: c.label, ...c.state })), steps: rec.steps, notes: rec.notes })
  const cacheKey = Object.keys(env.sessionStorage.dump()).filter(k => k.startsWith('deckster_session_v2_'))
  files['cache.json'] = pretty(Object.fromEntries(cacheKey.map(k => [k, JSON.parse(env.sessionStorage.dump()[k])])))
  if (composerOn) files['composer.json'] = pretty(rec.checkpoints.map(c => ({ checkpoint: c.name, controls: c.composerControls })))
  if (preflightOn) {
    files['textlabs.json'] = pretty(textLabsRequests)
    files['theme-sources.json'] = pretty(themeSources.regions)
  }
  files['markup.json'] = pretty(Object.fromEntries(rec.checkpoints.map(c => [c.name, c.markup])))
  if (includeMarkup) Object.assign(files, rec.markup)
  files['env.json'] = pretty({ profile, env: { ...BASE_ENV, ...processEnv } })
  files['meta.json'] = pretty({
    schema: 1, fixture: fixture.name, profile, fixtureSha: sha256(JSON.stringify(canonical(fixture))).slice(0, 16),
    diagnostics: { console: env.consoleEvents, uncaughtTimerErrors: env.clock.uncaught, blockedNetwork: env.blockedNetwork, fetches: env.fetches, windowOpens: env.windowOpens, sockets: env.sockets.length, timersLeft: env.clock.pending() },
  })
  if (root_) { root_.unmount(); root_ = null }
  return { files, blockedNetwork: env.blockedNetwork, regions: sources.regions, sendSites: sources.sendSites, crossCheck: rec.crossCheck }
}
