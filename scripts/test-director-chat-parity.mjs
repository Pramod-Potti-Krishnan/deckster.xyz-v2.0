import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'

// Execute the actual MessageList/QuestionCard offline with isolated hook state.
// Transport, timers and all effects are refused; receipts are synthetic renders.
const predecessor = 'e92d33fa4903c07d464bf9d1d4b98b02b9cc7290'
const reviewBase = 'c6e9e5bbd94d45259568357bbbcea313cc401ebe'
const uat = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const refuse = () => { throw new Error('Offline parity fixture refuses services, timers and mutations') }
let state = [], slot = 0
const flags = { CHAT_CLARITY: true, CHAT_QUESTIONS: true }
const imports = {
  react: { ...React, useMemo: callback => callback(), useState: initial => {
    const index = slot++
    if (!(index in state)) state[index] = initial
    return [state[index], update => { state[index] = typeof update === 'function' ? update(state[index]) : update }]
  }, useRef: current => ({ current }), useEffect() {} },
  'react/jsx-runtime': jsxRuntime, 'react-markdown': ReactMarkdown,
  'lucide-react': Object.fromEntries(['Sparkles', 'ExternalLink', 'User', 'ChevronDown', 'Check', 'CheckCircle2', 'HelpCircle', 'ListChecks', 'PenLine'].map(name => [name, 'span'])),
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' }, '@/components/file-chip': { FileChip: 'span' },
  '@/lib/debug-log': { debugLog() {} }, '@/lib/mdc-flags': flags,
  '@/lib/slide-compose-async': { hasLiveTrackedEphemeralMessage: (ids, tracked) => ids.some(id => tracked.has(id)) },
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => ({ status: 'allowed', url }) },
  '@/lib/build-narration-heuristics': { shouldRerouteEphemeral: Boolean },
  '@/components/builder/chat/studio-welcome': { StudioWelcome: 'span' },
  '@/components/builder/chat/studio-outline-card': { StudioOutlineCard: 'span' }, './studio-director.css': {},
}
function load(source, studio = true) {
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, fetch: refuse, setTimeout: refuse, clearTimeout: refuse, require: name => { assert.ok(name in imports, `Unexpected fixture dependency ${name}`); return imports[name] } })
  return mod.exports
}
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const fromGit = (ref, name) => execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8' })
for (const name of ['user-message-attachments', 'build-progress-visibility', 'director-transcript', 'director-chat-history', 'director-ask-identity', 'director-history-presentation', 'studio-greeting-lifecycle']) imports[`@/lib/${name}`] = load(read(`lib/${name}.ts`))
const cardSource = read('components/builder/chat/question-card.tsx')
const { QuestionCard } = load(cardSource)
imports['@/components/builder/chat/question-card'] = { QuestionCard }
const current = load(read('components/builder/message-list.tsx')).MessageList
const before = load(fromGit(predecessor, 'components/builder/message-list.tsx')).MessageList
const classic = load(read('components/builder/message-list.tsx'), false).MessageList
const currentTranscriptHelper = imports['@/lib/director-transcript']
imports['@/lib/director-transcript'] = load(fromGit(reviewBase, 'lib/director-transcript.ts'))
const beforeReview = load(fromGit(reviewBase, 'components/builder/message-list.tsx')).MessageList
imports['@/lib/director-transcript'] = currentTranscriptHelper
const oldCard = load(fromGit(uat, 'components/builder/chat/question-card.tsx')).QuestionCard
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
function render(component, props, reset = true) { if (reset) state = []; slot = 0; return component(props) }
const fixture = messages => ({ sessionId: 'synthetic-session', userMessages: [], messages, userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse, onSubmitAnswers: refuse })
const chat = (id, text, role, offset = 0) => ({ type: 'chat_message', message_id: id, session_id: 'synthetic-session', timestamp: new Date(Date.UTC(2026,9,4,12,0,offset)).toISOString(), ...(role ? { role } : {}), payload: { text } })
const bodies = tree => nodes(tree).filter(node => node.type === ReactMarkdown).map(node => node.props.children)
const userBodies = tree => nodes(tree).filter(node => node.type === 'p' && node.props.className?.includes('whitespace-pre-wrap')).map(node => node.props.children)
const conversationTexts = tree => nodes(tree).filter(node => node.type === ReactMarkdown || (node.type === 'p' && node.props.className?.includes('whitespace-pre-wrap'))).map(node => node.props.children)
let cases = 0
let afterTimestampChronology
const repeated = fixture([chat('director-one', 'I can help with that.', 'assistant'), chat('director-two', 'I can help with that.', 'assistant', 2)])
const beforeRepeated = render(before, repeated), afterRepeated = render(current, repeated)
assert.equal(bodies(beforeRepeated).length, 1, 'predecessor loses a separate repeated Director turn')
assert.deepEqual(bodies(afterRepeated), ['I can help with that.', 'I can help with that.'])
cases++
for (const component of [current, classic]) {
  const sameId = fixture([chat('same-id', 'Native response', 'assistant'), chat('same-id', 'Native response', 'assistant')])
  assert.equal(bodies(render(component, sameId)).length, 1, 'same event duplicate stays collapsed')
  const repeatedRoleless = fixture([chat('new-one', 'Native response'), chat('new-two', 'Native response', undefined, 2)])
  assert.equal(bodies(render(component, repeatedRoleless)).length, 2, 'distinct roleless Director turns remain')
  const local = { id: 'local-send', text: 'Exact user words', timestamp: Date.UTC(2026,9,4,12) }
  const quoted = { ...fixture([chat('assistant-quote', local.text, 'assistant', 1)]), userMessages: [local], userMessageContentMapRef: { current: new Map([[local.text.toLowerCase(), local.id]]) } }
  assert.equal(bodies(render(component, quoted)).length, 1, 'explicit assistant role wins over same user content')
  assert.equal(userBodies(render(component, quoted)).length, 1)
  const localRepeated = [{ ...local, id: 'local-first' }, { ...local, id: 'local-second', timestamp: local.timestamp + 2000 }]
  const echoes = { ...fixture([chat('echo-first', local.text, 'user'), chat('echo-second', local.text, 'user', 2), chat('remote-third', local.text, 'user', 3)]), userMessages: localRepeated }
  assert.equal(userBodies(render(component, echoes)).length, 3, 'one-to-one echoes retain three repeated actual user turns')
  const tracked = { ...fixture([chat('known-user-id', 'Tracked legacy text')]), userMessageIdsRef: { current: new Set(['known-user-id']) } }
  assert.deepEqual(userBodies(render(component, tracked)), ['Tracked legacy text'], 'tracked legacy users get real user shape')
  const attached = { ...local, attachments: [{ id: 'file-one', name: 'Synthetic context.txt', size: 50, type: 'text/plain' }] }
  const withAttachment = { ...fixture([chat('attachment-echo', local.text, 'user')]), userMessages: [attached] }
  assert.equal(nodes(render(component, withAttachment)).filter(node => node.props?.file?.name === 'Synthetic context.txt').length, 1, 'local attachment metadata survives echo reconciliation')
  const sameIdEcho = { ...fixture([chat(local.id, local.text, 'user'), chat('distinct-remote-user', local.text, 'user', 5)]), userMessages: [local] }
  assert.equal(userBodies(render(component, sameIdEcho)).length, 2, 'same-ID echo cannot consume a later distinct turn twice')
  for (const [remoteOffset, localOffset] of [[0, 60000], [60, 0], [0, 1]]) {
    const distinctSameText = { ...fixture([chat('history-user', local.text, 'user', remoteOffset)]), userMessages: [{ ...local, timestamp: local.timestamp + localOffset }] }
    assert.equal(userBodies(render(component, distinctSameText)).length, 2, 'different timestamps preserve distinct same-text historical/local turns without a proximity heuristic')
  }
  const missingTime = { ...fixture([{ ...chat('missing-timestamp-user', local.text, 'user'), timestamp: undefined }]), userMessages: [{ ...local, timestamp: Number.NaN }] }
  assert.equal(userBodies(render(component, missingTime)).length, 2, 'missing/invalid timestamps cannot establish cross-ID echo identity')
  const changedText = { ...fixture([chat('different-text-user', 'Different exact words', 'user')]), userMessages: [local] }
  assert.equal(userBodies(render(component, changedText)).length, 2, 'same timestamp alone cannot establish echo identity')
  const lateExactEcho = { ...fixture([chat('earlier-cross-id-turn', local.text, 'user'), chat(local.id, local.text, 'user')]), userMessages: [local] }
  assert.equal(userBodies(render(component, lateExactEcho)).length, 2, 'later exact-ID echo reserves its local turn before earlier cross-ID matching')
  for (const timestamp of ['2026-10-04T08:00:00-04:00', '2026-10-04T17:30:00+05:30', '2026-10-04T12:00:00', '2026-10-04T12:00:00Z']) {
    const equivalentEcho = { ...fixture([{ ...chat('offset-user-echo', local.text, 'user'), timestamp }]), userMessages: [local] }
    assert.equal(userBodies(render(component, equivalentEcho)).length, 1, 'equivalent offset/Z/naive UTC instants reconcile against numeric local time')
  }
  const chronology = { ...fixture([
    { ...chat('director-late-offset', 'Director later', 'assistant'), timestamp: '2026-10-04T17:31:00+05:30' },
    { ...chat('explicit-user-offset', 'Explicit user middle', 'user'), timestamp: '2026-10-04T08:00:30-04:00' },
    { ...chat('legacy-user-offset', 'Tracked user earlier'), timestamp: '2026-10-04T17:30:10+05:30' },
    { ...chat('director-early-z', 'Director first', 'assistant'), timestamp: '2026-10-04T12:00:00Z' },
  ]), userMessages: [{ id: 'numeric-local-user', text: 'Numeric local middle', timestamp: local.timestamp + 20000 }], userMessageIdsRef: { current: new Set(['legacy-user-offset']) } }
  assert.deepEqual(conversationTexts(render(component, chronology)), ['Director first', 'Tracked user earlier', 'Numeric local middle', 'Explicit user middle', 'Director later'], 'both user-shaping paths and bot timestamps share chronological timezone parsing')
  if (component === current) afterTimestampChronology = render(component, chronology)
  const clientOrder = fixture([
    { ...chat('numeric-client-late', 'Client later', 'assistant'), timestamp: '2026-10-04T12:00:00Z', clientTimestamp: local.timestamp + 2000 },
    { ...chat('numeric-client-zero', 'Client epoch first', 'assistant'), timestamp: '2026-10-04T12:00:00Z', clientTimestamp: 0 },
    { ...chat('numeric-client-middle', 'Client middle', 'assistant'), timestamp: '2026-10-04T12:00:01Z' },
  ])
  assert.deepEqual(bodies(render(component, clientOrder)), ['Client epoch first', 'Client middle', 'Client later'], 'finite numeric client timestamps, including zero, remain authoritative')
  cases += 19
}
const reviewLocal = { id: 'review-local', text: 'Synthetic exact timezone answer', timestamp: Date.UTC(2026,9,4,12) }
const offsetReview = { ...fixture([{ ...chat('review-offset-echo', reviewLocal.text, 'user'), timestamp: '2026-10-04T08:00:00-04:00' }]), userMessages: [reviewLocal] }
const beforeOffset = render(beforeReview, offsetReview), afterOffset = render(current, offsetReview)
assert.equal(userBodies(beforeOffset).length, 2, 'pre-review append-Z corrupts a valid offset and prevents equivalent-time reconciliation')
assert.equal(userBodies(afterOffset).length, 1)
const reserveReview = { ...fixture([chat('review-earlier-cross-id', reviewLocal.text, 'user'), chat(reviewLocal.id, reviewLocal.text, 'user')]), userMessages: [reviewLocal] }
const beforeReservation = render(beforeReview, reserveReview), afterReservation = render(current, reserveReview)
assert.equal(userBodies(beforeReservation).length, 1, 'pre-review cross-ID match consumes a turn before its later exact-ID echo')
assert.equal(userBodies(afterReservation).length, 2)
cases += 2
const set = { id: 'native-set', intro: 'Native short intro', questions: [
  { id: 'audience-native', text: 'Who is the audience?', suggestions: [{ label: 'Native leadership', recommended: true }, { label: 'Native students' }], allow_free_text: true },
  { id: 'goal-native', text: 'What is the goal?', suggestions: [{ label: 'Native teach' }], allow_free_text: true },
] }
const skip = { label: 'Skip — use sensible defaults', value: 'skip_questions', primary: false, requires_input: false }
const action = { type: 'action_request', message_id: 'native-ask', session_id: 'synthetic-session', timestamp: '2026-10-04T12:00:03Z', payload: { prompt_text: 'Native intro\n\n• fallback question one\n\n• fallback question two', actions: [skip], question_set: set } }
const duplicateActions = fixture([action, { ...action, message_id: 'second-native-ask' }])
assert.equal(nodes(render(before, duplicateActions)).filter(node => node.type === QuestionCard).length, 1)
assert.equal(nodes(render(current, duplicateActions)).filter(node => node.type === QuestionCard).length, 2, 'separate action IDs survive identical payloads')
cases++
const cardProps = { studio: true, promptText: action.payload.prompt_text, actions: action.payload.actions, messageId: action.message_id, questionSet: set, structuredEnabled: true }
const cardControls = tree => ({ suggestions: nodes(tree).filter(node => node.type === 'button' && node.props['data-studio-director-option'] === 'suggestion'), inputs: nodes(tree).filter(node => node.type === 'input'), send: nodes(tree).find(node => node.props?.['data-studio-director-part'] === 'send'), actions: nodes(tree).filter(node => node.props?.['data-studio-director-option'] === 'action') })
for (const gate of [{ structuredEnabled: false }, { questionSet: null }, { questionSet: { ...set, questions: [] } }, { onSubmitAnswers: undefined }]) {
  const tree = render(QuestionCard, { ...cardProps, onSubmitAnswers: refuse, onActionClick: refuse, ...gate })
  assert.equal(cardControls(tree).suggestions.length, 0)
  assert.equal(cardControls(tree).actions.length, 1, 'old-payload/flag/callback fallback retains native action')
  assert.ok(nodes(tree).some(node => node.props?.children === action.payload.prompt_text), 'full fallback prose retained')
  cases++
}
const events = []
const props = { ...cardProps, onSubmitAnswers: (...args) => events.push(['answer', ...args]), onActionClick: (...args) => events.push(['action', ...args]) }
let tree = render(QuestionCard, props)
let controls = cardControls(tree)
assert.equal(controls.inputs.length, 1); assert.equal(controls.suggestions.length, 2)
assert.equal(controls.send.props.disabled, true, 'recommended highlight never auto-submits')
controls.suggestions[0].props.onClick()
tree = render(QuestionCard, props, false); controls = cardControls(tree)
assert.equal(controls.inputs.length, 2, 'next question appears after first choice')
assert.equal(controls.suggestions[0].props['aria-pressed'], true)
controls.inputs[1].props.onChange({ target: { value: '  Native exact custom answer!  ' } })
tree = render(QuestionCard, props, false); controls = cardControls(tree)
controls.send.props.onClick()
assert.deepEqual(events[0], ['answer', 'Who is the audience: Native leadership\nWhat is the goal: Native exact custom answer!', 'Answers: Native leadership · Native exact custom answer!'])
controls.actions[0].props.onClick()
assert.equal(events[1][1], skip); assert.equal(events[1][2], action.message_id, 'native Skip ID/value/object preserved')
controls.suggestions[0].props.onClick()
assert.equal(cardControls(render(QuestionCard, props, false)).inputs.length, 1, 'deselect collapses the next sequential question')
cases += 5

// Compare real UAT and Studio submit output/state semantics directly. New
// design is allowed; the full Director text and compact user echo stay exact.
for (const card of [oldCard, QuestionCard]) {
  const results = [], p = { ...cardProps, onActionClick: refuse, onSubmitAnswers: (...args) => results.push(args) }
  render(card, p)
  state = [{ 'audience-native': 'Native leadership' }, { 'goal-native': 'Native exact custom answer!' }]
  const t = render(card, p, false)
  const send = nodes(t).find(node => node.type === 'button' && typeof node.props.onClick === 'function' && node.props.disabled === false)
  send.props.onClick()
  assert.equal(JSON.stringify(results[0]), JSON.stringify(events[0].slice(1)))
  cases++
}

for (const questionsEnabled of [false, true]) {
  flags.CHAT_QUESTIONS = questionsEnabled
  for (const messages of [[action], [{ type: 'slide_update', message_id: 'outline-native', session_id: 'synthetic-session', timestamp: '2026-10-04T12:00:01Z', payload: { slides: [], metadata: { main_title: 'Synthetic outline', presentation_duration: 10, overall_theme: 'native' } } }, { type: 'presentation_url', message_id: 'url-native', session_id: 'synthetic-session', timestamp: '2026-10-04T12:00:02Z', payload: { url: 'https://example.invalid/p/synthetic', presentation_url: 'https://example.invalid/p/synthetic' } }, action]]) {
    const card = nodes(render(current, fixture(messages))).find(node => node.type === QuestionCard)
    assert.ok(card); assert.equal(card.props.structuredEnabled, questionsEnabled); assert.equal(card.props.questionSet, set)
    assert.equal(card.props.messageId, action.message_id); assert.equal(card.props.actions, action.payload.actions)
    const retired = fixture(messages); retired.answeredActionsRef.current.add(action.message_id)
    assert.equal(nodes(render(current, retired)).filter(node => node.type === QuestionCard).length, 0, 'native answered-action gate in both render paths')
    cases++
  }
}
flags.CHAT_QUESTIONS = true
const historicalUser = { ...fixture([chat('older-history-user', 'Repeated exact user answer', 'user')]), userMessages: [{ id: 'newer-local-user', text: 'Repeated exact user answer', timestamp: Date.UTC(2026,9,4,12,1) }] }
const beforeHistoricalUser = render(before, historicalUser), afterHistoricalUser = render(current, historicalUser)
assert.equal(userBodies(beforeHistoricalUser).length, 1)
assert.equal(userBodies(afterHistoricalUser).length, 2, 'older historical turn cannot retire a newer same-text local send')
cases++
for (const status of ['thinking', 'generating', 'complete', 'error']) {
  const props = { ...fixture([]), currentStatus: { status, text: 'Synthetic native progress' } }
  const thoughts = tree => nodes(tree).filter(node => node.props?.['data-studio-director-part'] === 'thinking')
  assert.equal(thoughts(render(current, props)).length, ['thinking', 'generating'].includes(status) ? 1 : 0)
  assert.equal(thoughts(render(current, { ...props, suppressEphemeral: true })).length, 0, 'native narration owner suppresses duplicate chat pulse')
  cases++
}
const nativeThinking = { ...chat('synthetic-thinking', 'Synthetic exact live thought'), payload: { text: 'Synthetic exact live thought', ephemeral: true } }
assert.equal(nodes(render(current, { ...fixture([nativeThinking]), ephemeralMessageIds: [nativeThinking.message_id], isGeneratingFinal: true })).filter(node => node.props?.['data-studio-director-part'] === 'thinking').length, 1, 'tracked progress group replaces duplicate working pulse')
assert.equal(nodes(render(current, { ...fixture([nativeThinking]), ephemeralMessageIds: [] })).filter(node => node.props?.['data-studio-director-part'] === 'thinking').length, 0, 'untracked stale progress remains suppressed')
cases += 2
const evidenceIndex = process.argv.indexOf('--evidence-dir')
if (evidenceIndex !== -1) {
  const dir = process.argv[evidenceIndex + 1]; fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(`${dir}/choices-before.html`, renderToStaticMarkup(beforeRepeated))
  fs.writeFileSync(`${dir}/choices-after.html`, renderToStaticMarkup(afterRepeated))
  fs.writeFileSync(`${dir}/historical-user-before.html`, renderToStaticMarkup(beforeHistoricalUser))
  fs.writeFileSync(`${dir}/historical-user-after.html`, renderToStaticMarkup(afterHistoricalUser))
  fs.writeFileSync(`${dir}/timestamp-offset-before.html`, renderToStaticMarkup(beforeOffset))
  fs.writeFileSync(`${dir}/timestamp-offset-after.html`, renderToStaticMarkup(afterOffset))
  fs.writeFileSync(`${dir}/exact-id-reservation-before.html`, renderToStaticMarkup(beforeReservation))
  fs.writeFileSync(`${dir}/exact-id-reservation-after.html`, renderToStaticMarkup(afterReservation))
  fs.writeFileSync(`${dir}/timestamp-chronology-after.html`, renderToStaticMarkup(afterTimestampChronology))
  fs.writeFileSync(`${dir}/structured-flag-off.html`, renderToStaticMarkup(render(QuestionCard, { ...props, structuredEnabled: false })))
  fs.writeFileSync(`${dir}/structured-flag-on.html`, renderToStaticMarkup(render(QuestionCard, props)))
  fs.writeFileSync(`${dir}/choices-results.json`, JSON.stringify({ level: 'offline actual component render; no connected operation', predecessor, reviewBase, uatFrontend: uat, cases, repeatedDirector: { before: bodies(beforeRepeated), after: bodies(afterRepeated), IDs: repeated.messages.map(message => message.message_id) }, historicalSameTextUser: { beforeCount: userBodies(beforeHistoricalUser).length, afterCount: userBodies(afterHistoricalUser).length, remoteTimestamp: historicalUser.messages[0].timestamp, localTimestamp: historicalUser.userMessages[0].timestamp, reconciliation: 'same ID, or exact text plus equal finite timestamp one-to-one; no proximity window' }, timezoneEcho: { beforeCount: userBodies(beforeOffset).length, afterCount: userBodies(afterOffset).length, incomingTimestamp: offsetReview.messages[0].timestamp, localTimestamp: reviewLocal.timestamp }, exactIdReservation: { beforeCount: userBodies(beforeReservation).length, afterCount: userBodies(afterReservation).length }, chronologicalOutput: conversationTexts(afterTimestampChronology), nativeQuestionSet: set, nativeSkip: skip, submission: events[0].slice(1), structuredFlagOff: 'fallback prose + native Skip', structuredFlagOn: 'sequential suggestion/free-text card', refusalPolicy: 'effects/timers/services are blocked; no account data used' }, null, 2) + '\n')
}
console.log(`Director chat parity: ${cases} actual-component offline cases passed; repeat Director/action identity, authoritative roles, one-to-one user echoes, attachments, exact current UAT sequential answers/compact echo/Skip and both CHAT_QUESTIONS paths. No service/account/browser writes or connected success claimed.`)
