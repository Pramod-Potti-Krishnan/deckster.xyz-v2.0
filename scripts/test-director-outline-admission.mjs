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
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
function load(name, ref = null, studio = true) {
  const source = ref ? execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8' }) : read(name)
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, URL, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, fetch: refuse, setTimeout: refuse, require: name => { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name] } })
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

// Complete f746f835 _send_slide_update -> create_slide_update -> model_dump
// shape. Identities/content/times are synthetic. This is a producer-shape
// fixture, not a claim about the undisclosed connected pair.
const baseTime = Date.UTC(2026, 9, 4, 12)
const timestamp = seconds => new Date(baseTime + seconds * 1000).toISOString()
function producerOutline(id, seconds, target, notes = true) {
  return {
    message_id: id, session_id: 'synthetic-session', timestamp: timestamp(seconds),
    type: 'slide_update', role: 'assistant', payload: {
      operation: 'full_update', metadata: {
        main_title: 'Synthetic exact producer outline', overall_theme: 'professional', design_suggestions: '',
        target_audience: 'general', presentation_duration: 15,
        preview_url: `https://synthetic.invalid/p/${target}`, preview_presentation_id: target,
      }, slides: [1, 2, 3].map(number => ({
        slide_id: `slide_${number}`, slide_number: number, slide_type: 'content', title: `Synthetic slide ${number}`,
        subtitle: null, narrative: notes ? `Original detail ${number}` : `Key content about Synthetic slide ${number}`,
        key_points: [`Synthetic point ${number}`], variant_id: null, service: null, purpose: null,
        semantic_group: null, analytics_needed: null, visuals_needed: null, diagrams_needed: null,
        structure_preference: 'L01', container_layout: null, speaker_notes: null,
      })), affected_slides: null, is_blank: false,
    },
  }
}
const original = producerOutline('synthetic-original', 3, 'preview-deck')
const replay = producerOutline('synthetic-replay', 7, 'final-deck', false)
const restoredState = {
  deckOwnerSessionId: 'synthetic-session', activeVersion: 'final', finalPresentationUrl: 'https://synthetic.invalid/p/final-deck',
  finalPresentationId: 'final-deck', presentationUrl: 'https://synthetic.invalid/p/final-deck', presentationId: 'final-deck',
  slideCount: 3, currentStage: 6,
}
const user = (id, seconds) => ({ message_id: id, session_id: 'synthetic-session', timestamp: timestamp(seconds),
  type: 'chat_message', role: 'user', payload: { text: 'Synthetic user turn', sub_title: null, list_items: null, format: 'markdown', ephemeral: false } })
const plan = { ...action('synthetic-old-plan', 1), timestamp: timestamp(1), role: 'assistant' }
const answer = { ...user('synthetic-answer', 2), payload: { ...user('synthetic-answer', 2).payload, text: "Yes, let's build it!", action_value: 'accept_plan' } }
const ready = { ...frame('chat_message', 'synthetic-ready', 8, { text: 'Synthetic presentation is ready.', sub_title: null, list_items: null, format: 'markdown', ephemeral: false }), timestamp: timestamp(8), role: 'assistant' }
const followup = { ...frame('action_request', 'synthetic-current', 9, { prompt_text: 'Current synthetic choices', actions: [{ label: 'Current edit', value: 'edit_current', primary: true, requires_input: true }] }), timestamp: timestamp(9), role: 'assistant' }
async function hookFixture(messages, state = restoredState, cached = null, open = true, settings = {}) {
  const overrides = { ...hookDependencies }
  if (settings.layoutOrigin) overrides['@/lib/layout-service-client'] = { LAYOUT_VIEWER_URL_POLICY: actualPolicy.createLayoutViewerUrlPolicy(settings.layoutOrigin) }
  if (cached) overrides['./use-session-cache'] = { useSessionCache: () => ({ getCachedState: () => cached,
    isCacheValid: () => true, setCachedState(value) { settings.cacheWrites?.push(value) }, clearCache() {} }) }
  const h = createFirstSendHookHarness({ existingSessionId: 'synthetic-session', autoConnect: open }, hookSource, overrides, { NEXT_PUBLIC_STUDIO_V4_SHELL: settings.studio === false ? 'false' : 'true' })
  if (open) { await h.token(0); h.sockets[0].open() }
  await h.advance(baseTime + 10000)
  h.api.restoreMessages(messages, state); await h.advance(0)
  return h
}
function observe(messages, userMessages = []) {
  const tree = render({ ...props(messages), userMessages })
  const outlines = nodes(tree).filter(node => node.type === StudioOutlineCard)
  const html = renderToStaticMarkup(tree)
  return { tree, html, result: {
    rawOutlineEvents: messages.filter(message => message.type === 'slide_update').length,
    outlineCards: outlines.length,
    historyDisclosures: (html.match(/data-studio-director-part="outline-history"/g) ?? []).length,
    historyStatuses: outlines.map(node => node.props.historyStatus ?? null),
    replayMarker: messages.find(message => message.message_id === replay.message_id)?.clientTerminalOutlineRevisionOf === original.message_id,
  } }
}
const results = []
let checks = 0
async function check(name, action) { const result = await action(); checks++; results.push({ check: name, ...result }); console.log(`PASS ${name}`) }
await check('complete source-producer shape admits chronological final revision and preserves native choices and both payloads', async () => {
  const raw = [plan, answer, original, replay, ready, followup], before = JSON.stringify(raw)
  const h = await hookFixture(raw), o = observe(h.api.messages)
  assert.equal(o.result.historyDisclosures, 1); assert.deepEqual(o.result.historyStatuses, ['earlier', 'current'])
  assert.equal(o.result.replayMarker, true); assert.equal(h.api.activeVersion, 'final')
  assert.equal(JSON.stringify(raw), before)
  for (const message of [original, replay]) assert.equal(JSON.stringify(h.api.messages.find(item => item.message_id === message.message_id).payload), JSON.stringify(message.payload))
  assert.equal(cards(o.tree).some(card => card.props.messageId === plan.message_id), false)
  assert.equal(cards(o.tree).filter(card => card.props.messageId === followup.message_id).length, 1)
  assert.match(o.html, /Synthetic presentation is ready/); assert.match(o.html, /Original detail 3/)
  assert.match(o.html, /Key content about Synthetic slide 3/)
  assert.doesNotMatch(o.html, /<details[^>]*data-studio-director-part="outline-history"[^>]* open/)
  return o.result
})
await check('reverse DB insertion order fails admission although rendered chronology is corrected', async () => {
  const h = await hookFixture([replay, original]), o = observe(h.api.messages)
  assert.equal(o.result.outlineCards, 2); assert.equal(o.result.historyDisclosures, 0); assert.equal(o.result.replayMarker, false)
  assert.deepEqual(Array.from(h.api.messages, item => item.message_id), [replay.message_id, original.message_id])
  assert.ok(o.html.indexOf('Original detail 1') < o.html.indexOf('Key content about Synthetic slide 1'))
  return o.result
})
await check('DB-first merge insertion survives cache overwrite and prevents later original from qualifying an already accepted replay', async () => {
  const cached = { ...restoredState, messages: [original], userMessages: [] }
  const h = await hookFixture([replay], restoredState, cached), o = observe(h.api.messages)
  assert.deepEqual(Array.from(h.api.messages, item => item.message_id), [replay.message_id, original.message_id])
  assert.equal(o.result.replayMarker, false); assert.equal(o.result.historyDisclosures, 0)
  assert.equal(o.result.outlineCards, 2)
  return o.result
})
await check('user insertion after original can block same chronological turn without hiding raw versions', async () => {
  const earlierUser = user('synthetic-earlier-turn', 2)
  const blocked = await hookFixture([original, earlierUser, replay]), chronological = await hookFixture([earlierUser, original, replay])
  const a = observe(blocked.api.messages), b = observe(chronological.api.messages)
  assert.equal(a.result.historyDisclosures, 0); assert.equal(a.result.replayMarker, false)
  assert.equal(b.result.historyDisclosures, 1); assert.equal(b.result.replayMarker, true)
  assert.equal(a.result.rawOutlineEvents, 2); assert.equal(b.result.rawOutlineEvents, 2)
  return { insertionOrder: a.result, chronologicalOrder: b.result }
})
await check('actual new native and optimistic user turns preserve distinct versions independently of matching prose', async () => {
  const h = await hookFixture([original, user('synthetic-new-turn', 4), replay]), a = observe(h.api.messages)
  assert.equal(a.result.historyDisclosures, 0); assert.equal(a.result.replayMarker, false)
  const chronological = await hookFixture([original, replay]), b = observe(chronological.api.messages, [{ id: 'synthetic-optimistic', text: 'Synthetic user turn', timestamp: baseTime + 4000 }])
  assert.equal(b.result.historyDisclosures, 0); assert.equal(b.result.replayMarker, true, 'component user-turn validation still rejects the hook marker')
  assert.equal(b.result.outlineCards, 2)
  return { nativeUser: a.result, optimisticUser: b.result }
})
await check('live reconnect before final ownership fails initially and an owned DB restore revalidates the retained transcript', async () => {
  const uncertain = { ...restoredState, activeVersion: 'strawman', strawmanPreviewUrl: 'https://synthetic.invalid/p/preview-deck', strawmanPresentationId: 'preview-deck' }
  const h = await hookFixture([original], uncertain)
  h.sockets[0].onmessage({ data: JSON.stringify(replay) }); await h.advance(0)
  const before = observe(h.api.messages)
  assert.equal(before.result.historyDisclosures, 0); assert.equal(before.result.replayMarker, false)
  h.api.restoreMessages([], restoredState); await h.advance(0)
  const after = observe(h.api.messages)
  assert.equal(after.result.historyDisclosures, 1); assert.equal(after.result.replayMarker, true)
  assert.equal(h.api.activeVersion, 'final')
  return { beforeOwnedRestore: before.result, afterOwnedRestore: after.result }
})
await check('live reconnect with established final owner and chronological sender order keeps the actual final target', async () => {
  const h = await hookFixture([original])
  h.sockets[0].onmessage({ data: JSON.stringify(replay) }); await h.advance(0)
  const o = observe(h.api.messages)
  assert.equal(o.result.historyDisclosures, 1); assert.equal(o.result.replayMarker, true)
  assert.equal(h.api.activeVersion, 'final'); assert.equal(h.api.presentationId, 'final-deck')
  assert.equal(h.api.messages.length, 2)
  return o.result
})
await check('omitted versus null and unknown additive data retain separate outlines rather than discarding a meaningful contract difference', async () => {
  const variants = []
  for (const change of [m => { delete m.payload.slides[0].container_layout }, m => { m.payload.slides[0].container_layout = { arrangement: 'synthetic' } }, m => { m.payload.metadata.unknown_additive = 'synthetic retain' }, m => { m.payload.slides[0].speaker_notes = 'Synthetic revised speaker notes' }]) {
    const distinct = structuredClone(replay); change(distinct)
    const before = JSON.stringify(distinct), h = await hookFixture([original, distinct]), o = observe(h.api.messages)
    assert.equal(o.result.outlineCards, 2); assert.equal(o.result.historyDisclosures, 0)
    assert.equal(JSON.stringify(h.api.messages[1].payload), JSON.stringify(distinct.payload)); assert.equal(JSON.stringify(distinct), before)
    variants.push(o.result)
  }
  return { preservationChallenges: variants, sourceProducerMismatchProven: false }
})
await check('actual executed f746 producer/model serialization admits unchanged or notes-only replay and preserves structural revisions', async () => {
  const receipt = JSON.parse(read('docs/studio-v4/outline-admission-20261004/evidence/director-wire-synthetic.json'))
  assert.equal(receipt.source_ref, 'f746f83503038b07e5103c138ffad90931926209')
  const wires = Object.fromEntries(receipt.scenarios.map(scenario => [scenario.name, scenario.wire]))
  const initial = wires.initial_live_preview
  const sourceFinal = { ...restoredState, finalPresentationId: 'synthetic-final', presentationId: 'synthetic-final',
    finalPresentationUrl: 'https://layout.invalid/p/synthetic-final', presentationUrl: 'https://layout.invalid/p/synthetic-final', slideCount: 1 }
  const outcomes = []
  for (const [name, expectedCards, expectedDisclosures] of [
    ['completed_reconnect_unchanged_saved_strawman', 1, 0],
    ['completed_reconnect_after_notes_only_deckbuilder_normalization_merge', 2, 1],
    ['completed_reconnect_after_notes_and_structural_changes', 2, 0],
  ]) {
    const pair = [initial, wires[name]], before = JSON.stringify(pair)
    const h = await hookFixture(pair, sourceFinal, null, true, { layoutOrigin: 'https://layout.invalid' })
    const o = observe(h.api.messages)
    assert.equal(o.result.outlineCards, expectedCards); assert.equal(o.result.historyDisclosures, expectedDisclosures)
    assert.equal(JSON.stringify(pair), before)
    assert.equal(h.api.messages.length, 2)
    for (let index = 0; index < pair.length; index++) assert.equal(JSON.stringify(h.api.messages[index].payload), JSON.stringify(pair[index].payload))
    outcomes.push({ scenario: name, outlineCards: o.result.outlineCards, historyDisclosures: o.result.historyDisclosures })
  }
  assert.deepEqual(Object.keys(initial.payload.metadata).sort(), Object.keys(original.payload.metadata).sort())
  assert.deepEqual(Object.keys(initial.payload.slides[0]).sort(), Object.keys(original.payload.slides[0]).sort())
  assert.equal(initial.payload.slides[0].container_layout, null); assert.equal(initial.payload.affected_slides, null)
  assert.equal(initial.payload.is_blank, false); assert.equal(initial.role, 'assistant')
  return { producerExecutedOutcomes: outcomes, runtimePydanticVersionMatched: false, connectedCauseProven: false }
})

// Diagnostic candidate tests run only when the actual source exports it.
// They never authorize using the candidate against connected/private data.
const inspect = imports['@/lib/director-history-presentation'].inspectVerifiedOutlineReplay
if (inspect && !sourceRef) {
  const keys = ['reason', 'priorOutlineCount', 'candidateCount', 'nativeUserBoundaryPresent', 'earlierUserAfterPriorInArray',
    'chronologyMismatch', 'fallbackNarrativeMismatch', 'payloadMismatch', 'metadataMismatch', 'slidesMismatch', 'fieldPresenceMismatch', 'unknownFieldMismatch']
  const reasons = new Set(['projected_exact', 'projected_revision', 'not_outline', 'not_terminal', 'missing_displayed_owner',
    'socket_owner_mismatch', 'deck_owner_mismatch', 'frame_owner_mismatch', 'final_id_mismatch', 'final_url_mismatch', 'no_prior_outline',
    'prior_outside_current_turn', 'candidate_mismatch', 'diagnostic_unavailable'])
  const owner = { isTerminal: true, socketSessionId: 'synthetic-session', displayedSessionId: 'synthetic-session',
    deckOwnerSessionId: 'synthetic-session', finalPresentationId: 'final-deck', finalPresentationUrl: 'https://synthetic.invalid/p/final-deck' }
  function assertBounded(diagnostic, forbidden = []) {
    assert.deepEqual(Object.keys(diagnostic).sort(), keys.slice().sort())
    assert.ok(reasons.has(diagnostic.reason))
    for (const key of keys.filter(key => key !== 'reason')) {
      if (key.endsWith('Count')) assert.ok(Number.isInteger(diagnostic[key]) && diagnostic[key] >= 0 && diagnostic[key] <= 255)
      else assert.equal(typeof diagnostic[key], 'boolean')
    }
    for (const secret of forbidden) assert.equal(JSON.stringify(diagnostic).includes(secret), false)
  }
  await check('diagnostic output has a closed schema and refuses arbitrary field names, nested content, identities, URLs and exception text', async () => {
    let cases = 0
    for (const secret of ['SYNTHETIC_PRIVATE_PAYLOAD_VALUE', 'https://synthetic.invalid/private/path?token=SYNTHETIC_SECRET', '</output><script>SYNTHETIC_SECRET</script>', 'SYNTHETIC_PRIVATE_FIELD_NAME']) {
      const changed = structuredClone(replay), prior = structuredClone(original)
      changed.message_id = `${secret}-new`; prior.message_id = `${secret}-old`
      changed.payload.metadata[secret] = { nested: [secret] }; changed.payload.slides[0][secret] = { content: secret }
      changed.payload.slides[0].narrative = secret
      const before = JSON.stringify([prior, changed])
      const diagnostic = inspect(changed, [prior], owner)
      assertBounded(diagnostic, [secret]); assert.equal(diagnostic.reason, 'candidate_mismatch')
      assert.equal(diagnostic.unknownFieldMismatch, true)
      assert.equal(JSON.stringify([prior, changed]), before)
      assert.equal(projectVerifiedOutlineReplay(changed, [prior], owner).clientTerminalOutlineRevisionOf, undefined)
      const privateTarget = { ...changed, session_id: secret, payload: { ...changed.payload, metadata: {
        ...changed.payload.metadata, preview_presentation_id: secret, preview_url: secret } } }
      const privateOwner = { ...owner, socketSessionId: secret, displayedSessionId: secret, deckOwnerSessionId: secret,
        finalPresentationId: secret, finalPresentationUrl: secret }
      assertBounded(inspect(privateTarget, [{ ...prior, session_id: secret }], privateOwner), [secret])
      const throwing = { ...changed, get payload() { throw new Error(secret) } }
      const unavailable = inspect(throwing, [prior], owner)
      assertBounded(unavailable, [secret]); assert.equal(unavailable.reason, 'diagnostic_unavailable')
      cases++
    }
    return { fixedSchemaCases: cases, arbitraryValuesLeaked: false }
  })
  await check('diagnostic distinguishes known producer fields, unknown fields, field presence and chronology without reporting values', async () => {
    const known = structuredClone(replay); known.payload.slides[0].variant_id = 'SYNTHETIC_PRIVATE_VARIANT'
    const knownResult = inspect(known, [original], owner)
    assertBounded(knownResult, ['SYNTHETIC_PRIVATE_VARIANT']); assert.equal(knownResult.slidesMismatch, true)
    assert.equal(knownResult.unknownFieldMismatch, false)
    const missing = structuredClone(replay); delete missing.payload.slides[0].container_layout
    const missingResult = inspect(missing, [original], owner)
    assertBounded(missingResult); assert.equal(missingResult.fieldPresenceMismatch, true)
    const chronology = inspect({ ...replay, timestamp: original.timestamp }, [original], owner)
    assertBounded(chronology); assert.equal(chronology.chronologyMismatch, true)
    const ordering = inspect(replay, [original, user('synthetic-earlier', 2)], owner)
    assertBounded(ordering); assert.equal(ordering.reason, 'prior_outside_current_turn')
    assert.equal(ordering.earlierUserAfterPriorInArray, true)
    const tooMany = Array.from({ length: 600 }, (_, index) => ({ ...known, message_id: `synthetic-prior-${index}` }))
    const capped = inspect(replay, tooMany, owner)
    assertBounded(capped); assert.equal(capped.priorOutlineCount, 255); assert.equal(capped.candidateCount, 255)
    return { knownFieldClassified: true, unknownFieldNamesReported: false, countsCapped: true }
  })
  await check('actual hook diagnostic state is bounded, rejects wire DB/cache forgery and is excluded from generated cache writes', async () => {
    const secret = 'SYNTHETIC_PRIVATE_FORGED_DIAGNOSTIC'
    const forged = { stage: secret, diagnostic: { reason: secret, private: secret } }
    const maliciousOriginal = { ...original, outlineAdmissionDiagnostics: [forged] }
    const maliciousReplay = structuredClone(replay)
    maliciousReplay.outlineAdmissionDiagnostics = [forged]
    maliciousReplay.payload.metadata[secret] = { nested: secret }
    const cached = { ...restoredState, messages: [maliciousOriginal], userMessages: [], outlineAdmissionDiagnostics: [forged] }
    const cacheWrites = []
    const h = await hookFixture([maliciousOriginal], { ...restoredState, outlineAdmissionDiagnostics: [forged] }, cached, true, { cacheWrites })
    for (let index = 0; index < 10; index++) {
      h.sockets[0].onmessage({ data: JSON.stringify({ ...maliciousReplay, message_id: `synthetic-forged-wire-${index}` }) })
      await h.advance(0)
    }
    await h.advance(1000)
    assert.ok(h.api.outlineAdmissionDiagnostics.length > 0 && h.api.outlineAdmissionDiagnostics.length <= 6)
    for (const sample of h.api.outlineAdmissionDiagnostics) {
      assert.deepEqual(Object.keys(sample).sort(), ['diagnostic', 'ingressBlocked', 'stage'])
      assert.ok(['live', 'restore'].includes(sample.stage)); assert.equal(typeof sample.ingressBlocked, 'boolean')
      assertBounded(sample.diagnostic, [secret])
    }
    assert.equal(JSON.stringify(h.api.outlineAdmissionDiagnostics).includes(secret), false)
    assert.ok(cacheWrites.length > 0, 'real hook cache writer exercised')
    for (const write of cacheWrites) assert.equal(Object.hasOwn(write, 'outlineAdmissionDiagnostics'), false)
    assert.equal(h.api.messages[0].outlineAdmissionDiagnostics[0].stage, secret, 'unknown raw fields remain preserved rather than silently scrubbed')
    return { samplesBounded: true, forgedOutputLeaked: false, generatedDiagnosticPersisted: false }
  })
  await check('diagnostic observation preserves actual hook decisions, action arguments and canvas target; classic hook has no samples', async () => {
    const transcript = [plan, answer, original, replay, ready, followup]
    const on = await hookFixture(transcript), off = await hookFixture(transcript, restoredState, null, true, { studio: false })
    const withoutSamples = api => JSON.parse(JSON.stringify(api, (key, value) => key === 'outlineAdmissionDiagnostics' ? undefined : value))
    assert.deepEqual(withoutSamples(on.api), withoutSamples(off.api))
    assert.equal(off.api.outlineAdmissionDiagnostics?.length ?? 0, 0)
    assert.ok(on.api.outlineAdmissionDiagnostics.length > 0)
    const acceptedComponent = load('components/builder/message-list.tsx', '7fc2c2d177fc30cd2572fae7b84c29c50c3ac1a8').MessageList
    const currentTree = render(props(on.api.messages)), acceptedTree = render(props(on.api.messages), true, acceptedComponent)
    const stripDiagnosticOutput = html => html.replace(/<output[^>]*data-studio-outline-presentation-diagnostic[^>]*>[\s\S]*?<\/output>/g, '')
    assert.equal(stripDiagnosticOutput(renderToStaticMarkup(currentTree)), renderToStaticMarkup(acceptedTree))
    const events = [], p = { ...props(on.api.messages), onActionClick: (...args) => events.push(args) }
    const current = cards(render(p)).find(card => card.props.messageId === followup.message_id)
    current.props.onActionClick(followup.payload.actions[0], followup.message_id)
    assert.equal(events.length, 1); assert.equal(events[0][0], followup.payload.actions[0]); assert.equal(events[0][1], followup.message_id)
    assert.equal(on.api.presentationUrl, restoredState.finalPresentationUrl); assert.equal(on.api.presentationId, 'final-deck')
    return { hookStateParity: true, renderedPresentationParity: true, nativeActionArgumentsRetained: true, classicSamples: 0 }
  })
  await check('actual MessageList hidden diagnostic has only fixed booleans/counts and cannot expose arbitrary transcript data', async () => {
    const secret = 'SYNTHETIC_PRIVATE_COMPONENT_DIAGNOSTIC'
    const changed = structuredClone(replay); changed.payload.metadata[secret] = secret
    changed.payload.slides[0].narrative = secret; changed.message_id = secret
    const tree = render(props([original, changed, { ...ready, payload: { text: secret } }]))
    const outputs = nodes(tree).filter(node => node.type === 'output' && node.props['data-studio-outline-presentation-diagnostic'] !== undefined)
    assert.equal(outputs.length, 1); assert.equal(outputs[0].props.hidden, true)
    const diagnostic = JSON.parse(outputs[0].props.children)
    assert.deepEqual(Object.keys(diagnostic).sort(), ['outlineCount', 'exactMarkerCount', 'revisionMarkerCount', 'presentedOutlineCount', 'earlierCount', 'currentCount', 'clientEnvelopeTimeMismatch'].sort())
    assert.equal(JSON.stringify(diagnostic).includes(secret), false)
    for (const value of Object.values(diagnostic)) assert.ok(typeof value === 'boolean' || Number.isInteger(value) && value >= 0 && value <= 255)
    const classicTree = render(props([original, changed]), true, classic)
    assert.equal(nodes(classicTree).filter(node => node.type === 'output' && node.props['data-studio-outline-presentation-diagnostic'] !== undefined).length, 0)
    return { privateOutputLeaked: false, hiddenOutput: true, classicOutputAbsent: true }
  })

  await check('actual page diagnostic output expression renders only sanitized hook samples and session clearing retires observations', async () => {
    const secret = 'SYNTHETIC_PRIVATE_PAGE_VALUE'
    const cached = { ...restoredState, messages: [], userMessages: [], outlineAdmissionDiagnostics: [{ diagnostic: { reason: secret } }] }
    const changed = structuredClone(replay); changed.payload.metadata[secret] = secret
    const h = await hookFixture([original, changed], restoredState, cached)
    const pageAst = ts.createSourceFile('page.tsx', read('app/builder/page.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const outputs = []
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(pageAst) === 'output'
        && node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(pageAst) === 'data-studio-outline-admission-diagnostic')) outputs.push(node)
      ts.forEachChild(node, visit)
    }
    visit(pageAst); assert.equal(outputs.length, 1)
    // Execute the actual page JSX emission only. This is not a full Builder
    // mount or connected integration test; no parent hooks/services run.
    const source = `module.exports = function renderPageDiagnostic(outlineAdmissionDiagnostics) { return ${outputs[0].getText(pageAst)} }`
    const compiled = ts.transpileModule(source, { fileName: 'page-output.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } })
    const mod = { exports: {} }
    vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require: name => { assert.equal(name, 'react/jsx-runtime'); return jsxRuntime } })
    const output = mod.exports(h.api.outlineAdmissionDiagnostics)
    assert.equal(output.props.hidden, true); assert.equal(output.props['aria-hidden'], 'true')
    assert.equal(JSON.stringify(output.props.children).includes(secret), false)
    assert.deepEqual(JSON.parse(output.props.children), JSON.parse(JSON.stringify(h.api.outlineAdmissionDiagnostics)))
    assert.equal(renderToStaticMarkup(output).includes(secret), false)
    h.api.clearMessages(); await h.advance(0)
    assert.equal(h.api.outlineAdmissionDiagnostics?.length ?? 0, 0)
    h.api.restoreMessages([original, replay], restoredState); await h.advance(0)
    assert.ok(h.api.outlineAdmissionDiagnostics.length > 0)
    h.adopt('synthetic-new-session'); await h.advance(0)
    assert.equal(h.api.outlineAdmissionDiagnostics?.length ?? 0, 0)
    return { actualPageOutputExpressionTested: true, fullPageMountTested: false, arbitraryValuesLeaked: false, clearAndSessionAdoptionRetireSamples: true }
  })

}
console.log(`${checks} focused actual hook/component admission checks passed; all identities/content are synthetic and no service/browser actions ran.`)
const evidencePath = process.argv.find(argument => argument.startsWith('--evidence='))?.slice('--evidence='.length)
if (evidencePath) fs.writeFileSync(evidencePath, JSON.stringify({ source: sourceRef ?? 'working-source', backendContractRef: 'f746f83503038b07e5103c138ffad90931926209', checks, connectedCauseProven: false, results }, null, 2) + '\n')

