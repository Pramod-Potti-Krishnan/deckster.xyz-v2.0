import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Execute the real Builder adapter and QuestionCard composer with explicit
// offline dependencies. No mounting, network, socket or persistence service.
const pageText = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
const cardText = fs.readFileSync(new URL('../components/builder/chat/question-card.tsx', import.meta.url), 'utf8')
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const page = parse('page.tsx', pageText)
const card = parse('question-card.tsx', cardText)
assert.equal(page.parseDiagnostics.length, 0, 'Builder syntax')
assert.equal(card.parseDiagnostics.length, 0, 'QuestionCard syntax')
function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
function declaration(root, name) {
  const node = find(root, node => ts.isVariableDeclaration(node) && node.name.getText(root) === name)
  assert.ok(node, `missing native ${name}`)
  return node.initializer
}
function answerCallback(root) {
  const attr = find(root, node => ts.isJsxAttribute(node) && node.name.getText(root) === 'onSubmitAnswers')
  assert.ok(attr?.initializer && ts.isJsxExpression(attr.initializer))
  return attr.initializer.expression
}
const preflight = declaration(page, 'preflightDirectorTurn').arguments[0]
const answer = answerCallback(page)
const cardSubmit = declaration(card, 'submit')
const printer = ts.createPrinter({ removeComments: true })
const print = (node, root) => printer.printNode(ts.EmitHint.Unspecified, node, root)

// Exact native structured-answer options, independent of template/typed paths.
const uat = parse('uat.tsx', execFileSync('git', ['show', 'ee532fab4b84a6883f8a5b50675ccab692b62240:app/builder/page.tsx'], { encoding: 'utf8' }))
const send = (node, name) => find(node, node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name)
assert.equal(print(send(answer, 'sendMessageWhenConnected').arguments[3], page), print(send(answerCallback(uat), 'sendMessage').arguments[3], uat), 'UAT answer option object is unchanged')
assert.equal(send(answer, 'sendMessageWhenConnected').arguments.length, 6)
assert.equal(send(answer, 'sendMessageWhenConnected').arguments[4].getText(page), 'undefined')
assert.equal(send(answer, 'sendMessageWhenConnected').arguments[5].getText(page), 'isCurrentSubmission')
assert.equal(find(answer, node => ts.isCallExpression(node) && node.expression.getText(page) === 'setInputMessage'), undefined, 'separate composer is never cleared')
assert.equal(find(answer, node => ts.isCallExpression(node) && node.expression.getText(page) === 'clearAllFiles'), undefined, 'answer submit does not change native file state')
assert.ok(find(declaration(page, 'handleSendMessage'), node => ts.isCallExpression(node) && node.expression.getText(page) === 'preflightDirectorTurn'), 'typed path shares preflight')

let cases = 0
function harness(overrides = {}) {
  const events = []
  const intentMarks = []
  let userIntentSeen = false
  const context = {
    studioShell: true, setStudioComposeMountGeneration: () => {},
    user: { id: 'offline-owner' }, uploadedFiles: [], activeTemplate: null,
    isGeneratingFinal: false, awaitingDirectorReply: false,
    isExecutingSendRef: { current: false }, questionSubmissionPendingRef: { current: false },
    quota: { status: null }, STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: false, researchEnabled: true, webSearchEnabled: false,
    extendedGenerationEnabled: true, showKnowledgeGraphToggle: true, knowledgeGraphEnabled: true,
    sessionStoreName: 'offline-linked-store', deckIdentity: { main_title: 'Supplied identity' },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'offline-owned-session', userId: 'offline-owner', routeSessionId: 'offline-owned-session', freshRouteSourceSessionId: null } },
    wsSessionId: 'offline-owned-session',
    currentSessionId: 'offline-owned-session', inputMessage: 'Keep this separate unsent draft',
    isTemplateGenerationReady: template => template.ready,
    templateGenerationUnavailableReason: () => 'Native unavailable reason',
    setTopUpReason: text => events.push(['topup-reason', text]),
    setTopUpOpen: value => events.push(['topup-open', value]),
    toast: value => events.push(['toast', value]),
    console: { warn: (...args) => events.push(['warning', ...args]) },
    session: { isLoadingSession: false, userMessages: [] },
    persistence: { queueMessage: (...args) => events.push(['persist', ...args]) },
    transport: async () => true,
    setInputMessage: () => assert.fail('answer submit cleared composer'),
    clearAllFiles: () => assert.fail('answer submit cleared attachments'),
    ...overrides,
  }
  context.session.markStudioUserIntent = () => {
    userIntentSeen = true
    intentMarks.push({ eventCount: events.length, sessionId: context.questionSubmissionScopeRef.current.sessionId })
  }
  context.session.hasStudioUserIntent = () => userIntentSeen
  context.session.setUserMessages = update => {
    context.session.userMessages = update(context.session.userMessages)
    events.push(['echo', context.session.userMessages.at(-1)])
  }
  context.sendMessageWhenConnected = async (...args) => {
    events.push(['transport', ...args])
    return context.transport(...args)
  }
  const script = `globalThis.preflightDirectorTurn = ${print(preflight, page)}; globalThis.submitAnswers = ${print(answer, page)};`
  const compiled = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(compiled.outputText, context)
  return { context, events, intentMarks, submit: context.submitAnswers, preflight: context.preflightDirectorTurn }
}
const prose = 'Audience: Leadership\nObjective: Keep all values and punctuation.'
const echo = 'Answers: Leadership · Keep all values and punctuation.'
const traffic = events => events.filter(event => ['transport', 'echo', 'persist'].includes(event[0]))
const blocked = [
  ['unauthenticated', { user: null }],
  ['session loading', { session: { isLoadingSession: true, userMessages: [] } }],
  ['awaiting reply', { awaitingDirectorReply: true }],
  ['typed send pending', { isExecutingSendRef: { current: true } }],
  ['question send pending', { questionSubmissionPendingRef: { current: true } }],
  ['template reuse running', { activeTemplate: { ready: true }, isGeneratingFinal: true }],
  ['raw upload pending', { uploadedFiles: [{ name: 'Pending full filename.txt', status: 'uploading' }] }],
  ['raw upload failed', { uploadedFiles: [{ name: 'Failed full filename.txt', status: 'error' }] }],
  ['template unavailable', { activeTemplate: { ready: false } }],
]
for (const [name, overrides] of blocked) {
  const h = harness(overrides)
  await h.submit(prose, echo)
  assert.equal(traffic(h.events).length, 0, name)
  assert.equal(h.intentMarks.length, 0, `${name} cannot mark a valid user intent`)
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  cases++
}
for (const dailyAt of [true, false]) {
  const h = harness({ quota: { status: { flags: { dailyAt, weeklyAt: !dailyAt }, walletBalanceCents: 0, resetAt: { daily: '2026-10-03T14:00:00Z', weekly: '2026-10-05T14:00:00Z' } } } })
  await h.submit(prose, echo)
  assert.equal(traffic(h.events).length, 0)
  assert.equal(h.intentMarks.length, 0, 'blocked quota cannot mark a valid user intent')
  assert.ok(h.events.some(event => event[0] === 'topup-open' && event[1] === true))
  assert.equal(h.events.find(event => event[0] === 'toast')[1].title, dailyAt ? 'Daily limit reached' : 'Weekly limit reached')
  cases++
}
for (const status of ['stored', 'processing', 'degraded']) {
  const h = harness({ uploadedFiles: [{ name: 'Linked source.txt', status }] })
  await h.submit(prose, echo)
  assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport', 'echo', 'persist'])
  assert.equal(h.intentMarks.length, 1)
  assert.equal(h.intentMarks[0].eventCount, 0, 'valid answer intent is latched before awaited transport')
  assert.equal(h.context.session.hasStudioUserIntent(), true)
  cases++
}
const reserve = harness({ quota: { status: { flags: { dailyAt: true, weeklyAt: true }, walletBalanceCents: 1 } } })
await reserve.submit(prose, echo)
assert.equal(traffic(reserve.events).length, 3)
cases++
const empty = harness()
await empty.submit('  \n ', echo)
assert.equal(traffic(empty.events).length, 0)
assert.equal(empty.intentMarks.length, 0, 'empty answer cannot mark user intent')
cases++

for (const result of [false, 'truthy-but-not-true', new Error('offline refusal')]) {
  const h = harness({ transport: async () => { if (result instanceof Error) throw result; return result } })
  await h.submit(prose, echo)
  assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport'])
  assert.equal(h.intentMarks.length, 1, 'valid attempt latches even if transport refuses')
  assert.equal(h.context.session.hasStudioUserIntent(), true)
  assert.equal(h.context.questionSubmissionPendingRef.current, false)
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  assert.ok(h.events.some(event => event[0] === 'toast' && event[1].description.includes('answers were not sent')))
  h.context.transport = async () => true
  await h.submit(prose, echo)
  assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport', 'transport', 'echo', 'persist'])
  assert.deepEqual(h.events.filter(event => event[0] === 'transport').map(event => JSON.stringify(event.slice(1))), Array(2).fill(JSON.stringify(h.events[0].slice(1))))
  cases++
}
let release
const duplicate = harness({ transport: () => new Promise(resolve => { release = resolve }) })
const pending = duplicate.submit(prose, echo)
assert.equal(duplicate.context.questionSubmissionPendingRef.current, true)
assert.equal(duplicate.preflight(), false, 'typed send is blocked during pending question transport')
await duplicate.submit(prose, echo)
assert.deepEqual(traffic(duplicate.events).map(event => event[0]), ['transport'])
assert.equal(duplicate.intentMarks.length, 1, 'blocked duplicate cannot latch a second submission')
release(true)
await pending
assert.deepEqual(traffic(duplicate.events).map(event => event[0]), ['transport', 'echo', 'persist'])
assert.equal(duplicate.context.questionSubmissionPendingRef.current, false)
cases++

for (const overrides of [{}, { deckIdentity: null, sessionStoreName: null }, { researchEnabled: false, webSearchEnabled: true, extendedGenerationEnabled: false, showKnowledgeGraphToggle: false }]) {
  const h = harness(overrides)
  await h.submit(prose, echo)
  const call = h.events.find(event => event[0] === 'transport')
  assert.equal(call[1], prose)
  assert.equal(call[2], undefined)
  assert.equal(call[3], undefined)
  assert.equal(JSON.stringify(call[4]), JSON.stringify({ displayText: echo, deepResearch: h.context.researchEnabled, webSearch: h.context.webSearchEnabled, extendedGeneration: h.context.extendedGenerationEnabled, useKnowledgeGraph: h.context.showKnowledgeGraphToggle && h.context.knowledgeGraphEnabled, fileUpload: !!h.context.sessionStoreName, storeName: h.context.sessionStoreName, ...(h.context.deckIdentity ? { deckIdentity: h.context.deckIdentity } : {}) }))
  const message = h.context.session.userMessages[0]
  const saved = h.events.find(event => event[0] === 'persist')
  assert.equal(message.text, echo)
  assert.equal(saved[1].message_id, message.id)
  assert.equal(saved[1].session_id, 'offline-owned-session')
  assert.equal(saved[1].type, 'chat_message')
  assert.equal(saved[1].payload.text, echo)
  assert.equal(saved[2], echo)
  cases++
}

// Native question IDs, custom text precedence and partial answers survive both
// failure and retry. Invoke the unchanged actual card's composer function.
const editor = harness({ transport: async () => false })
editor.context.questionSet = { questions: [{ id: 'audience-native', text: 'Audience?', suggestions: [] }, { id: 'goal-native', text: 'Objective???', suggestions: [] }, { id: 'unanswered-native', text: 'Length?', suggestions: [] }] }
editor.context.selected = { 'audience-native': 'Leadership', 'goal-native': 'Suggestion is superseded' }
editor.context.freeText = { 'goal-native': '  Keep all values and punctuation.  ' }
editor.context.onSubmitAnswers = (...args) => { editor.context.lastSubmission = editor.submit(...args) }
const editorBefore = JSON.stringify({ selected: editor.context.selected, freeText: editor.context.freeText })
const compiledCard = ts.transpileModule(`globalThis.cardSubmit = ${print(cardSubmit, card)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
vm.runInNewContext(compiledCard.outputText, editor.context)
editor.context.cardSubmit()
await editor.context.lastSubmission
assert.equal(editor.events.find(event => event[0] === 'transport')[1], prose)
assert.equal(editor.events.find(event => event[0] === 'transport')[4].displayText, echo)
assert.equal(editor.context.session.userMessages.length, 0)
editor.context.transport = async () => true
editor.context.cardSubmit()
await editor.context.lastSubmission
assert.equal(editor.context.session.userMessages.length, 1)
assert.equal(JSON.stringify({ selected: editor.context.selected, freeText: editor.context.freeText }), editorBefore)
cases++
const withoutPersistence = harness({ persistence: null, currentSessionId: null })
await withoutPersistence.submit(prose)
assert.deepEqual(traffic(withoutPersistence.events).map(event => event[0]), ['transport', 'echo'])
assert.equal(withoutPersistence.context.session.userMessages[0].text, prose)
cases++

const hook = parse('websocket.ts', fs.readFileSync(new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url), 'utf8'))
assert.equal(hook.parseDiagnostics.length, 0)
const reconnectingSend = declaration(hook, 'sendMessageWhenConnected').arguments[0]
function renderUpdate(root, refName, names) {
  const update = find(root, node => ts.isIfStatement(node) &&
    node.expression.getText(root).includes(`${refName}.current.sessionId`) &&
    (refName !== 'questionSubmissionScopeRef' || node.expression.getText(root).includes('questionScopeSessionId')))
  assert.ok(update, `native ${refName} render revision`)
  if (refName === 'questionSubmissionScopeRef') {
    const parent = update.parent
    const statements = [...parent.statements]
    const start = statements.findIndex(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(root) === 'questionRouteSessionId'))
    const end = statements.indexOf(update)
    assert.ok(start >= 0 && end > start)
    return statements.slice(start, end + 1).map(node => print(node, root)).join('\n')
  }
  return names.map(name => `const ${name} = ${print(declaration(root, name), root)};`).join('\n') + print(update, root)
}
function layoutLifecycle(root, refName) {
  const effect = find(root, node => ts.isCallExpression(node) && /(?:^|\.)useLayoutEffect$/.test(node.expression.getText(root)) && node.arguments[0]?.getText(root).includes(`${refName}.current.active`))
  assert.ok(effect, `${refName} synchronously invalidates at unmount`)
  return print(effect.arguments[0], root)
}
function evaluate(script, context) {
  vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
}
function transportHarness() {
  let clock = 0
  const timers = [], calls = []
  const c = {
    options: { existingSessionId: 'offline-owned-session' }, user: { id: 'offline-owner' },
    turnSubmissionLifecycleRef: { current: { active: true, generation: 0, sessionId: 'offline-owned-session', userId: 'offline-owner' } },
    sessionIdRef: { current: 'offline-owned-session' }, userIdRef: { current: 'offline-owner' },
    wsRef: { current: null }, socketSessionRef: { current: null },
    WebSocket: { OPEN: 1 }, SEND_RECONNECT_TIMEOUT_MS: 12000,
    Date: { now: () => clock }, setTimeout: (callback, delay) => timers.push({ callback, delay }),
    ensureConnected: () => calls.push(['connect']),
    sendMessage: (...args) => { calls.push(['send', c.wsRef.current, ...args]); return true },
    debugLog: () => {}, console: { error: () => {} },
  }
  evaluate(`globalThis.send = ${print(reconnectingSend, hook)}; globalThis.renderOwnership = () => { ${renderUpdate(hook, 'turnSubmissionLifecycleRef', ['requestedTurnSessionId', 'requestedTurnUserId'])} }; globalThis.setup = ${layoutLifecycle(hook, 'turnSubmissionLifecycleRef')}; globalThis.cleanup = globalThis.setup();`, c)
  function open() { c.wsRef.current = { readyState: 1 }; c.socketSessionRef.current = c.sessionIdRef.current }
  async function tick(expected, mutate = () => {}) {
    const timer = timers.shift()
    assert.equal(timer?.delay, expected)
    clock += expected
    mutate()
    timer.callback()
    await Promise.resolve()
    await Promise.resolve()
  }
  return { c, calls, timers, open, tick }
}
const immediate = transportHarness()
immediate.open()
assert.equal(await immediate.c.send(prose, undefined, undefined, { displayText: echo }), true)
assert.equal(immediate.calls.filter(call => call[0] === 'send').length, 1)
cases++
const reconnect = transportHarness()
const reconnectResult = reconnect.c.send(prose, undefined, undefined, { displayText: echo })
await reconnect.tick(150, reconnect.open)
assert.equal(reconnect.calls.filter(call => call[0] === 'send').length, 0, 'post-open sync wait preserved')
await reconnect.tick(250)
assert.equal(await reconnectResult, true)
assert.equal(reconnect.calls.filter(call => call[0] === 'send').length, 1)
cases++
const changeSession = c => { c.options.existingSessionId = 'other-session'; c.renderOwnership(); c.sessionIdRef.current = 'other-session'; c.wsRef.current = { readyState: 1 }; c.socketSessionRef.current = 'other-session' }
const ownershipChanges = [
  ['session changed', changeSession],
  ['route intent before adoption effect', c => { c.options.existingSessionId = 'other-session'; c.renderOwnership() }],
  ['account changed', c => { c.user = { id: 'other-owner' }; c.renderOwnership() }],
  ['unmounted', c => c.cleanup()],
  ['session away and back', c => { c.options.existingSessionId = 'other-session'; c.renderOwnership(); c.options.existingSessionId = 'offline-owned-session'; c.renderOwnership() }],
]
for (const [name, change] of ownershipChanges) {
  for (const during of ['reconnect', 'post-open']) {
    const t = transportHarness()
    const h = harness({ transport: (...args) => t.c.send(...args) })
    const result = h.submit(prose, echo)
    if (during === 'post-open') await t.tick(150, t.open)
    await t.tick(during === 'reconnect' ? 150 : 250, () => change(t.c))
    await result
    assert.equal(t.calls.filter(call => call[0] === 'send').length, 0, `${name} during ${during}: no wrong-session transport`)
    assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport'], 'no echo/persistence on canceled transport')
    cases++
  }
}
const replaced = transportHarness()
const replacedResult = replaced.c.send(prose)
await replaced.tick(150, replaced.open)
await replaced.tick(250, replaced.open)
assert.equal(await replacedResult, false, 'same-session replacement socket cannot inherit another socket sync wait')
assert.equal(replaced.calls.filter(call => call[0] === 'send').length, 0)
cases++
const wrongSocket = transportHarness()
wrongSocket.open()
wrongSocket.c.socketSessionRef.current = 'other-session'
assert.equal(await wrongSocket.c.send(prose), false)
assert.equal(wrongSocket.calls.filter(call => call[0] === 'send').length, 0)
cases++

const newSessionRetry = transportHarness()
const retiredTurn = newSessionRetry.c.send(prose)
await newSessionRetry.tick(150, () => changeSession(newSessionRetry.c))
assert.equal(await retiredTurn, false)
assert.equal(await newSessionRetry.c.send('New-session explicit answers'), true)
assert.equal(newSessionRetry.calls.filter(call => call[0] === 'send').length, 1)
assert.equal(newSessionRetry.calls.find(call => call[0] === 'send')[2], 'New-session explicit answers')
cases++
const replayedMount = transportHarness()
const beforeCleanup = replayedMount.c.send(prose)
replayedMount.c.cleanup()
replayedMount.c.setup()
await replayedMount.tick(150, replayedMount.open)
assert.equal(await beforeCleanup, false, 'cleanup/setup replay cannot revive the old turn')
assert.equal(await replayedMount.c.send('Fresh mount explicit answers'), true)
cases++

// Initial frontend adoption of the SAME generated session is allowed, not
// confused with switching to another Director session.
const adoption = transportHarness()
adoption.c.options.existingSessionId = undefined
adoption.c.renderOwnership()
const adoptionResult = adoption.c.send(prose)
await adoption.tick(150, () => { adoption.c.options.existingSessionId = 'offline-owned-session'; adoption.c.renderOwnership(); adoption.open() })
await adoption.tick(250)
assert.equal(await adoptionResult, true)
cases++

for (const outcome of [true, false]) {
  for (const change of ['route', 'account', 'unmount', 'away-back']) {
    let resolve
    const h = harness({ transport: () => new Promise(done => { resolve = done }) })
    h.context.searchParams = { get: () => h.context.routeSession ?? 'offline-owned-session' }
    h.context.authScopeUserId = 'offline-owner'
    evaluate(`globalThis.renderScope = () => { ${renderUpdate(page, 'questionSubmissionScopeRef', ['questionRouteSessionId', 'questionScopeSessionId'])} }; globalThis.cleanup = (${layoutLifecycle(page, 'questionSubmissionScopeRef')})();`, h.context)
    const result = h.submit(prose, echo)
    if (change === 'route') { h.context.routeSession = 'other-session'; h.context.renderScope() }
    if (change === 'account') { h.context.authScopeUserId = 'other-owner'; h.context.renderScope() }
    if (change === 'unmount') h.context.cleanup()
    if (change === 'away-back') { h.context.routeSession = 'other-session'; h.context.renderScope(); h.context.routeSession = 'offline-owned-session'; h.context.renderScope() }
    resolve(outcome)
    await result
    assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport'], `${change}: late completion never commits to another chat`)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0, 'late failure does not post notice in another chat')
    assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
    cases++
  }
}
const destinationPending = harness({ questionSubmissionScopeRef: { current: { active: true, generation: 1, sessionId: 'other-session', userId: 'offline-owner' } } })
await destinationPending.submit(prose, echo)
assert.equal(traffic(destinationPending.events).length, 0, 'old visible question cannot start a send while route adoption is pending')
assert.equal(destinationPending.intentMarks.length, 0, 'stale question owner cannot mark user intent')
cases++

// Run the actual typed handler, not only its AST. Local adapters refuse every
// REST request and createSession; no writes/services are contacted or acked.
function pureExports(path) {
  const module = { exports: {} }
  const text = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: name => assert.fail(`unexpected pure dependency ${name}`) })
  return module.exports
}
const manual = pureExports('../lib/manual-deck-workflow.ts')
const attachments = pureExports('../lib/user-message-attachments.ts')
const upload = parse('use-file-upload.ts', fs.readFileSync(new URL('../hooks/use-file-upload.ts', import.meta.url), 'utf8'))
assert.equal(upload.parseDiagnostics.length, 0, 'native upload removal syntax')
function typedHarness(overrides = {}) {
  const h = harness()
  const c = h.context
  Object.assign(c, {
    STUDIO_UPLOAD_OWNERSHIP: true,
    studio: { ownerRef: { current: { fileIds: new Set() } } },
    isReady: true, connecting: false, isUnsavedSession: false,
    createdDirectorSessionRef: { current: null },
    blankPresentationId: null, presentationId: null, effectivePresentationId: null,
    effectivePresentationUrl: null, pendingActionInput: null, templateModeOn: false,
    directorWorkflowState: 'NEW', isBlankPresentation: true, activeVersion: 'blank',
    pendingManualDeckBuild: null, manualDeckInspectionInFlightRef: { current: false },
    LAYOUT_SERVICE_URL: 'https://offline.invalid', canUseKnowledgeGraph: true,
    buildSendOptions: {}, builderCacheOwner: 'offline-owner',
    ...manual, ...attachments,
    crypto: { randomUUID: () => 'offline-message-id' }, setTimeout: () => {},
    console: { ...c.console, log: () => {}, error: () => {} },
    connect: () => h.events.push(['explicit-connect']),
    setInputMessage: value => { c.inputMessage = typeof value === 'function' ? value(c.inputMessage) : value; h.events.push(['draft', c.inputMessage]) },
    setPendingActionInputState: value => { c.pendingActionInput = value; h.events.push(['pending-action', value]) },
    setFiles: update => { c.uploadedFiles = typeof update === 'function' ? update(c.uploadedFiles) : update },
    removeFile: id => { h.events.push(['remove-file', id]); c.nativeRemoveFile(id) },
    setTemplateReuseAwaitingInput: value => h.events.push(['template-wait', value]),
    setIsGeneratingFinal: value => h.events.push(['template-build', value]),
    setManualDeckHandoffError: value => h.events.push(['manual-error', value]),
    setPendingManualDeckBuild: value => { c.pendingManualDeckBuild = value; h.events.push(['manual-choice', value]) },
    createSession: async id => { h.events.push(['create-refused', id]); return null },
    sendMessage: () => assert.fail('typed adapter bypassed reconnecting transport'),
    clearAllFiles: () => h.events.push(['clear-files']), alert: text => h.events.push(['alert', text]),
    fetch: async (url, init) => { h.events.push(['rest-refused', url, init]); return { ok: false, status: 403 } },
    ...overrides,
  })
  Object.assign(c.session, { userMessageIdsRef: { current: new Set() }, hasTitleFromUserMessageRef: { current: true }, hasTitleFromPresentationRef: { current: false }, justCreatedSessionRef: { current: null }, isResumedSession: false })
  c.pendingActionIntentRef = { current: { action: c.pendingActionInput, revision: 0 } }
  evaluate(`globalThis.nativeRemoveFile = ${print(declaration(upload, 'removeFile').arguments[0], upload)}; globalThis.setPendingActionInput = ${print(declaration(page, 'setPendingActionInput').arguments[0], page)}; globalThis.isAttachedUpload = ${print(declaration(page, 'isAttachedUpload'), page)}; globalThis.typedSubmit = ${print(declaration(page, 'handleSendMessage').arguments[0], page)};`, c)
  return h
}
const initial = typedHarness({ isUnsavedSession: true, currentSessionId: null })
await initial.context.typedSubmit()
assert.ok(initial.events.some(event => event[0] === 'create-refused' && event[1] === 'offline-owned-session'))
assert.equal(traffic(initial.events).length, 0)
assert.equal(initial.context.inputMessage, 'Keep this separate unsent draft')
assert.equal(initial.intentMarks.length, 1, 'valid initial typed attempt latches before session creation can await')
cases++
const loadingInitial = typedHarness({ isUnsavedSession: true, session: { isLoadingSession: true, userMessages: [] } })
await loadingInitial.context.typedSubmit()
assert.equal(loadingInitial.events.length, 0, 'loading initial session stops before creation or transport')
cases++
const disconnected = typedHarness({ isReady: false })
await disconnected.context.typedSubmit()
assert.ok(disconnected.events.some(event => event[0] === 'explicit-connect'))
assert.equal(traffic(disconnected.events).length, 0)
assert.equal(disconnected.context.inputMessage, 'Keep this separate unsent draft')
cases++
const pendingAction = { action: { value: 'native-action-id', label: 'Native action', requires_input: true }, messageId: 'native-action-message', timestamp: 1234 }
const pendingTyped = typedHarness({ pendingActionInput: pendingAction })
await pendingTyped.context.typedSubmit()
const direct = pendingTyped.events.find(event => event[0] === 'transport')
assert.equal(direct[4].actionValue, pendingAction.action.value)
assert.equal(direct[4].actionLabel, pendingAction.action.label)
assert.ok(!pendingTyped.events.some(event => event[0] === 'rest-refused'))
assert.equal(pendingTyped.context.pendingActionInput, null)
cases++
const pendingBlocked = typedHarness({ pendingActionInput: pendingAction, uploadedFiles: [{ name: 'pending.txt', status: 'uploading' }] })
await pendingBlocked.context.typedSubmit()
assert.ok(!pendingBlocked.events.some(event => ['native-direct-send', 'echo', 'persist', 'rest-refused'].includes(event[0])))
assert.equal(pendingBlocked.context.pendingActionInput, pendingAction)
cases++
const manualBlocked = typedHarness({ blankPresentationId: 'manual-deck', uploadedFiles: [{ name: 'failed.txt', status: 'error' }] })
await manualBlocked.context.typedSubmit()
assert.ok(!manualBlocked.events.some(event => event[0] === 'rest-refused'))
cases++
const manualChoice = typedHarness({ blankPresentationId: 'manual-deck', fetch: async (url, init) => { manualChoice.events.push(['read-fixture', url, init]); return { ok: true, json: async () => ({ slides: [{ layout: 'C1-text', content: { slide_title: 'Custom retained title' }, text_boxes: [] }] }) } } })
await manualChoice.context.typedSubmit()
assert.equal(manualChoice.events.filter(event => event[0] === 'read-fixture').length, 1)
assert.equal(manualChoice.context.pendingManualDeckBuild.presentationId, 'manual-deck')
assert.equal(manualChoice.context.pendingManualDeckBuild.messageText, 'Keep this separate unsent draft')
assert.equal(traffic(manualChoice.events).length, 0)
assert.equal(manualChoice.context.manualDeckInspectionInFlightRef.current, false)
cases++
const manualContext = { policy: 'prepend_generated', source_presentation_id: 'manual-deck', slide_count: 1, operation_id: 'native-operation', summary: {} }
const continueManual = typedHarness({ blankPresentationId: 'manual-deck' })
await continueManual.context.typedSubmit(undefined, 'Continue native manual deck', { manualDeck: manualContext })
assert.ok(!continueManual.events.some(event => event[0] === 'rest-refused'))
assert.equal(continueManual.events.find(event => event[0] === 'transport')[4].manualDeck, manualContext)
cases++
const template = typedHarness({ activeTemplate: { id: 'native-template', ready: true }, templateModeOn: true, buildSendOptions: { templateMode: true, templateId: 'native-template' } })
await template.context.typedSubmit()
assert.ok(template.events.some(event => event[0] === 'template-build' && event[1] === true))
assert.equal(template.events.find(event => event[0] === 'transport')[4].templateId, 'native-template')
cases++
// Crucial loader gap: only the PAGE route changes. Hook options, adopted
// session refs and the opened socket all remain on A throughout these cases.
function pageOwnership(h, initialRoute = 'offline-owned-session') {
  h.context.routeSession = initialRoute
  h.context.searchParams = { get: () => h.context.routeSession }
  h.context.authScopeUserId = 'offline-owner'
  h.context.questionSubmissionScopeRef.current.routeSessionId = initialRoute
  evaluate(`globalThis.renderScope = () => { ${renderUpdate(page, 'questionSubmissionScopeRef', ['questionRouteSessionId', 'questionScopeSessionId'])} };`, h.context)
}
for (const destination of ['other-session', 'new', null]) {
  for (const during of ['reconnect', 'post-open']) {
    const t = transportHarness()
    const h = harness({ transport: (...args) => t.c.send(...args) })
    pageOwnership(h)
    const pending = h.submit(prose, echo)
    if (during === 'post-open') await t.tick(150, t.open)
    await t.tick(during === 'reconnect' ? 150 : 250, () => {
      h.context.routeSession = destination
      h.context.renderScope()
      t.open() // Still the OLD native socket/session A, not destination B.
    })
    await pending
    assert.equal(t.c.options.existingSessionId, 'offline-owned-session')
    assert.equal(t.c.sessionIdRef.current, 'offline-owned-session')
    assert.equal(t.calls.filter(call => call[0] === 'send').length, 0, 'page route intent cancels bytes before hook adoption')
    assert.deepEqual(traffic(h.events).map(event => event[0]), ['transport'])
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
    await h.submit(prose, echo)
    assert.equal(h.events.filter(event => event[0] === 'transport').length, 1, 'old visible card cannot restart in the loader gap')
    cases++
  }
}
const canceledOpen = transportHarness()
canceledOpen.open()
assert.equal(await canceledOpen.c.send(prose, undefined, undefined, {}, undefined, () => false), false)
assert.equal(canceledOpen.calls.filter(call => call[0] === 'send').length, 0, 'local cancellation checked even for already open socket')
cases++
for (const initialRoute of [null, 'new']) {
  const t = transportHarness()
  t.c.options.existingSessionId = undefined
  t.c.renderOwnership()
  const h = harness({ currentSessionId: null, transport: (...args) => t.c.send(...args) })
  pageOwnership(h, initialRoute)
  h.context.renderScope()
  const pending = h.submit(prose, echo)
  await t.tick(150, () => {
    h.context.currentSessionId = 'offline-owned-session'
    h.context.routeSession = 'offline-owned-session'
    h.context.renderScope()
    t.c.options.existingSessionId = 'offline-owned-session'
    t.c.renderOwnership()
    t.open()
  })
  await t.tick(250)
  await pending
  assert.equal(t.calls.filter(call => call[0] === 'send').length, 1, 'same generated-session URL adoption remains valid')
  assert.equal(h.context.session.userMessages.length, 1)
  cases++
}
console.log(`Director submission: ${cases} offline cases passed; exact UAT answer options/composition, lifecycle-fenced reconnect and post-open waits, late completion suppression, retained retry/editors, and actual initial/manual/pending-action/template typed branches. Mutation/session-creation adapters refused; native read-only inspection fixture supplied; no connected acknowledgement claimed.`)

// Shared offline adapters execute the current native handlers in the C4 suite.
export { typedHarness, pageOwnership, transportHarness, evaluate, renderUpdate, layoutLifecycle, page, traffic }
