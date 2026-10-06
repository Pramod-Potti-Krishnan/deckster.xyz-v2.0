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
const evidence = process.argv.find(arg => arg.startsWith('--evidence='))?.slice('--evidence='.length)
const restoreEvidence = process.argv.find(arg => arg.startsWith('--restore-evidence='))?.slice('--restore-evidence='.length)
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
for (const name of ['user-message-attachments','build-progress-visibility','director-chat-history','director-history-presentation','studio-greeting-lifecycle']) imports[`@/lib/${name}`] = load(`lib/${name}.ts`, name === 'director-history-presentation' && sourceRef && sourceRef !== 'ee532fab4b84a6883f8a5b50675ccab692b62240' ? sourceRef : null)
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
const outline = (id, offset, presentationId = 'synthetic-deck') => frame('slide_update', id, offset, { operation: 'full_update', metadata: { main_title: 'Synthetic history outline', presentation_duration: 3, overall_theme: 'Synthetic theme', preview_presentation_id: presentationId, preview_url: `https://synthetic.invalid/p/${presentationId}` }, slides: [1,2,3].map(number => ({ slide_id: `synthetic-slide-${number}`, slide_number: number, title: `Synthetic slide ${number}`, slide_type: 'content', narrative: `Original detail ${number}`, key_points: [`Original point ${number}`] })) })
const final = (id, offset, presentationId = 'synthetic-deck') => frame('presentation_url', id, offset, { url: `https://synthetic.invalid/p/${presentationId}`, presentation_id: presentationId, slide_count: 3 })
const props = messages => ({ sessionId: 'synthetic-session', messages, userMessages: [], userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse, onSubmitAnswers: refuse })
function render(p, reset = true, component = MessageList) { if (reset) slots = []; index = 0; return component(p) }
const countOutlines = tree => nodes(tree).filter(node => node.type === StudioOutlineCard).length
const cards = tree => nodes(tree).filter(node => node.type === QuestionCard)
const earlier = action('synthetic-plan', 1)
const answered = frame('chat_message', 'synthetic-answer', 2, { text: "Yes, let's build it!", action_value: 'accept_plan' }, { role: 'user' })
const ready = frame('chat_message', 'synthetic-ready', 5, { text: 'Synthetic ready response remains complete.' }, { role: 'assistant' })
const followup = frame('action_request', 'synthetic-followup', 6, { prompt_text: 'Current follow-up choices', actions: [{ label: 'Retry current recovery', value: 'retry_current', primary: false, requires_input: false }, { label: 'Edit current deck', value: 'edit_current', primary: true, requires_input: true }] })
const restored = [earlier, answered, outline('synthetic-original-outline', 3), final('synthetic-final', 4), ready, followup, outline('synthetic-state-replay', 7)]
const restoredJSON = JSON.stringify(restored)
const tree = render(props(restored))
const html = renderToStaticMarkup(tree)
const observation = { source: sourceRef ?? 'working-source', outlineCards: (html.match(/>Synthetic history outline</g) ?? []).length, enabledEarlierPlan: cards(tree).some(node => node.props.messageId === earlier.message_id), followupCards: cards(tree).filter(node => node.props.messageId === followup.message_id).length }
const retargetOriginal = outline('preview-outline', 1, 'preview-deck'), retargetReplay = outline('final-state-replay', 7, 'final-deck')
const retargetOwner = { isTerminal: true, socketSessionId: 'synthetic-session', displayedSessionId: 'synthetic-session', deckOwnerSessionId: 'synthetic-session', finalPresentationId: 'final-deck', finalPresentationUrl: 'https://synthetic.invalid/p/final-deck' }
const retargetProjected = projectVerifiedOutlineReplay(retargetReplay, [retargetOriginal], retargetOwner)
const retargetCount = replay => (renderToStaticMarkup(render(props([retargetOriginal, final('retarget-final', 4, 'final-deck'), replay]))).match(/>Synthetic history outline</g) ?? []).length
observation.unverifiedDifferentDeckOutlines = retargetCount(retargetReplay)
observation.verifiedStateReplayOutlines = retargetCount(retargetProjected)
console.log(JSON.stringify(observation))
if (evidence) fs.writeFileSync(evidence, `<!doctype html><meta charset="utf-8"><title>Synthetic actual history rendering</title><style>body{font:13px system-ui;margin:24px;background:#f8fafc}main{max-width:460px;padding:16px;background:white;--ss-accent:#7655cf;--ss-panel:white;--ss-line:#dbe0e8;--ss-text:#263445;--ss-muted:#637286;--ss-teal:#197f88;--ss-surface:#f4f6f9;--ss-active:#edf7f7}button{font:inherit;padding:6px 10px;border:1px solid #dbe0e8;border-radius:6px}button:disabled{opacity:.55}p{line-height:1.5}${read('components/builder/studio-director.css')}</style><main data-studio-v4-shell="true"><p>Synthetic actual-component fixture; services and timers disabled.</p>${html}</main>`)
// Evaluate the full production hook with synthetic sockets and the real pure
// ownership/history/policy modules. No service requests leave the harness.
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
const restoredState = { deckOwnerSessionId: 'synthetic-session', activeVersion: 'final', finalPresentationUrl: retargetOwner.finalPresentationUrl, finalPresentationId: 'final-deck', presentationUrl: retargetOwner.finalPresentationUrl, presentationId: 'final-deck', slideCount: 3, currentStage: 6 }
const hookOriginal = { ...retargetOriginal, timestamp: new Date(1000).toISOString() }
const hookReplay = { ...retargetReplay, timestamp: new Date(7000).toISOString() }
async function hookFixture(messages = [hookOriginal], state = restoredState) {
  const h = createFirstSendHookHarness({ existingSessionId: 'synthetic-session' }, hookSource, hookDependencies)
  await h.token(0); h.sockets[0].open(); await h.advance(10000)
  h.api.restoreMessages(messages, state); await h.advance(0)
  return h
}
const liveHook = await hookFixture()
liveHook.sockets[0].onmessage({ data: JSON.stringify(hookReplay) }); await liveHook.advance(0)
const hookObservation = { source: sourceRef ?? 'working-source', verifiedMarker: liveHook.api.messages.find(message => message.message_id === retargetReplay.message_id)?.clientOutlineReplayOf ?? null, activeVersion: liveHook.api.activeVersion, presentationId: liveHook.api.presentationId, renderedOutlines: (renderToStaticMarkup(render(props(liveHook.api.messages))).match(/>Synthetic history outline</g) ?? []).length }
console.log(`HOOK ${JSON.stringify(hookObservation)}`)
// Minimized reproduction uses only sanctioned rendered title/narrative fields.
// IDs, URL pair, timestamps and hidden payload consistency are synthetic.
const observed = JSON.parse(read('docs/studio-v4/restore-outline-20261004/evidence/observed-outline-fields.json'))
function observedOutline(snapshot, id, presentationId, time) {
  const base = outline(id, time, presentationId)
  base.timestamp = new Date(time * 1000).toISOString()
  base.payload.metadata = { ...base.payload.metadata, main_title: snapshot.title, overall_theme: 'professional', target_audience: 'general audience', presentation_duration: 15 }
  base.payload.slides = snapshot.slides.map(slide => ({ slide_id: `synthetic-observed-${slide.number}`, slide_number: Number(slide.number), title: slide.title, slide_type: slide.kind, narrative: slide.narrative, key_points: slide.keyPoints }))
  return base
}
const observedOriginal = observedOutline(observed.outlines[0], 'synthetic-observed-original', 'preview-deck', 1)
const observedReplay = observedOutline(observed.outlines[1], 'synthetic-observed-reconnect', 'final-deck', 7)
const observedHook = await hookFixture([observedOriginal])
observedHook.sockets[0].onmessage({ data: JSON.stringify(observedReplay) }); await observedHook.advance(0)
const observedContext = Object.fromEntries(observed.outlines[0].slides.map((slide, index) => [index, { slide_index: index, key_message: slide.contextKeyMessage, narrative_role: slide.contextRole.replaceAll(' ', '_') }]))
const observedPlan = { ...earlier, timestamp: new Date(100).toISOString() }, observedAnswer = { ...answered, timestamp: new Date(500).toISOString() }
const observedReady = { ...ready, timestamp: new Date(8000).toISOString() }, observedFollowup = { ...followup, timestamp: new Date(9000).toISOString() }
const observedProps = messages => ({ ...props([observedPlan, observedAnswer, ...messages, observedReady, observedFollowup]),
  userMessages: [{ id: 'synthetic-observed-prompt', text: 'Synthetic observed restore check', timestamp: 50 }], slideContextByIndex: observedContext })
const observedTree = render(observedProps(observedHook.api.messages))
const observedHtml = renderToStaticMarkup(observedTree)
const restoredObservation = { source: sourceRef ?? 'working-source', currentOutlineSections: (observedHtml.match(/data-studio-director-part="outline-review"/g) ?? []).length,
  historicalOutlineSections: (observedHtml.match(/data-studio-director-part="outline-history-review"/g) ?? []).length,
  totalVersionCards: (observedHtml.match(/>Studio Canvas Completion Check — Paper Airplanes</g) ?? []).length,
  verifiedRevisionOf: observedHook.api.messages[1]?.clientTerminalOutlineRevisionOf ?? null,
  activeVersion: observedHook.api.activeVersion, originalNarrativesRetained: observed.outlines[0].slides.every(slide => observedHtml.includes(slide.narrative)), reconnectNarrativesRetained: observed.outlines[1].slides.every(slide => observedHtml.includes(slide.narrative)) }
console.log(`RESTORE ${JSON.stringify(restoredObservation)}`)
if (restoreEvidence) fs.writeFileSync(restoreEvidence, `<!doctype html><meta charset="utf-8"><title>Observed narrative restore reproduction</title><style>body{font:13px system-ui;margin:24px;background:#f8fafc}main{max-width:460px;padding:16px;background:white;--ss-accent:#7655cf;--ss-panel:white;--ss-line:#dbe0e8;--ss-text:#263445;--ss-muted:#637286;--ss-teal:#197f88;--ss-surface:#f4f6f9;--ss-active:#edf7f7}button:disabled{opacity:.55}${read('components/builder/studio-director.css')}</style><main data-studio-v4-shell="true"><p>Actual-component/hook reproduction of observed narratives; ownership/hidden fields synthetic, services disabled.</p>${observedHtml}</main>`)
if (sourceRef) process.exit(0)

let checks = 0
function check(name, run) { run(); checks++; console.log(`PASS ${name}`) }
check('actual component restored outline replay is one card; old plan is read-only; current follow-ups survive', () => {
  assert.equal(observation.outlineCards, 1); assert.equal(observation.enabledEarlierPlan, false); assert.equal(observation.followupCards, 1)
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Original detail 3/); assert.match(html, /Original point 3/); assert.match(html, /Synthetic ready response remains complete/)
  assert.match(html, /Earlier Director choices/); assert.match(html, /Yes, let/); assert.match(html, /disabled=""/)
  assert.equal(JSON.stringify(restored), restoredJSON, 'raw message identities and complete payloads remain unchanged')
})
check('retained old callback refuses restored closure; current native action object/ID still dispatches', () => {
  const events = [], p = props([earlier]); p.onActionClick = (...args) => events.push(args)
  const oldCallback = cards(render(p))[0].props.onActionClick
  render({ ...p, messages: restored }, false)
  oldCallback(earlier.payload.actions[0], earlier.message_id); assert.equal(events.length, 0)
  const current = cards(render({ ...p, messages: restored }, false)).find(node => node.props.messageId === followup.message_id)
  current.props.onActionClick(followup.payload.actions[1], followup.message_id)
  assert.equal(events[0][0], followup.payload.actions[1]); assert.equal(events[0][1], followup.message_id)
})
check('answered ref transition blocks a callback before parent history rerender', () => {
  const events = [], p = props([earlier]); p.onActionClick = (...args) => events.push(args)
  const callback = cards(render(p))[0].props.onActionClick
  p.answeredActionsRef.current.add(earlier.message_id); callback(earlier.payload.actions[0], earlier.message_id)
  assert.equal(events.length, 0)
})
check('retained structured-submit callback refuses a retired gate and preserves current composed answer arguments', () => {
  const events = [], p = props([earlier]); p.onSubmitAnswers = (...args) => events.push(args)
  const submit = cards(render(p))[0].props.onSubmitAnswers
  submit('Original native answer', 'Original compact echo')
  assert.deepEqual(events[0], ['Original native answer', 'Original compact echo'])
  render({ ...p, messages: restored }, false)
  submit('Obsolete answer', 'Obsolete echo'); assert.equal(events.length, 1)
  const current = cards(render({ ...p, messages: restored }, false)).find(node => node.props.messageId === followup.message_id)
  current.props.onSubmitAnswers('Current native answer', 'Current compact echo')
  assert.deepEqual(events[1], ['Current native answer', 'Current compact echo'])
})
check('unknown/changed fields, different deck/session/user turns and unknown IDs remain separate', () => {
  const original = outline('a', 1), duplicate = outline('b', 2)
  const bot = message => ({ ...message, messageType: 'bot' })
  assert.equal(coalesceOutlineStateReplays([bot(original), bot(duplicate)]).length, 1)
  for (const change of [
    message => { message.payload.slides[0].narrative = 'New revision'; },
    message => { message.payload.metadata.unknown_additive = 'New retained contract data'; },
    message => { message.payload.slides[0].unknown_additive = { details: ['Retain me'] }; },
    message => { message.payload.metadata.preview_presentation_id = 'different-deck'; },
    message => { message.session_id = 'different-session'; },
    message => { delete message.payload.metadata.preview_presentation_id; },
    message => { message.timestamp = 'invalid'; },
    message => { message.payload.operation = 'partial_update'; },
  ]) {
    const changed = structuredClone(duplicate); change(changed)
    assert.equal(coalesceOutlineStateReplays([bot(original), bot(changed)]).length, 2)
  }
  assert.equal(coalesceOutlineStateReplays([bot(original), { id: 'new-user', text: 'Same outline requested anew', timestamp: Date.parse(stamp(2)), messageType: 'user' }, bot(duplicate)]).length, 3)
  assert.equal(coalesceOutlineStateReplays([bot(original), bot(final('other-final', 2, 'different-deck')), bot(outline('other-outline', 3, 'different-deck'))]).length, 3)
})
check('only later same-session native progress closes gates; current retry/edit and uncertain requests stay live', () => {
  assert.equal(historicalActionStatuses([earlier, outline('progress', 2)], new Set()).get(earlier.message_id), 'earlier')
  const approval = action('approval', 3, 'accept_strawman')
  assert.equal(historicalActionStatuses([approval, final('done', 4)], new Set()).get(approval.message_id), 'earlier')
  for (const messages of [[earlier], [outline('old-progress', 0), earlier], [earlier, { ...outline('foreign-progress', 2), session_id: 'foreign' }], [{ ...earlier, timestamp: 'invalid' }, outline('progress', 2)], [approval, outline('still-reviewing', 4)], [followup, final('done', 8)]]) {
    assert.equal(historicalActionStatuses(messages, new Set()).size, 0)
  }
  assert.equal(historicalActionStatuses([earlier, answered], new Set()).get(earlier.message_id), 'answered')
})
check('classic branch and combined outline/action branch apply the same read-only native gate', () => {
  imports['@/lib/mdc-flags'].CHAT_CLARITY = false
  const html = renderToStaticMarkup(render(props(restored), true, classic))
  assert.match(html, /Earlier Director choices/); assert.match(html, /Current follow-up choices/)
  const approval = action('approval', 3, 'accept_strawman')
  const combined = render(props([outline('outline', 1), final('preview-frame', 2), approval, final('completed', 4)]))
  assert.equal(cards(combined).length, 0)
  assert.match(renderToStaticMarkup(combined), /Earlier Director choices/)
  imports['@/lib/mdc-flags'].CHAT_CLARITY = true
})
check('trusted terminal ownership can project final-retargeted replay; mismatches/unknown changes stay separate', () => {
  const original = outline('preview-outline', 1, 'preview-deck'), replay = outline('final-state-replay', 7, 'final-deck')
  const owner = { isTerminal: true, socketSessionId: 'synthetic-session', displayedSessionId: 'synthetic-session', deckOwnerSessionId: 'synthetic-session', finalPresentationId: 'final-deck', finalPresentationUrl: 'https://synthetic.invalid/p/final-deck' }
  const projected = projectVerifiedOutlineReplay(replay, [original], owner)
  assert.equal(projected.clientOutlineReplayOf, original.message_id); assert.equal(replay.clientOutlineReplayOf, undefined)
  assert.equal(coalesceOutlineStateReplays([original, projected].map(message => ({ ...message, messageType: 'bot' }))).length, 1)
  const actual = render(props([original, final('done', 4, 'final-deck'), projected]))
  assert.equal(countOutlines(actual), 1)
  assert.equal(observation.unverifiedDifferentDeckOutlines, 2); assert.equal(observation.verifiedStateReplayOutlines, 1)
  for (const patch of [{ isTerminal: false }, { socketSessionId: 'foreign' }, { displayedSessionId: 'foreign' }, { deckOwnerSessionId: 'foreign' }, { finalPresentationId: 'foreign' }, { finalPresentationUrl: 'https://synthetic.invalid/foreign' }]) {
    assert.equal(projectVerifiedOutlineReplay({ ...replay, clientOutlineReplayOf: 'forged' }, [original], { ...owner, ...patch }).clientOutlineReplayOf, undefined)
  }
  const changed = structuredClone(replay); changed.payload.metadata.unknown_additive = 'New revision'
  assert.equal(projectVerifiedOutlineReplay(changed, [original], owner).clientOutlineReplayOf, undefined)
  assert.equal(projectVerifiedOutlineReplay({ ...replay, session_id: 'foreign' }, [original], owner).clientOutlineReplayOf, undefined)
  assert.equal(projectVerifiedOutlineReplay(replay, [{ ...original, session_id: 'foreign' }], owner).clientOutlineReplayOf, undefined)
  assert.equal(projectVerifiedOutlineReplay(replay, [], owner).clientOutlineReplayOf, undefined)
})
check('observed native reconnect fallback is a preserved revision, not an identical outline', () => {
  assert.equal(restoredObservation.currentOutlineSections, 1); assert.equal(restoredObservation.historicalOutlineSections, 1)
  assert.equal(restoredObservation.totalVersionCards, 2); assert.equal(restoredObservation.activeVersion, 'final')
  assert.equal(restoredObservation.verifiedRevisionOf, observedOriginal.message_id)
  assert.equal(restoredObservation.originalNarrativesRetained, true); assert.equal(restoredObservation.reconnectNarrativesRetained, true)
  assert.match(observedHtml, /<details data-studio-director-part="outline-history"/)
  assert.doesNotMatch(observedHtml, /<details[^>]*data-studio-director-part="outline-history"[^>]* open/)
  assert.match(observedHtml, /Current outline/); assert.match(observedHtml, /Earlier outline/)
  assert.equal(cards(observedTree).some(card => card.props.messageId === observedPlan.message_id), false)
  assert.equal(cards(observedTree).some(card => card.props.messageId === observedFollowup.message_id), true)
  assert.equal(coalesceOutlineStateReplays(observedHook.api.messages.map(message => ({ ...message, messageType: 'bot' }))).length, 2)
  const repeated = projectVerifiedOutlineReplay({ ...observedReplay, message_id: 'synthetic-later-reconnect', timestamp: new Date(12000).toISOString() }, observedHook.api.messages, retargetOwner)
  const retained = presentTerminalOutlineRevisions(coalesceOutlineStateReplays([...observedHook.api.messages, repeated].map(message => ({ ...message, messageType: 'bot' }))))
  assert.equal(retained.length, 2); assert.deepEqual(retained.map(message => message.clientOutlineHistoryStatus), ['earlier', 'current'])
})
check('terminal revision relation rejects additive/structural changes, arbitrary narratives, unknown owners and chronology', () => {
  const original = structuredClone(observedOriginal), replay = structuredClone(observedReplay), before = JSON.stringify([original, replay])
  const projected = projectVerifiedOutlineReplay(replay, [original], retargetOwner)
  assert.equal(projected.clientOutlineReplayOf, undefined); assert.equal(projected.clientTerminalOutlineRevisionOf, original.message_id)
  assert.equal(JSON.stringify([original, replay]), before)
  const bot = message => ({ ...message, messageType: 'bot' })
  for (const change of [message => { message.payload.metadata.unknown_additive = 'Preserved'; },
    message => { message.payload.slides[0].unknown_additive = { extra: true }; },
    message => { message.payload.slides[0].title = 'Real revision'; },
    message => { message.payload.slides[0].slide_id = 'new-structural-id'; },
    message => { message.payload.slides[0].narrative = 'Meaningfully revised notes'; },
    message => { message.payload.slides[0].key_points = ['New semantic detail']; },
    message => { message.timestamp = 'invalid'; }, message => { message.timestamp = original.timestamp; },
    message => { message.session_id = 'foreign'; }, message => { message.payload.operation = 'partial_update'; }]) {
    const changed = structuredClone(replay); change(changed)
    const candidate = projectVerifiedOutlineReplay({ ...changed, clientTerminalOutlineRevisionOf: 'forged' }, [original], retargetOwner)
    assert.equal(candidate.clientTerminalOutlineRevisionOf, undefined)
    assert.ok(presentTerminalOutlineRevisions([bot(original), bot({ ...changed, clientTerminalOutlineRevisionOf: original.message_id })]).every(message => !message.clientOutlineHistoryStatus))
  }
  for (const patch of [{ isTerminal: false }, { socketSessionId: 'foreign' }, { displayedSessionId: 'foreign' }, { deckOwnerSessionId: 'foreign' }, { finalPresentationId: 'foreign' }, { finalPresentationUrl: 'https://synthetic.invalid/foreign' }]) {
    assert.equal(projectVerifiedOutlineReplay({ ...replay, clientTerminalOutlineRevisionOf: 'forged' }, [original], { ...retargetOwner, ...patch }).clientTerminalOutlineRevisionOf, undefined)
  }
  const newUser = frame('chat_message', 'synthetic-new-native-turn', 0, { text: 'A new outline turn' }, { role: 'user', timestamp: new Date(4000).toISOString() })
  assert.equal(projectVerifiedOutlineReplay(replay, [original, newUser], retargetOwner).clientTerminalOutlineRevisionOf, undefined)
  assert.equal(projectVerifiedOutlineReplay(hookReplay, [hookOriginal, newUser], retargetOwner).clientOutlineReplayOf, undefined)
  const separateUser = { id: 'optimistic-new-turn', text: 'New local turn', timestamp: 4000, messageType: 'user' }
  assert.ok(presentTerminalOutlineRevisions([bot(original), separateUser, bot(projected)]).every(message => !message.clientOutlineHistoryStatus))
  const independentlyExpanded = render({ ...observedProps([original, projected]), userMessages: [separateUser] })
  assert.ok(nodes(independentlyExpanded).filter(node => node.type === StudioOutlineCard).every(node => !node.props.historyStatus))
})
console.log(`Actual history presentation: ${checks} component/helper checks passed; no services or browser actions ran.`)
assert.equal(hookObservation.verifiedMarker, retargetOriginal.message_id)
assert.equal(hookObservation.activeVersion, 'final'); assert.equal(hookObservation.presentationId, 'final-deck')
assert.equal(hookObservation.renderedOutlines, 1)
assert.equal(liveHook.api.messages.length, 2, 'both raw transcript events survive projection')
console.log('PASS actual hook live reconnect projects verified replay and retains final viewer state')
const dbHook = await hookFixture([hookOriginal, { ...hookReplay, clientOutlineReplayOf: 'forged' }])
assert.equal(dbHook.api.messages[1].clientOutlineReplayOf, retargetOriginal.message_id)
assert.equal(countOutlines(render(props(dbHook.api.messages))), 1)
for (const state of [{ ...restoredState, deckOwnerSessionId: 'foreign' }, { ...restoredState, finalPresentationId: 'foreign' }, { ...restoredState, activeVersion: 'strawman', strawmanPreviewUrl: 'https://synthetic.invalid/p/preview-deck', strawmanPresentationId: 'preview-deck' }]) {
  const h = await hookFixture([hookOriginal, { ...hookReplay, clientOutlineReplayOf: 'forged' }], state)
  assert.ok(h.api.messages.every(message => !message.clientOutlineReplayOf), 'DB marker stripped before ownership check')
  assert.equal(countOutlines(render(props(h.api.messages))), state.deckOwnerSessionId === 'foreign' ? 0 : 2,
    'existing session merge rejects a foreign owner; same-owner uncertainty keeps both outlines')
}
const changedReplay = structuredClone(hookReplay); changedReplay.payload.metadata.unknown_additive = 'Preserve new content'
const changedHook = await hookFixture([hookOriginal, { ...changedReplay, clientOutlineReplayOf: 'forged' }])
assert.equal(changedHook.api.messages[1].clientOutlineReplayOf, undefined)
assert.equal(countOutlines(render(props(changedHook.api.messages))), 2)
console.log('PASS actual hook DB restore strips supplied marker, revalidates owner/final pair and preserves uncertain revisions')
const cached = { ...restoredState, messages: [hookOriginal, { ...hookReplay, clientOutlineReplayOf: hookOriginal.message_id }], userMessages: [] }
const cache = { getCachedState: () => cached, isCacheValid: () => true, setCachedState() {}, clearCache() {} }
const cacheHook = createFirstSendHookHarness({ existingSessionId: 'synthetic-session', autoConnect: false }, hookSource,
  { ...hookDependencies, './use-session-cache': { useSessionCache: () => cache } })
assert.ok(cacheHook.api.messages.every(message => !message.clientOutlineReplayOf), 'cold cache never admits a persisted client marker')
assert.equal(countOutlines(render(props(cacheHook.api.messages))), 2, 'uncertain cached copies remain visible until revalidated')
cacheHook.api.restoreMessages([], restoredState); await cacheHook.advance(0)
assert.equal(cacheHook.api.messages[1].clientOutlineReplayOf, hookOriginal.message_id)
assert.equal(countOutlines(render(props(cacheHook.api.messages))), 1)
assert.equal(cached.messages[1].clientOutlineReplayOf, hookOriginal.message_id, 'cache admission does not mutate its input')
console.log('PASS actual hook cold cache rejects persisted marker; owned restore establishes fresh provenance')
const nativeUser = frame('chat_message', 'synthetic-new-native-turn', 0, { text: 'Please revise this outline' }, { role: 'user', timestamp: new Date(4000).toISOString() })
const newerTurnHook = await hookFixture([observedOriginal])
newerTurnHook.sockets[0].onmessage({ data: JSON.stringify(nativeUser) }); await newerTurnHook.advance(0)
newerTurnHook.sockets[0].onmessage({ data: JSON.stringify(observedReplay) }); await newerTurnHook.advance(0)
assert.ok(newerTurnHook.api.messages.every(message => !message.clientTerminalOutlineRevisionOf && !message.clientOutlineReplayOf))
assert.equal(newerTurnHook.api.activeVersion, 'strawman', 'new native user turn must still admit the normal outline/review transition')
assert.ok(nodes(render(observedProps(newerTurnHook.api.messages))).filter(node => node.type === StudioOutlineCard).every(node => !node.props.historyStatus))
console.log('PASS actual hook new native user turn refuses historical relation and preserves the normal outline transition')
const revisionDB = await hookFixture([observedOriginal, { ...observedReplay, clientTerminalOutlineRevisionOf: 'forged', clientOutlineReplayOf: 'forged' }])
assert.equal(revisionDB.api.messages[1].clientTerminalOutlineRevisionOf, observedOriginal.message_id)
assert.equal(revisionDB.api.messages[1].clientOutlineReplayOf, undefined)
assert.equal(revisionDB.api.messages.length, 2)
const revisionRendered = nodes(render(observedProps(revisionDB.api.messages))).filter(node => node.type === StudioOutlineCard)
assert.deepEqual(revisionRendered.map(node => node.props.historyStatus), ['earlier', 'current'])
const additiveRevision = structuredClone(observedReplay); additiveRevision.payload.metadata.unknown_additive = 'Keep both expanded'
const additiveDB = await hookFixture([observedOriginal, { ...additiveRevision, clientTerminalOutlineRevisionOf: observedOriginal.message_id }])
assert.ok(additiveDB.api.messages.every(message => !message.clientTerminalOutlineRevisionOf))
assert.ok(nodes(render(observedProps(additiveDB.api.messages))).filter(node => node.type === StudioOutlineCard).every(node => !node.props.historyStatus))
console.log('PASS actual hook DB revalidates distinct revision provenance while preserving additive semantic changes expanded')
const revisionCached = { ...restoredState, messages: [observedOriginal, { ...observedReplay, clientTerminalOutlineRevisionOf: observedOriginal.message_id }], userMessages: [] }
const revisionCache = { getCachedState: () => revisionCached, isCacheValid: () => true, setCachedState() {}, clearCache() {} }
const revisionCacheHook = createFirstSendHookHarness({ existingSessionId: 'synthetic-session', autoConnect: false }, hookSource,
  { ...hookDependencies, './use-session-cache': { useSessionCache: () => revisionCache } })
assert.ok(revisionCacheHook.api.messages.every(message => !message.clientTerminalOutlineRevisionOf))
revisionCacheHook.api.restoreMessages([], restoredState); await revisionCacheHook.advance(0)
assert.equal(revisionCacheHook.api.messages[1].clientTerminalOutlineRevisionOf, observedOriginal.message_id)
console.log('PASS actual hook rejects a cached revision marker and establishes fresh owned provenance on restore')
console.log(`${checks + 6} focused history groups passed with synthetic sockets/clock only.`)
