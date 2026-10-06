import { component as nativeViewer, nodes as viewerNodes } from '../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/first-slice/test-fixtures/viewer-component-harness.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import { createFirstSendHookHarness } from '../docs/studio-v4/first-send-20261004/test-first-send-hook.mjs'

const sourceRef = process.argv.find(arg => arg.startsWith('--source-ref='))?.slice('--source-ref='.length)
const expectFixed = !sourceRef
const refuse = () => { throw Error('History fixture refuses services, timers and browser actions') }
let slots = [], index = 0
const imports = {
  react: { ...React, useMemo: callback => callback(), useEffect() {},
    useRef: value => slots[index++] ||= { current: value }, useState: value => [value, refuse] },
  'react/jsx-runtime': jsxRuntime, 'react-markdown': ReactMarkdown,
  'lucide-react': Object.fromEntries(['Sparkles','ExternalLink','User','ChevronDown','Check','CheckCircle2','HelpCircle','ListChecks','PenLine','ListOrdered'].map(name => [name, 'span'])),
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' }, '@/components/file-chip': { FileChip: 'span' },
  '@/lib/debug-log': { debugLog() {} }, '@/lib/mdc-flags': { CHAT_CLARITY: true, CHAT_QUESTIONS: true },
  '@/lib/slide-compose-async': { hasLiveTrackedEphemeralMessage: () => false },
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => ({ status: 'allowed', url }) },
  '@/lib/build-narration-heuristics': { shouldRerouteEphemeral: Boolean },
  '@/components/builder/chat/studio-welcome': { StudioWelcome: 'span' }, './studio-director.css': {},
}
const read = name => { if (sourceRef) { try { return execFileSync('git', ['show', `${sourceRef}:${name}`], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }) } catch {} } return fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8') }
function load(name, ref = null, studio = true) {
  const source = ref ? execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8' }) : read(name)
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, URL, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, fetch: refuse, setTimeout: refuse, require: name => { if (!(name in imports) && name.startsWith('@/lib/')) imports[name] = load(`lib/${name.slice('@/lib/'.length)}.ts`); assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name] } })
  return mod.exports
}
for (const name of ['user-message-attachments','build-progress-visibility','director-chat-history','director-history-presentation']) imports[`@/lib/${name}`] = load(`lib/${name}.ts`, name === 'director-history-presentation' && sourceRef && sourceRef !== 'ee532fab4b84a6883f8a5b50675ccab692b62240' ? sourceRef : null)
imports['@/lib/director-transcript'] = load('lib/director-transcript.ts', sourceRef && sourceRef !== 'ee532fab4b84a6883f8a5b50675ccab692b62240' ? sourceRef : null)
imports['@/components/builder/chat/question-card'] = load('components/builder/chat/question-card.tsx', sourceRef)
imports['@/components/builder/chat/studio-outline-card'] = load('components/builder/chat/studio-outline-card.tsx', sourceRef && sourceRef !== 'ee532fab4b84a6883f8a5b50675ccab692b62240' ? sourceRef : null)
const { QuestionCard } = imports['@/components/builder/chat/question-card']
const { StudioOutlineCard } = imports['@/components/builder/chat/studio-outline-card']
const { MessageList } = load('components/builder/message-list.tsx', sourceRef)
const classic = load('components/builder/message-list.tsx', sourceRef, false).MessageList
const { coalesceOutlineStateReplays, historicalActionStatuses, projectVerifiedOutlineReplay, presentTerminalOutlineRevisions } = imports['@/lib/director-history-presentation']
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const stamp = offset => new Date(Date.UTC(2026,9,4,12,0,offset)).toISOString()
const frame = (type, id, offset, payload, extra = {}) => ({ type, message_id: id, session_id: 'synthetic-session', timestamp: stamp(offset), payload, ...extra })
const action = (id, offset, value = 'accept_plan') => frame('action_request', id, offset, { prompt_text: 'Synthetic plan: build exactly three slides?', actions: [{ label: "Yes, let's build it!", value, primary: true, requires_input: false }] })
const final = (id, offset, presentationId = 'synthetic-deck') => frame('presentation_url', id, offset, { url: `https://synthetic.invalid/p/${presentationId}`, presentation_id: presentationId, slide_count: 3 })
const props = messages => ({ sessionId: 'synthetic-session', messages, userMessages: [], userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse, onSubmitAnswers: refuse })
function render(p, reset = true, component = MessageList) { if (reset) slots = []; index = 0; return component(p) }
const countOutlines = tree => nodes(tree).filter(node => node.type === StudioOutlineCard).length
const cards = tree => nodes(tree).filter(node => node.type === QuestionCard)
const actualPolicy = load('lib/layout-viewer-url-policy.ts')
imports['./layout-viewer-url-policy'] = actualPolicy
const hookDependencies = {
  '@/lib/director-history-presentation': imports['@/lib/director-history-presentation'],
  '@/lib/director-chat-history': imports['@/lib/director-chat-history'],
  '@/lib/layout-viewer-url-policy': actualPolicy,
  '@/lib/director-layout-url-ingress': load('lib/director-layout-url-ingress.ts'),
  '@/lib/director-sync-recovery': load('lib/director-sync-recovery.ts'),
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: actualPolicy.createLayoutViewerUrlPolicy('https://synthetic.invalid') },
}
const hookSource = sourceRef ? execFileSync('git', ['show', `${sourceRef}:hooks/use-deckster-websocket-v2.ts`], { encoding: 'utf8' }) : read('hooks/use-deckster-websocket-v2.ts')


const origin = 'https://layout.invalid', sessionId = 'synthetic-session', deckId = 'synthetic-final'
const url = `${origin}/p/${deckId}`, time = Date.UTC(2026, 9, 4, 18)
const messages = [
  frame('slide_built', 'synthetic-slide-built', 1, { build_id: 'synthetic-build', presentation_id: deckId, slide_index: 0, slide_count: 5, thumbnail_url: `${origin}/synthetic-thumbnail.png` }),
  frame('chat_message', 'synthetic-ready', 2, { text: 'Synthetic presentation is ready.' }, { role: 'assistant' }),
  frame('action_request', 'synthetic-current-choices', 3, { prompt_text: 'Current synthetic choices', actions: [{ label: 'Current adjustments', value: 'edit_current', primary: true, requires_input: true }] }),
]
const finalState = { deckOwnerSessionId: sessionId, presentationUrl: url, presentationId: deckId,
  finalPresentationUrl: url, finalPresentationId: deckId, strawmanPreviewUrl: null, strawmanPresentationId: null,
  blankPresentationUrl: null, blankPresentationId: null, isBlankPresentation: false,
  activeVersion: 'final', slideCount: 5, slideStructure: null, currentStage: 6 }
const missingMetadata = { deckOwnerSessionId: sessionId, presentationUrl: null, presentationId: null,
  finalPresentationUrl: null, finalPresentationId: null, strawmanPreviewUrl: null, strawmanPresentationId: null,
  blankPresentationUrl: null, blankPresentationId: null, isBlankPresentation: false,
  activeVersion: null, slideCount: null, slideStructure: null, currentStage: null }
const hookDeps = { ...hookDependencies, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: actualPolicy.createLayoutViewerUrlPolicy(origin) } }
const cacheWrites = []
async function hook({ cached = null, state = null, restored = messages, open = false, handlers = {} } = {}) {
  let cache = cached
  const deps = { ...hookDeps, './use-session-cache': { useSessionCache: () => ({ getCachedState: () => cache, isCacheValid: () => Boolean(cache),
    setCachedState(value) { cacheWrites.push(value); cache = { ...(cache || {}), ...value } }, clearCache() { cache = null } }) } }
  // Extra pure dependencies introduced by the actual source candidate remain
  // real modules, never semantic stubs.
  const ast = ts.createSourceFile('hook.ts', hookSource, ts.ScriptTarget.Latest, true)
  for (const statement of ast.statements) if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
    const name = statement.moduleSpecifier.text
    if (name.startsWith('@/lib/') && !(name in deps) && !['@/lib/debug-log','@/lib/mdc-flags','@/lib/mdc-mentions','@/lib/build-control-helpers','@/lib/slide-compose-async'].includes(name)) deps[name] = load(`lib/${name.slice('@/lib/'.length)}.ts`)
  }
  const h = createFirstSendHookHarness({ existingSessionId: sessionId, autoConnect: open, ...handlers }, hookSource, deps, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' })
  if (open) { await h.token(0); h.sockets[0].open() }
  await h.advance(time)
  if (state) { h.api.restoreMessages(restored, state); await h.advance(0) }
  return h
}
function fullAreaFixture() {
  let layoutEffects = []
  const source = read('components/builder/presentation-area.tsx'), deps = {
    react: { ...React, useLayoutEffect: callback => layoutEffects.push(callback) },
    'react/jsx-runtime': jsxRuntime,
    'react-dom': { createPortal: (children, container) => React.createElement('fixture-portal', { container }, children) },
  }
  const ast = ts.createSourceFile('area.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue
    const name = statement.moduleSpecifier.text
    if (name in deps) continue
    if (name.startsWith('@/lib/')) { deps[name] = load(`lib/${name.slice('@/lib/'.length)}.ts`); continue }
    assert.ok(name.startsWith('@/components/') || name === '@/types/elements', `Unexpected area dependency ${name}`)
    deps[name] = Object.fromEntries((statement.importClause?.namedBindings?.elements || []).filter(binding => !binding.isTypeOnly).map(binding => {
      const key = binding.propertyName?.text ?? binding.name.text
      return [key, key === 'useStageWalkthrough' ? () => {} : `${name}:${key}`]
    }))
  }
  const mod = { exports: {} }, compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } })
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, require: name => { assert.ok(name in deps, name); return deps[name] } })
  return state => {
    layoutEffects = []
    const tree = mod.exports.PresentationArea({ ...state, sessionId: state.sessionId ?? sessionId, publishSessionId: state.displayedSessionId ?? state.sessionId ?? sessionId, publishFinalPresentationId: state.finalPresentationId, buildNarrationEnabled: true, buildNarration: state.buildNarration ?? null,
      currentSlideIndex: 0, onSlideChange: refuse, onVersionSwitch: refuse, generationPanel: { hasActiveGenerations: false }, blankElements: {} })
    for (const effect of layoutEffects) effect()
    const viewer = nodes(tree).find(node => node.type === deps['@/components/presentation-viewer'].PresentationViewer)
    let iframe = null, placeholderInNative = false, nativeInstance = null, nativeTree = null
    if (viewer) {
      const native = nativeViewer(read('components/presentation-viewer.tsx'), true)
      nativeInstance = native
      nativeTree = native.render(viewer.props, true)
      iframe = viewerNodes(nativeTree).find(node => node.type === 'iframe')
      placeholderInNative = viewerNodes(nativeTree).some(node => node === viewer.props.stageChrome?.placeholder)
    }
    return { viewer, tree, nativeInstance, nativeTree, iframe, result: { viewerMounted: Boolean(viewer), nativeIframeMounted: Boolean(iframe),
      nativeSrcMatchesFinal: iframe?.props.src === url, stagePlaceholder: Boolean(viewer?.props.stageChrome?.placeholder),
      placeholderInsertedInNative: placeholderInNative, waitingBranch: nodes(tree).some(node => node.type === deps['@/components/builder/studio-waiting-state']?.StudioWaitingState), ribbonBranch: nodes(tree).some(node => node.type === deps['@/components/build-narration/stage-ribbon']?.StageRibbon), footerBranch: nodes(tree).some(node => node.type === deps['@/components/build-narration/stage-progress-footer']?.StageProgressFooter), welcomeBranch: nodes(tree).some(node => node.type === deps['@/components/builder/studio-welcome-stage'].StudioWelcomeStage),
      presentationId: state.presentationId === deckId ? 'synthetic-final' : state.presentationId ? 'other-synthetic' : null,
      activeVersion: state.activeVersion, slideCount: state.slideCount, hasFinalPair: state.finalPresentationUrl === url && state.finalPresentationId === deckId } }
  }
}
const area = fullAreaFixture(), results = []
let checks = 0
async function check(name, run) { const result = await run(); checks++; results.push({ check: name, ...result }); console.log(`PASS ${name}`) }
await check('cold owned completed cache mounts native final but missing structure must not cover it with landing overlay', async () => {
  const h = await hook({ cached: { ...finalState, messages, userMessages: [] } })
  const o = area(h.api)
  assert.equal(o.result.nativeIframeMounted, true); assert.equal(o.result.nativeSrcMatchesFinal, true)
  assert.equal(o.result.stagePlaceholder, !expectFixed)
  if (!expectFixed) assert.equal(o.result.placeholderInsertedInNative, true)
  return { observed: o.result, beforeFailure: !expectFixed, connectedCauseProven: false }
})
await check('incomplete same-owner DB metadata cannot erase completed cached final while preserving ready/current choices', async () => {
  const h = await hook({ cached: { ...finalState, messages, userMessages: [] }, state: missingMetadata })
  const o = area(h.api)
  assert.equal(o.result.nativeIframeMounted, expectFixed); assert.equal(o.result.hasFinalPair, expectFixed)
  assert.equal(o.result.welcomeBranch, !expectFixed)
  assert.equal(h.api.messages.length, messages.length)
  assert.ok(h.api.messages.some(m => m.type === 'slide_built')); assert.ok(h.api.messages.some(m => m.message_id === 'synthetic-ready'))
  const currentTree = render(props(h.api.messages)); const current = cards(currentTree).find(card => card.props.messageId === 'synthetic-current-choices')
  assert.ok(current, 'current action card survives the same actual history merge')
  const written = cacheWrites.at(-1)
  assert.equal(written.presentationUrl === url, expectFixed)
  const remounted = await hook({ cached: { ...written, messages: written.messages, userMessages: [] } })
  assert.equal(area(remounted.api).result.nativeIframeMounted, expectFixed, 'actual cold hook remount reflects the real cache writer result')
  return { observed: o.result, rawMessages: h.api.messages.length, currentChoicePreserved: true, cacheWriterRetainsFinal: expectFixed, coldHookRemountRetainsFinal: expectFixed, beforeFailure: !expectFixed, connectedCauseProven: false }
})
await check('owned final survives workspace pane unmount/remount and owned full DB restore without native target mutation', async () => {
  const h = await hook({ state: finalState })
  const before = area(h.api), after = fullAreaFixture()(h.api)
  assert.equal(before.result.nativeSrcMatchesFinal, true); assert.equal(after.result.nativeSrcMatchesFinal, true)
  h.api.restoreMessages(messages, finalState); await h.advance(0)
  assert.equal(area(h.api).result.nativeSrcMatchesFinal, true)
  return { before: before.result, afterRemount: after.result, directComponentRemountOnly: true }
})
await check('late current-socket terminal sync recovers retained final and later blank init cannot switch its active target', async () => {
  const h = await hook({ state: missingMetadata, open: true })
  h.sockets[0].onmessage({ data: JSON.stringify(frame('sync_response', 'synthetic-sync', 4, { action: 'skip_history', current_state: 'CONTENT_GENERATED', message_count: 3, has_strawman: true, presentation_url: url, presentation_id: deckId, slide_count: 5 })) }); await h.advance(0)
  assert.equal(area(h.api).result.nativeSrcMatchesFinal, true)
  h.sockets[0].onmessage({ data: JSON.stringify(frame('presentation_init', 'synthetic-late-blank', 5, { presentation_url: `${origin}/p/synthetic-blank`, presentation_id: 'synthetic-blank' })) }); await h.advance(0)
  assert.equal(h.api.presentationUrl, url); assert.equal(h.api.presentationId, deckId)
  assert.equal(h.api.activeVersion, 'final'); assert.equal(h.api.messages.filter(m => m.type === 'action_request').length, 1)
  return { observed: area(h.api).result, contractsRetained: true }
})
await check('explicit manual blank and available version choices remain usable when a same-owner complete snapshot returns', async () => {
  const manualUrl = `${origin}/p/synthetic-manual-blank`
  const state = { ...finalState, blankPresentationUrl: manualUrl, blankPresentationId: 'synthetic-manual-blank', isBlankPresentation: true,
    activeVersion: 'blank', presentationUrl: manualUrl, presentationId: 'synthetic-manual-blank' }
  const h = await hook({ state })
  assert.equal(h.api.activeVersion, 'blank'); assert.equal(h.api.presentationUrl, manualUrl)
  h.api.switchVersion('final'); await h.advance(0)
  assert.equal(h.api.presentationUrl, url); assert.equal(h.api.activeVersion, 'final')
  h.api.switchVersion('blank'); await h.advance(0)
  assert.equal(h.api.presentationUrl, manualUrl); assert.equal(h.api.activeVersion, 'blank')
  h.api.restoreMessages(messages, state); await h.advance(0)
  assert.equal(h.api.presentationUrl, manualUrl); assert.equal(h.api.activeVersion, 'blank')
  return { explicitBlankPreserved: true, availableVersionChoicePreserved: true }
})
await check('blank manual init stays a native editable target while nonterminal topic chat does not invent a completed final', async () => {
  const h = await hook({ open: true })
  h.sockets[0].onmessage({ data: JSON.stringify(frame('chat_message', 'synthetic-topic', 1, { text: 'Synthetic topic response, still discussing.' }, { role: 'assistant' })) }); await h.advance(0)
  assert.equal(h.api.finalPresentationUrl, null); assert.equal(h.api.slideCount, null)
  assert.equal(area(h.api).result.nativeIframeMounted, false)
  const manualUrl = `${origin}/p/synthetic-manual-new`
  h.sockets[0].onmessage({ data: JSON.stringify(frame('presentation_init', 'synthetic-manual', 2, { presentation_url: manualUrl, presentation_id: 'synthetic-manual-new' })) }); await h.advance(0)
  assert.equal(h.api.activeVersion, 'blank'); assert.equal(h.api.presentationUrl, manualUrl)
  assert.equal(h.api.isBlankPresentation, true); assert.equal(h.api.finalPresentationUrl, null)
  assert.equal(area(h.api).result.nativeIframeMounted, true)
  return { discussionHasNoInventedFinal: true, manualNativeCanvasMounted: true }
})
await check('loaded metadata owner remains independent of socket adoption but mismatched displayed session cannot mount its native target', async () => {
  const h = await hook({ state: finalState })
  const foreignMessages = messages.map(message => ({ ...message, session_id: 'synthetic-foreign-session' }))
  const foreignState = { ...finalState, deckOwnerSessionId: 'synthetic-foreign-session', finalPresentationId: 'synthetic-foreign-final', presentationId: 'synthetic-foreign-final',
    finalPresentationUrl: `${origin}/p/synthetic-foreign-final`, presentationUrl: `${origin}/p/synthetic-foreign-final` }
  h.api.restoreMessages(foreignMessages, foreignState); await h.advance(0)
  assert.equal(h.api.deckOwnerSessionId, 'synthetic-foreign-session', 'explicit loaded metadata owner is preserved before socket adoption')
  const mismatch = area(h.api)
  assert.equal(mismatch.result.nativeIframeMounted, !expectFixed)
  const selectedOwner = area({ ...h.api, displayedSessionId: 'synthetic-foreign-session' })
  assert.equal(selectedOwner.result.nativeIframeMounted, true, 'a user-selected loaded owner can mount before its socket adopts')
  return { mismatchedDisplayedSessionNativeMounted: mismatch.result.nativeIframeMounted, selectedLoadedOwnerNativeMounted: selectedOwner.result.nativeIframeMounted,
    explicitLoadedOwnerPreserved: true, beforeFailure: !expectFixed, connectedCauseProven: false }
})
await check('old socket callback after away/back adoption cannot restore an obsolete deck', async () => {
  const h = await hook({ state: finalState, open: true }), oldCallback = h.sockets[0].onmessage
  h.adopt('synthetic-other-session'); await h.advance(0)
  const before = JSON.stringify({ url: h.api.presentationUrl, owner: h.api.deckOwnerSessionId, messages: h.api.messages })
  oldCallback({ data: JSON.stringify(frame('presentation_url', 'synthetic-old-return', 5, { url: `${origin}/p/synthetic-obsolete`, presentation_id: 'synthetic-obsolete', slide_count: 1 })) }); await h.advance(0)
  assert.equal(JSON.stringify({ url: h.api.presentationUrl, owner: h.api.deckOwnerSessionId, messages: h.api.messages }), before)
  return { staleNativeCallbackRejected: true }
})
await check('restore retention never overrides a new final claim, explicit strawman choice, stage-four intent or unknown previous owner', async () => {
  const cases = []
  for (const patch of [
    { finalPresentationId: 'synthetic-new-final', finalPresentationUrl: `${origin}/p/synthetic-new-final`, presentationId: 'synthetic-new-final', presentationUrl: `${origin}/p/synthetic-new-final`, activeVersion: 'final', currentStage: 6 },
    { strawmanPresentationId: 'synthetic-preview', strawmanPreviewUrl: `${origin}/p/synthetic-preview`, activeVersion: 'strawman', currentStage: 4 },
    { currentStage: 4 },
  ]) {
    const h = await hook({ state: finalState })
    h.api.restoreMessages(messages, { ...missingMetadata, ...patch }); await h.advance(0)
    assert.notEqual(h.api.presentationUrl, url)
    cases.push({ newClaimOrExplicitIntentRespected: true })
  }
  const unowned = await hook({ state: { ...finalState, deckOwnerSessionId: null } })
  unowned.api.restoreMessages(messages, missingMetadata); await unowned.advance(0)
  assert.notEqual(unowned.api.presentationUrl, url)
  const noDeclaredOwner = await hook({ state: finalState })
  const incoming = { ...missingMetadata }; delete incoming.deckOwnerSessionId
  noDeclaredOwner.api.restoreMessages(messages, incoming); await noDeclaredOwner.advance(0)
  assert.notEqual(noDeclaredOwner.api.presentationUrl, url)
  return { cases: cases.length, unownedPriorNotReused: true, undeclaredIncomingOwnerNotPromoted: true }
})
await check('native loading feedback retires only for current exact iframe load and returns for a new navigation', async () => {
  const h = await hook({ state: finalState }), o = area(h.api)
  assert.ok(o.iframe)
  const loading = tree => viewerNodes(tree).some(node => node.props?.['data-studio-viewer-loading'] === 'true')
  assert.equal(loading(o.nativeTree), expectFixed)
  const source = { src: o.iframe.props.src, contentWindow: { postMessage: refuse } }
  o.iframe.props.ref.current = source
  o.iframe.props.onLoad({ currentTarget: { ...source } })
  assert.equal(loading(o.nativeInstance.render(o.viewer.props)), expectFixed, 'foreign iframe cannot hide the waiting feedback')
  source.src = `${origin}/p/synthetic-wrong-navigation`
  o.iframe.props.onLoad({ currentTarget: source })
  assert.equal(loading(o.nativeInstance.render(o.viewer.props)), expectFixed, 'wrong source URL cannot hide loading')
  source.src = o.iframe.props.src
  o.iframe.props.onLoad({ currentTarget: source })
  assert.equal(loading(o.nativeInstance.render(o.viewer.props)), false)
  const nextProps = { ...o.viewer.props, presentationUrl: `${origin}/p/synthetic-next`, presentationId: 'synthetic-next', finalPresentationUrl: `${origin}/p/synthetic-next` }
  const next = o.nativeInstance.render(nextProps)
  assert.equal(loading(next), expectFixed)
  const nextFrame = viewerNodes(next).find(node => node.type === 'iframe')
  nextFrame.props.ref.current = { src: nextFrame.props.src, contentWindow: { postMessage: refuse } }
  o.iframe.props.onLoad({ currentTarget: source })
  assert.equal(loading(o.nativeInstance.render(nextProps)), expectFixed, 'late old iframe callback cannot retire new navigation feedback')
  return { exactLoadOnly: true, navigationRestartsFeedback: expectFixed, staleLoadRejected: true }
})
if (expectFixed) await check('actual page lifecycle expression and complete PresentationArea agree for owned final state and missing outline structure', async () => {
  const h = await hook({ cached: { ...finalState, messages, userMessages: [] }, state: missingMetadata })
  const source = read('app/builder/page.tsx'), ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let expression
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'studioCanvasLifecycle') { assert.equal(expression, undefined); expression = node.initializer.getText(ast) } ts.forEachChild(node, visit) }
  visit(ast); assert.ok(expression)
  const lifecycleModule = load('lib/studio-canvas-lifecycle.ts')
  const context = { classifyStudioCanvasLifecycle: lifecycleModule.classifyStudioCanvasLifecycle,
    currentSessionId: sessionId, wsSessionId: h.api.sessionId, deckOwnerSessionId: h.api.deckOwnerSessionId,
    effectivePresentationId: h.api.presentationId, effectiveSlideCount: h.api.slideCount, activeVersion: h.api.activeVersion,
    narrationCenterStage: 'real_deck', buildNarration: { active: false, phase: 'idle' }, templateModeSourcePresentationUrl: null,
    directorOwnedPresentation: { presentationUrl: h.api.presentationUrl }, finalPresentationId: h.api.finalPresentationId,
    finalPresentationUrl: h.api.finalPresentationUrl, slideStructure: h.api.slideStructure,
    session: { isLoadingSession: false }, isGeneratingFinal: false, isGeneratingStrawman: false, blankPlaceholderDismissed: false,
    connected: h.api.connected, connecting: h.api.connecting, getPresentationViewerUrl: refuse }
  const lifecycle = vm.runInNewContext(expression, context)
  assert.equal(lifecycle.hasGeneratedDeck, true); assert.equal(lifecycle.showLanding, false)
  const o = area({ ...h.api, studioCanvasLifecycle: lifecycle })
  assert.equal(o.result.nativeSrcMatchesFinal, true); assert.equal(o.result.stagePlaceholder, false)
  return { sourcePageExpressionEvaluated: true, wholeBuilderRouterMountTested: false, sharedLifecycleGenerated: true, nativeTargetRetained: true }
})
await check('actual pending send and native thinking/plan phases use waiting feedback before slides without inventing a final', async () => {
  const reducers = load('lib/build-narration-heuristics.ts')
  let narration = reducers.initialNarrationState()
  const h = await hook({ open: true, handlers: { onBuildPhase: payload => { narration = reducers.narrationReducer(narration, { type: 'typed_phase', payload, ts: time }) } } })
  assert.equal(h.api.sendMessage('Synthetic no-slide topic discussion'), true); await h.advance(0)
  assert.equal(h.api.awaitingDirectorReply, true)
  const pending = area(h.api)
  assert.equal(pending.result.waitingBranch, expectFixed)
  assert.equal(pending.result.nativeIframeMounted, false)
  h.sockets[0].onmessage({ data: JSON.stringify(frame('status_update', 'synthetic-thinking', 2, { status: 'thinking', text: 'Synthetic strategy analysis' })) }); await h.advance(0)
  assert.equal(area(h.api).result.waitingBranch, expectFixed)
  h.sockets[0].onmessage({ data: JSON.stringify(frame('build_phase', 'synthetic-planning-phase', 3, { build_id: 'synthetic-planning-build', presentation_id: null, slide_count: 5, phase: 'planning' })) }); await h.advance(0)
  assert.equal(narration.phase, 'planning'); assert.equal(narration.active, true)
  const planning = area({ ...h.api, buildNarration: narration })
  assert.equal(planning.result.waitingBranch, expectFixed)
  if (expectFixed) { assert.equal(planning.result.ribbonBranch, true); assert.equal(planning.result.footerBranch, true) }
  assert.equal(h.api.finalPresentationUrl, null); assert.equal(h.api.finalPresentationId, null)
  return { pendingBeforeStatusWaits: expectFixed, nativeThinkingWaits: expectFixed, planningChromePreserved: expectFixed, inventedFinal: false }
})
await check('same-owner incomplete restore preserves previously available native version targets alongside retained final', async () => {
  const previewUrl = `${origin}/p/synthetic-existing-preview`, blankUrl = `${origin}/p/synthetic-existing-blank`
  const complete = { ...finalState, strawmanPreviewUrl: previewUrl, strawmanPresentationId: 'synthetic-existing-preview',
    blankPresentationUrl: blankUrl, blankPresentationId: 'synthetic-existing-blank' }
  const h = await hook({ cached: { ...complete, messages, userMessages: [] }, state: missingMetadata })
  assert.equal(h.api.strawmanPreviewUrl === previewUrl, expectFixed)
  assert.equal(h.api.blankPresentationUrl === blankUrl, expectFixed)
  if (expectFixed) {
    h.api.switchVersion('strawman'); await h.advance(0)
    assert.equal(h.api.presentationUrl, previewUrl); assert.equal(h.api.presentationId, 'synthetic-existing-preview')
    h.api.switchVersion('blank'); await h.advance(0)
    assert.equal(h.api.presentationUrl, blankUrl); assert.equal(h.api.presentationId, 'synthetic-existing-blank')
    h.api.switchVersion('final'); await h.advance(0)
    assert.equal(h.api.presentationUrl, url); assert.equal(h.api.presentationId, deckId)
  }
  return { secondaryTargetsRetained: expectFixed, allExistingVersionChoicesWork: expectFixed }
})
await check('explicit template preview can mount across metadata ownership transition without changing template mode or target', async () => {
  const h = await hook({ state: { ...finalState, deckOwnerSessionId: 'synthetic-loaded-template-owner' } })
  const o = area({ ...h.api, templateModeOn: true, templateBuilderEnabled: true })
  assert.equal(o.result.nativeIframeMounted, true)
  assert.equal(o.viewer.props.templateModeOn, true); assert.equal(o.viewer.props.presentationUrl, url)
  return { intentionalTemplateSelectionPreserved: true, nativeTargetUnchanged: true }
})
await check('partial or blocked incoming secondary version claim prevents reusing the old preview or manual target', async () => {
  const complete = { ...finalState, strawmanPreviewUrl: `${origin}/p/synthetic-old-preview`, strawmanPresentationId: 'synthetic-old-preview',
    blankPresentationUrl: `${origin}/p/synthetic-old-blank`, blankPresentationId: 'synthetic-old-blank' }
  let guarded = 0
  for (const [idKey, urlKey] of [['strawmanPresentationId', 'strawmanPreviewUrl'], ['blankPresentationId', 'blankPresentationUrl']]) {
    for (const claim of [{ [idKey]: 'synthetic-new-secondary' }, { [idKey]: 'synthetic-new-secondary', [urlKey]: 'https://foreign-layout.invalid/p/synthetic-new-secondary' }]) {
      const h = await hook({ cached: { ...complete, messages, userMessages: [] }, state: { ...missingMetadata, ...claim } })
      assert.notEqual(h.api[urlKey], complete[urlKey]); assert.notEqual(h.api[idKey], complete[idKey])
      assert.equal(h.api.presentationUrl === url, expectFixed)
      guarded++
    }
  }
  return { guardedIncomingClaims: guarded, guessedOldSecondaryTarget: false }
})
function introFixture() {
  const source = read('hooks/use-studio-outline-preview.ts')
  let cursor = 0, dirty = false, slots = [], effects = [], api, options, now = 0, nextTimer = 0
  const timers = new Map()
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value } },
    useState(value) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof value === 'function' ? value() : value }; return [slots[i].value, update => { const next = typeof update === 'function' ? update(slots[i].value) : update; if (next !== slots[i].value) { slots[i].value = next; dirty = true } }] },
    useCallback(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, n) => value !== old.deps[n])) slots[i] = { callback, deps }; return slots[i].callback },
    useEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, n) => value !== old.deps[n])) { const slot = { deps, cleanup: old?.cleanup }; slots[i] = slot; effects.push(() => { slot.cleanup?.(); slot.cleanup = callback() }) } },
  }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: mod, exports: mod.exports,
    require: name => { assert.equal(name, 'react'); return react }, performance: { now: () => now },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id }, clearTimeout: id => timers.delete(id) })
  function render(next = options) { options = next; let attempts = 0; do { cursor = 0; dirty = false; api = mod.exports.useStudioOutlinePreview(options); while (effects.length) effects.shift()(); assert.ok(++attempts < 30) } while (dirty || effects.length); return api }
  return { render, get api() { return api }, timers,
    advance(ms) { const target = now + ms; let next; while ((next = [...timers].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at)[0])) { now = next[1].at; timers.delete(next[0]); next[1].callback(); render() } now = target; return render() },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}
function pageIntroSeams() {
  const source = read('app/builder/page.tsx'), ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = { handlers: [], forwarder: [], slideForwarder: [], version: [], template: [] }
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.left.getText(ast) === 'buildNarrationHandlersRef.current'
      && node.right.getText(ast).includes('onNativeBuildPhase')) found.handlers.push(node.right.getText(ast))
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onSlideBuilt' && node.initializer.getText(ast).includes('buildNarrationHandlersRef.current')) found.slideForwarder.push(node.initializer.getText(ast))
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onBuildPhase' && node.initializer.getText(ast).includes('buildNarrationHandlersRef.current')) found.forwarder.push(node.initializer.getText(ast))
    if (ts.isJsxAttribute(node) && ['onVersionSwitch', 'onTemplateModeChange'].includes(node.name.getText(ast)) && node.initializer?.expression?.getText(ast).includes('cancelOutlinePreview')) found[node.name.getText(ast) === 'onVersionSwitch' ? 'version' : 'template'].push(node.initializer.expression.getText(ast))
    ts.forEachChild(node, visit)
  }
  visit(ast); for (const list of Object.values(found)) assert.equal(list.length, 1)
  return Object.fromEntries(Object.entries(found).map(([key, value]) => [key, value[0]]))
}
async function integratedIntro() {
  const preview = introFixture(), reducers = load('lib/build-narration-heuristics.ts'), seams = pageIntroSeams()
  let narration = reducers.initialNarrationState(), nativeCalls = 0, handlerOwner, ws
  const handlersRef = { current: {} }
  const previewState = { ...finalState, activeVersion: 'strawman', presentationUrl: `${origin}/p/synthetic-preview`, presentationId: 'synthetic-preview',
    strawmanPreviewUrl: `${origin}/p/synthetic-preview`, strawmanPresentationId: 'synthetic-preview', finalPresentationUrl: null, finalPresentationId: null }
  function renderIntro() {
    preview.render({ enabled: true, sessionId, buildId: narration.buildId, phase: narration.phase, slidesDone: narration.slidesDone,
      activeVersion: ws?.api.activeVersion ?? 'strawman', templateModeOn: false })
    handlersRef.current = vm.runInNewContext(seams.handlers, {
      effectiveBuildNarrationEnabled: true,
      narrationOnBuildPhase: payload => { nativeCalls++; narration = reducers.narrationReducer(narration, { type: 'typed_phase', payload, ts: time }) },
      onNativeBuildPhase: (payload, owner) => { handlerOwner = owner; preview.api.onNativeBuildPhase(payload, owner) },
      narrationOnBuildEvent: refuse, narrationOnSlideBuilt: payload => { narration = reducers.narrationReducer(narration, { type: 'typed_slide_built', payload, ts: time }) }, narrationSyncBuildState: refuse,
    })
  }
  renderIntro()
  const pageForwarder = vm.runInNewContext(seams.forwarder, { buildNarrationHandlersRef: handlersRef })
  const slideModule = { exports: {} }
  const slideSource = ts.transpileModule(`exports.callback = ${seams.slideForwarder}`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  let thumbnails = {}
  vm.runInNewContext(slideSource, { module: slideModule, exports: slideModule.exports, studioShell: true, currentSessionIdRef: { current: sessionId }, buildNarrationHandlersRef: handlersRef,
    setSlideThumbnailUrlsByPresentation: update => { thumbnails = update(thumbnails) },
    setReceivedSlideThumbnailUrlsByPresentation: (presentationId, update) => {
      assert.equal(presentationId, 'synthetic-preview', 'The real received-thumbnail setter retains the native frame presentation ID')
      thumbnails = update(thumbnails)
    },
    mergeStageFPresentationThumbnailUrl: load('lib/stage-f-thumbnails.ts').mergeStageFPresentationThumbnailUrl })
  ws = await hook({ open: true, state: previewState, handlers: { onBuildPhase: pageForwarder, onSlideBuilt: slideModule.exports.callback } })
  async function deliver(payload, owner = sessionId) {
    ws.sockets[0].onmessage({ data: JSON.stringify({ ...frame('build_phase', `synthetic-phase-${nativeCalls}`, 3, payload), session_id: owner }) })
    await ws.advance(0); renderIntro()
  }
  const buildId = 'synthetic-native-intro-build'
  await deliver({ build_id: buildId, presentation_id: 'synthetic-preview', slide_count: 5, phase: 'planning' })
  await deliver({ build_id: buildId, presentation_id: 'synthetic-preview', slide_count: 5, phase: 'building', auto_proceed: true })
  const control = { control: { active: false }, onPause: refuse, onStop: refuse, onResume: refuse }
  const renderArea = () => area({ ...ws.api, buildNarration: narration, showOutlinePreview: preview.api.showOutlinePreview, buildNarrationApi: { control } })
  return { preview, ws, seams, handlersRef, renderIntro, deliver, renderArea, control,
    async deliverSlide() { ws.sockets[0].onmessage({ data: JSON.stringify(frame('slide_built', 'synthetic-first-native-slide', 4, { build_id: buildId, presentation_id: 'synthetic-preview', slide_count: 5, slide_index: 0, thumbnail_url: `${origin}/synthetic-first-native-thumbnail.png` })) }); await ws.advance(0); renderIntro() }, get narration() { return narration }, get nativeCalls() { return nativeCalls }, get owner() { return handlerOwner } }
}
if (expectFixed) {
  await check('actual WS owner and page routing preserve real narration while a bounded actionless intro overlays the same native iframe', async () => {
    const f = await integratedIntro()
    assert.equal(f.owner, sessionId); assert.equal(f.nativeCalls, 2)
    assert.equal(f.narration.phase, 'building'); assert.equal(f.preview.api.showOutlinePreview, true)
    const o = f.renderArea(), placeholder = o.viewer.props.stageChrome.placeholder
    assert.equal(placeholder.props['data-studio-outline-preview'], 'true')
    assert.equal(placeholder.props.className.includes('pointer-events-none'), true)
    assert.equal(o.viewer.props.presentationUrl, `${origin}/p/synthetic-preview`)
    assert.equal(o.viewer.props.stageChrome.ribbon.props.narration, f.narration)
    assert.equal(o.viewer.props.stageChrome.footer.props.narration, f.narration)
    assert.equal(o.viewer.props.stageChrome.ribbon.props.control, f.control)
    assert.equal(o.result.nativeIframeMounted, true); assert.equal(o.result.placeholderInsertedInNative, true)
    const privatePresentation = placeholder.props.children.props.narration
    assert.equal(privatePresentation.phase, 'strawman'); assert.equal(f.narration.phase, 'building', 'visual intro does not rewrite real reducer phase')
    assert.equal(nodes(placeholder).some(node => node.type === 'button' || typeof node.props?.onClick === 'function'), false)
    f.preview.advance(2999); assert.equal(f.preview.api.showOutlinePreview, true)
    f.preview.advance(1); assert.equal(f.preview.api.showOutlinePreview, false)
    const after = f.renderArea()
    assert.equal(after.result.nativeIframeMounted, true); assert.equal(after.viewer.props.presentationUrl, o.viewer.props.presentationUrl)
    assert.equal(after.viewer.props.stageChrome.ribbon.props.control, f.control)
    assert.equal(f.ws.sockets[0].sends.filter(value => value !== 'ping').length, 0, 'intro sends no action/build/viewer command')
    f.preview.unmount()
    return { actualWireOwnerForwarded: true, originalReducerCalls: 2, nativeAndControlsMounted: true, visualOnlyPhaseCopy: true, maxDwellMs: 3000, sentActions: 0 }
  })
  await check('actual first-slide/gate state and same-value page version/template intent immediately retire the intro', async () => {
    for (const patch of [{ slidesDone: 1 }, { phase: 'awaiting_user' }, { phase: 'paused' }]) {
      const f = await integratedIntro()
      if (patch.slidesDone) await f.deliverSlide()
      else await f.deliver({ build_id: f.narration.buildId, presentation_id: 'synthetic-preview', slide_count: 5, phase: patch.phase })
      if (patch.slidesDone) assert.equal(f.narration.slidesDone, 1)
      else assert.equal(f.narration.phase, patch.phase)
      assert.equal(f.preview.api.showOutlinePreview, false); assert.equal(f.preview.timers.size, 0)
      const o = area({ ...f.ws.api, buildNarration: { ...f.narration, ...patch }, showOutlinePreview: f.preview.api.showOutlinePreview, buildNarrationApi: { control: f.control } })
      assert.equal(nodes(o.viewer.props.stageChrome?.placeholder).some(node => node.props?.['data-studio-outline-preview'] === 'true'), false)
      assert.equal(o.result.nativeIframeMounted, true); f.preview.unmount()
    }
    for (const intent of ['version', 'template']) {
      const f = await integratedIntro(), forwarded = []
      const callback = vm.runInNewContext(f.seams[intent], { cancelOutlinePreview: () => f.preview.api.cancelOutlinePreview(), switchVersion: version => { forwarded.push(version); f.ws.api.switchVersion(version) }, handleTemplateModeChange: enabled => forwarded.push(enabled) })
      const before = f.ws.api.presentationUrl
      callback(intent === 'version' ? f.ws.api.activeVersion : false)
      await f.ws.advance(0); f.renderIntro()
      assert.equal(f.preview.api.showOutlinePreview, false)
      assert.deepEqual(forwarded, [intent === 'version' ? 'strawman' : false])
      assert.equal(f.ws.api.presentationUrl, before)
      await f.deliver({ build_id: f.narration.buildId, presentation_id: 'synthetic-preview', slide_count: 5, phase: 'building', auto_proceed: true })
      assert.equal(f.preview.api.showOutlinePreview, false, 'same-value intent quarantines a duplicate receipt')
      f.preview.unmount()
    }
    return { nativeFirstSlideOrGateRetires: true, sameValueVersionIntentRetires: true, sameValueTemplateIntentRetires: true, nativeTargetUnchanged: true }
  })
}
console.log(`${checks} actual hook/area/native component canvas-return groups passed (${expectFixed ? 'candidate' : 'before source'}); no browser/service requests.`)
const evidencePath = process.argv.find(arg => arg.startsWith('--evidence='))?.slice('--evidence='.length)
if (evidencePath) fs.writeFileSync(evidencePath, JSON.stringify({ source: sourceRef ?? 'working-source', expectedFixed: expectFixed, checks, connectedCauseProven: false, results }, null, 2) + '\n')
