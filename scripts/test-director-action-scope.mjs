import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { typedHarness, pageOwnership, transportHarness, evaluate, layoutLifecycle, page } from './test-director-question-submit.mjs'

// Actual page action callback and actual hook transport, with explicit local
// state/counters only. A true supplied queue return is not a service ack.
function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
const declaration = (root, name) => {
  const node = find(root, node => ts.isVariableDeclaration(node) && node.name.getText(root) === name)
  assert.ok(node, `native ${name}`)
  return node.initializer
}
const printer = ts.createPrinter({ removeComments: true })
const print = (node, root) => printer.printNode(ts.EmitHint.Unspecified, node, root)
const callback = declaration(page, 'handleActionClick').arguments[0]
const before = ts.createSourceFile('before.tsx', execFileSync('git', ['show', '9189221:app/builder/page.tsx'], { encoding: 'utf8' }), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const oldCallback = declaration(before, 'handleActionClick').arguments[0]
const send = (node, root) => find(node, n => ts.isCallExpression(n) && n.expression.getText(root) === 'sendMessageWhenConnected')
assert.equal(send(callback, page).arguments.length, 6, 'local predicate is an additive sixth argument')
assert.equal(send(callback, page).arguments[4].getText(page), 'undefined', 'native reconnect timeout stays default')
assert.equal(print(send(callback, page).arguments[3], page), print(send(oldCallback, before).arguments[3], before), 'exact native action options remain unchanged')
// The input-required selection is intentionally separate from actual sending.
const requiresInput = (node, root) => find(node, n => ts.isIfStatement(n) && n.expression.getText(root) === 'action.requires_input').thenStatement
assert.equal(print(requiresInput(callback, page), page), print(requiresInput(oldCallback, before), before), 'requires_input branch remains exact native source')

const action = { value: 'accept_strawman', label: 'Accept native outline', primary: true, requires_input: false }
let cases = 0
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function harness(overrides = {}, sourceCallback = callback) {
  const h = typedHarness({
    actionSubmissionPendingRef: { current: new Set() },
    textareaRef: { current: { focus: () => h.events.push(['composer-focus']) } },
    setTimeout: (fn, delay) => { assert.equal(delay, 100); fn() },
    ...overrides,
  })
  pageOwnership(h)
  h.context.session.answeredActionsRef = { current: new Set() }
  evaluate(`globalThis.cleanup = (${layoutLifecycle(page, 'questionSubmissionScopeRef')})();
    globalThis.clickAction = (() => { const currentSessionId = 'offline-owned-session'; return ${print(sourceCallback, sourceCallback === callback ? page : before)} })();`, h.context)
  return h
}
function assertUncommitted(h) {
  assert.equal(h.context.session.userMessages.length, 0)
  assert.equal(h.context.session.userMessageIdsRef.current.size, 0)
  assert.equal(h.context.session.answeredActionsRef.current.size, 0)
  assert.equal(h.events.filter(event => ['persist', 'template-build', 'template-wait'].includes(event[0])).length, 0)
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0, 'completed/failed/retired submission releases its exact pending key')
}
const changes = [
  ['route B before loader adoption', c => { c.routeSession = 'other-session'; c.renderScope() }],
  ['new route', c => { c.routeSession = 'new'; c.renderScope() }],
  ['bare route', c => { c.routeSession = null; c.renderScope() }],
  ['account change', c => { c.authScopeUserId = 'other-owner'; c.renderScope() }],
  ['unmount', c => c.cleanup()],
  ['away and back', c => { c.routeSession = 'other-session'; c.renderScope(); c.routeSession = 'offline-owned-session'; c.renderScope() }],
]
// Hook socket/currentSessionId stay on A through URL intent changes. Only the
// actual callback's local predicate can reject dispatch in this loader gap.
// The unchanged pre-C5 source reproduces the original failing requirement,
// independently of the corrected callback now present in the working tree.
{
  const t = transportHarness()
  const h = harness({ transport: (...args) => t.c.send(...args) }, oldCallback)
  const result = h.context.clickAction(action, 'native-outline-request')
  await flush(); await t.tick(150, t.open)
  await t.tick(250, () => { h.context.routeSession = 'other-session'; h.context.renderScope() })
  await result
  assert.throws(() => assert.equal(t.calls.filter(event => event[0] === 'send').length, 0), assert.AssertionError, 'pre-C5 callback fails retired-route dispatch requirement')
  assert.equal(h.context.session.userMessages.length, 1, 'baseline also commits the retired action')
  console.log('Pre-C5 native callback reproduces retired-route failure: actual local socket queue=1, echo=1. Corrected cases require both zero.')
  cases++
}
for (const change of [
  c => { c.routeSession = 'other-session'; c.renderScope() },
  c => { c.routeSession = 'new'; c.renderScope() },
  c => { c.routeSession = null; c.renderScope() },
  c => c.cleanup(),
]) {
  const h = harness()
  change(h.context)
  await h.context.clickAction(action, 'native-outline-request')
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 0, 'stale visible action cannot begin a transport after route intent/disposal')
  assertUncommitted(h)
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
  cases++
}
for (const during of ['reconnect', 'post-open']) {
  for (const [name, change] of changes) {
    const t = transportHarness()
    const h = harness({ transport: (...args) => t.c.send(...args) })
    const result = h.context.clickAction(action, 'native-outline-request')
    await flush()
    if (during === 'post-open') await t.tick(150, t.open)
    await t.tick(during === 'reconnect' ? 150 : 250, () => { change(h.context); t.open() })
    await result
    assert.equal(t.calls.filter(event => event[0] === 'send').length, 0, `${during}/${name}: retired immediate action must not reach old socket`)
    assertUncommitted(h)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0, 'ownership retirement produces no stale failure notice')
    cases++
  }
}
// True/false/rejected completion belongs to its originating page scope. Keep
// a captured React currentSessionId=A but adopt B through shared setters.
for (const [name, change] of changes) {
  for (const outcome of [true, false, new Error('offline late failure')]) {
    let finish, reject
    const h = harness({ transport: () => new Promise((resolve, fail) => { finish = resolve; reject = fail }) })
    const result = h.context.clickAction(action, 'native-outline-request')
    await flush()
    change(h.context)
    if (outcome instanceof Error) reject(outcome); else finish(outcome)
    await result
    assertUncommitted(h)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0, `${name}: no notice into another owner after await`)
    cases++
  }
}
// Actual hook queues bytes for A, then route B adopts before outer await. The
// correctly sent A turn may not echo into B or start B's generation loader.
{
  const t = transportHarness()
  const h = harness({ transport: (...args) => t.c.send(...args) })
  const dispatch = t.c.sendMessage
  t.c.sendMessage = (...args) => {
    const sent = dispatch(...args)
    h.context.routeSession = 'other-session'
    h.context.currentSessionId = 'other-session'
    h.context.renderScope()
    h.context.session.userMessages = []
    return sent
  }
  const result = h.context.clickAction(action, 'native-outline-request')
  await flush(); await t.tick(150, t.open); await t.tick(250); await result
  assert.equal(t.calls.filter(event => event[0] === 'send').length, 1, 'original local queue was actually accepted')
  assertUncommitted(h)
  cases++
}
for (const outcome of [false, 'truthy-but-not-true', new Error('offline refusal')]) {
  const retainedFiles = [{ id: 'native-attached-file', name: 'Retained source.txt', size: 12, type: 'text/plain', status: 'stored' }]
  const h = harness({ uploadedFiles: retainedFiles, transport: async () => { if (outcome instanceof Error) throw outcome; return outcome } })
  await h.context.clickAction(action, 'native-outline-request')
  assertUncommitted(h)
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0, 'false/throw/nontrue releases pending key for explicit retry')
  assert.deepEqual(h.context.uploadedFiles, retainedFiles, 'failed action does not consume unrelated files')
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 1, 'failed current action has honest retry notice')
  h.context.transport = async () => true
  await h.context.clickAction(action, 'native-outline-request')
  assert.equal(h.context.session.userMessages.length, 1)
  assert.equal(h.context.session.answeredActionsRef.current.has('native-outline-request'), true)
  assert.equal(h.events.filter(event => event[0] === 'persist').length, 1)
  const calls = h.events.filter(event => event[0] === 'transport')
  assert.equal(calls.length, 2)
  assert.equal(JSON.stringify(calls[0][4]), JSON.stringify(calls[1][4]), 'retry preserves native action options')
  assert.deepEqual(h.context.uploadedFiles, retainedFiles, 'successful immediate action retains composer files')
  assert.equal(calls[1][5], undefined)
  assert.equal(typeof calls[1][6], 'function', 'sixth argument is a local predicate, never wire options')
  cases++
}
for (const selected of [action, { ...action, value: 'template_native_action' }]) {
  const h = harness({ activeTemplate: { id: 'native-template', ready: true } })
  await h.context.clickAction(selected, 'native-outline-request')
  assert.equal(h.context.session.userMessages[0].text, selected.label)
  const saved = h.events.find(event => event[0] === 'persist')[1]
  assert.equal(saved.session_id, 'offline-owned-session')
  assert.equal(saved.payload.action_value, selected.value)
  assert.equal(saved.payload.action_label, selected.label)
  assert.equal(h.events.filter(event => event[0] === 'template-build' && event[1] === true).length, 1)
  assert.ok(h.events.findIndex(event => event[0] === 'echo') > h.events.findIndex(event => event[0] === 'transport'))
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  cases++
}
{
  const h = harness()
  const inputAction = { ...action, value: 'native-edit', requires_input: true }
  await h.context.clickAction(inputAction, 'native-input-request')
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 0)
  assert.equal(h.context.pendingActionInput.action, inputAction)
  assert.equal(h.context.session.answeredActionsRef.current.has('native-input-request'), true)
  assert.equal(h.context.pendingActionIntentRef.current.action.action, inputAction)
  assert.equal(h.events.filter(event => event[0] === 'composer-focus').length, 1)
  cases++
}
// The baseline duplicate is inherited, but the corrected same-request guard
// suppresses repeated and competing choices during the actual reconnect wait.
for (const selected of [action, { ...action, value: 'alternative-native', label: 'Alternate native choice' }]) {
  const t = transportHarness()
  const h = harness({ transport: (...args) => t.c.send(...args) })
  const first = h.context.clickAction(action, 'native-outline-request')
  const second = h.context.clickAction(selected, 'native-outline-request')
  await flush()
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 1)
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 1, 'same question cannot dispatch concurrent choices')
  assert.equal(h.events.filter(event => event[0] === 'template-build').length, 0, 'no optimistic progress while pending')
  await t.tick(150, t.open); await t.tick(250)
  await Promise.all([first, second])
  assert.equal(t.calls.filter(event => event[0] === 'send').length, 1)
  assert.equal(h.context.session.userMessages.length, 1)
  assert.equal(h.events.filter(event => event[0] === 'persist').length, 1)
  assert.equal(h.events.filter(event => event[0] === 'template-build' && event[1] === true).length, 1)
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  cases++
}
// Distinct native question IDs are distinct submissions, not a global mutex.
{
  const t = transportHarness()
  const h = harness({ transport: (...args) => t.c.send(...args) })
  const first = h.context.clickAction(action, 'native-question-one')
  const second = h.context.clickAction(action, 'native-question-two')
  await flush()
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 2)
  await t.tick(150, t.open); await t.tick(150)
  await t.tick(250); await t.tick(250)
  await Promise.all([first, second])
  assert.equal(t.calls.filter(event => event[0] === 'send').length, 2)
  assert.equal(h.context.session.userMessages.length, 2)
  assert.equal(h.context.session.answeredActionsRef.current.size, 2)
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  cases++
}
// A later generation can legitimately reuse the same native request ID while
// an old transport remains pending. Its late cleanup cannot delete the new key.
for (const oldOutcome of [true, false, new Error('old generation rejection')]) {
  const resolutions = []
  const h = harness({ transport: () => new Promise((resolve, reject) => resolutions.push({ resolve, reject })) })
  const first = h.context.clickAction(action, 'reused-native-question')
  await flush()
  h.context.routeSession = 'other-session'; h.context.renderScope()
  h.context.routeSession = 'offline-owned-session'; h.context.renderScope()
  const second = h.context.clickAction(action, 'reused-native-question')
  await flush()
  assert.equal(resolutions.length, 2, 'new generation is not blocked by original question key')
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 2)
  if (oldOutcome instanceof Error) resolutions[0].reject(oldOutcome); else resolutions[0].resolve(oldOutcome)
  await first
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 1, 'late old finally clears only its own originating key')
  assert.equal(h.context.session.userMessages.length, 0)
  assert.equal(h.events.filter(event => ['persist', 'toast', 'template-build'].includes(event[0])).length, 0)
  resolutions[1].resolve(true)
  await second
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  assert.equal(h.context.session.userMessages.length, 1)
  assert.equal(h.events.filter(event => event[0] === 'persist').length, 1)
  assert.equal(h.events.filter(event => event[0] === 'template-build' && event[1] === true).length, 1)
  cases++
}
for (const nextOwner of ['session', 'account']) {
  const resolutions = []
  const h = harness({ transport: () => new Promise(resolve => resolutions.push(resolve)) })
  const first = h.context.clickAction(action, 'same-native-request-id')
  await flush()
  if (nextOwner === 'session') {
    h.context.currentSessionId = 'other-session'
    h.context.wsSessionId = 'other-session'
    h.context.routeSession = 'other-session'
  } else {
    h.context.authScopeUserId = 'other-owner'
    h.context.user = { id: 'other-owner' }
  }
  h.context.renderScope()
  // A new React render captures the new native currentSessionId, while the
  // earlier closure retains A. Shared refs/setters remain the same instances.
  h.context.actionRenderSessionId = h.context.currentSessionId
  evaluate(`globalThis.clickAction = (() => { const currentSessionId = globalThis.actionRenderSessionId; return ${print(callback, page)} })();`, h.context)
  const second = h.context.clickAction(action, 'same-native-request-id')
  await flush()
  assert.equal(resolutions.length, 2, 'new session/account scope is not blocked by old request ID')
  resolutions[0](true); await first
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 1)
  assert.equal(h.context.session.userMessages.length, 0)
  resolutions[1](true); await second
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  assert.equal(h.context.session.userMessages.length, 1)
  assert.equal(h.events.find(event => event[0] === 'persist')[1].session_id, h.context.currentSessionId)
  cases++
}
// Native admission belongs to the question, across both choice kinds. The
// first immediate choice owns it during waits; no competing input intent is
// installed before the original result, and a failed choice remains retryable.
const inputAction = { ...action, value: 'template_native_refine', label: 'Refine native template', requires_input: true }
const templateAction = { ...action, value: 'template_native_generate', label: 'Generate native template' }
for (const during of ['reconnect', 'post-open']) {
  const t = transportHarness()
  const h = harness({ activeTemplate: { id: 'native-template', ready: true }, transport: (...args) => t.c.send(...args) })
  const first = h.context.clickAction(templateAction, 'mixed-native-question')
  await flush()
  if (during === 'post-open') await t.tick(150, t.open)
  await h.context.clickAction(inputAction, 'mixed-native-question')
  assert.equal(h.context.pendingActionInput, null, 'pending immediate choice suppresses same-question input intent')
  assert.equal(h.context.session.answeredActionsRef.current.size, 0)
  assert.equal(h.events.filter(event => event[0] === 'composer-focus').length, 0)
  if (during === 'reconnect') await t.tick(150, t.open)
  await t.tick(250); await first
  assert.equal(t.calls.filter(event => event[0] === 'send').length, 1)
  assert.equal(h.context.session.userMessages[0].text, templateAction.label)
  assert.equal(h.context.pendingActionInput, null)
  assert.equal(h.events.filter(event => event[0] === 'template-build' && event[1] === true).length, 1)
  cases++
}
for (const competing of [templateAction, inputAction, { ...inputAction, value: 'native-other-input' }]) {
  const h = harness()
  await h.context.clickAction(inputAction, 'mixed-native-question')
  const selected = h.context.pendingActionInput
  await h.context.clickAction(competing, 'mixed-native-question')
  assert.equal(h.context.pendingActionInput, selected, 'input-first native answered admission rejects stale later choice')
  assert.equal(h.context.pendingActionIntentRef.current.revision, 1)
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 0)
  assert.equal(h.events.filter(event => event[0] === 'composer-focus').length, 1)
  assert.equal(h.context.session.answeredActionsRef.current.size, 1)
  cases++
}
for (const competing of [templateAction, inputAction]) {
  const h = harness()
  await h.context.clickAction(templateAction, 'completed-native-question')
  await h.context.clickAction(competing, 'completed-native-question')
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 1, 'answered request rejects late callbacks after pending-key cleanup')
  assert.equal(h.context.session.userMessages.length, 1)
  assert.equal(h.events.filter(event => event[0] === 'persist').length, 1)
  assert.equal(h.context.pendingActionInput, null)
  cases++
}
for (const outcome of [false, new Error('mixed choice refusal')]) {
  let finish, reject
  const h = harness({ transport: () => new Promise((resolve, fail) => { finish = resolve; reject = fail }) })
  const first = h.context.clickAction(templateAction, 'mixed-retry-question')
  await flush()
  await h.context.clickAction(inputAction, 'mixed-retry-question')
  assert.equal(h.context.pendingActionInput, null)
  if (outcome instanceof Error) reject(outcome); else finish(outcome)
  await first
  assertUncommitted(h)
  await h.context.clickAction(inputAction, 'mixed-retry-question')
  assert.equal(h.context.pendingActionInput.action, inputAction, 'failed immediate choice releases admission for actual input alternative')
  assert.equal(h.context.session.answeredActionsRef.current.has('mixed-retry-question'), true)
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 1)
  cases++
}
{
  let finish
  const h = harness({ transport: () => new Promise(resolve => { finish = resolve }) })
  const first = h.context.clickAction(templateAction, 'native-question-one')
  await flush()
  await h.context.clickAction(inputAction, 'native-question-two')
  assert.equal(h.context.pendingActionInput.action, inputAction, 'other native question is not blocked by unrelated pending request')
  finish(true); await first
  assert.equal(h.context.pendingActionInput.action, inputAction, 'immediate success does not clear unrelated input choice')
  assert.equal(h.context.session.answeredActionsRef.current.size, 2)
  cases++
}
// Native useBuilderSession clears answeredActionsRef on session init/select.
// Explicit supplied reset models that existing boundary, never persistence.
for (const firstChoice of [templateAction, inputAction]) {
  const h = harness()
  await h.context.clickAction(firstChoice, 'reused-after-native-reset')
  h.context.routeSession = 'other-session'; h.context.renderScope()
  h.context.routeSession = 'offline-owned-session'; h.context.renderScope()
  h.context.session.answeredActionsRef.current.clear()
  h.context.session.userMessages = []
  h.context.session.userMessageIdsRef.current.clear()
  await h.context.clickAction(templateAction, 'reused-after-native-reset')
  assert.equal(h.context.session.userMessages.length, 1, 'new native generation/reset permits same request ID')
  assert.equal(h.context.session.answeredActionsRef.current.size, 1)
  assert.equal(h.context.actionSubmissionPendingRef.current.size, 0)
  cases++
}
console.log(`Director immediate action scope: ${cases} offline C5 cases passed; exact native options/requires_input branch, real reconnect/post-open route ownership, late true/false/throw, account/unmount, retained retry, same-question pending suppression/exact cleanup, generation reuse, mixed-choice/answered admission and loader ordering. No service write or acknowledgement performed.`)
