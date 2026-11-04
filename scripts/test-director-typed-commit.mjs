import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { typedHarness, pageOwnership, transportHarness, evaluate, renderUpdate, layoutLifecycle, page } from './test-director-question-submit.mjs'

// Supplied returns exercise real source branches only. No browser/socket/REST
// service is contacted, and a true stub is not a server acknowledgement.
const parse = text => ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function findAll(root, predicate, out = []) { if (predicate(root)) out.push(root); ts.forEachChild(root, child => { findAll(child, predicate, out) }); return out }
const printer = ts.createPrinter({ removeComments: true })
const print = (node, root) => printer.printNode(ts.EmitHint.Unspecified, node, root)
const typed = root => findAll(root, n => ts.isVariableDeclaration(n) && n.name.getText(root) === 'handleSendMessage')[0].initializer.arguments[0]
const before = parse(execFileSync('git', ['show', '4f4a966:app/builder/page.tsx'], { encoding: 'utf8' }))
const oldOptions = findAll(typed(before), n => ts.isCallExpression(n) && ['sendMessage', 'sendMessageWhenConnected'].includes(n.expression.getText(before))).map(n => print(n.arguments[3], before))
const newOptions = findAll(typed(page), n => ts.isCallExpression(n) && n.expression.getText(page) === 'sendTypedTurn').map(n => print(n.arguments[0], page))
assert.deepEqual(newOptions, oldOptions, 'pending, first-session and normal typed option objects are exactly pre-C4 native source')
const cacheModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/last-builder-session.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: cacheModule, exports: cacheModule.exports })
const pendingAction = { action: { value: 'native-action-id', label: 'Keep the native action label', requires_input: true }, messageId: 'native-action-message', timestamp: 1234 }
const files = [
  { id: 'processing-source', name: 'Original source.docx', size: 123, type: 'application/docx', status: 'processing' },
  { id: 'degraded-source', name: 'Degraded original.txt', size: 25, type: 'text/plain', status: 'degraded' },
]
const buildOptions = {
  displayText: 'Supplied compact value', theme: { mode: 'preset', preset_id: 'native-preset' },
  templateMode: true, templateId: 'native-template', elementOverrides: { native_slot: { prompt: 'Retained override' } },
  templateIngest: true, ingestUploadRef: { storage_path: 'offline/supplied-original' },
  deckIdentity: { main_title: 'Supplied native identity' }, handoffIdempotencyKey: 'native-handoff-key',
}
let cases = 0
async function settleMicrotasks() { for (let i = 0; i < 12; i++) await Promise.resolve() }
function scenario(kind, overrides = {}) {
  const h = typedHarness()
  const c = h.context
  const releaseTimers = []
  Object.assign(c, {
    uploadedFiles: structuredClone(files), pendingActionInput: kind === 'pending' ? pendingAction : null,
    isUnsavedSession: kind === 'initial', currentSessionId: kind === 'initial' ? null : 'offline-owned-session',
    buildSendOptions: structuredClone(buildOptions),
    ...cacheModule.exports,
    sessionStorage: { removeItem: key => h.events.push(['unsaved-cache-remove', key]) },
    createSession: async id => { h.events.push(['create-return', id]); return { id } },
    setIsUnsavedSession: value => { c.isUnsavedSession = value; h.events.push(['unsaved', value]) },
    setCurrentSessionId: value => { c.currentSessionId = value; h.events.push(['current-session', value]) },
    router: { push: url => { h.events.push(['navigation', url]); c.routeSession = 'offline-owned-session'; c.renderScope() } },
    setIsGeneratingFinal: value => { c.isGeneratingFinal = value; h.events.push(['template-build', value]) },
    setTimeout: (callback, delay) => { assert.equal(delay, 500); releaseTimers.push(callback) },
    ...overrides,
  })
  c.studio.ownerRef.current.fileIds = new Set(c.uploadedFiles.map(file => file.id))
  c.pendingActionIntentRef.current = { action: c.pendingActionInput, revision: 0 }
  c.persistence.generateTitle = text => text.length > 50 ? text.substring(0, 50) + '...' : text
  c.persistence.updateMetadata = data => h.events.push(['metadata-refused', data])
  pageOwnership(h, kind === 'initial' ? null : 'offline-owned-session')
  evaluate(`globalThis.cleanup = (${layoutLifecycle(page, 'questionSubmissionScopeRef')})();`, c)
  h.flush = () => { while (releaseTimers.length) releaseTimers.shift()() }
  return h
}
function assertUnsent(h, kind) {
  assert.equal(h.context.session.userMessages.length, 0)
  assert.equal(h.context.session.userMessageIdsRef.current.size, 0)
  assert.equal(h.events.filter(event => event[0] === 'persist').length, 0)
  assert.equal(h.events.filter(event => event[0] === 'rest-refused').length, 0)
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  assert.deepEqual([...h.context.studio.ownerRef.current.fileIds], files.map(file => file.id), 'refused sends retain upload ownership')
  assert.deepEqual(h.context.uploadedFiles, files)
  if (kind === 'pending') assert.equal(h.context.pendingActionInput, pendingAction)
}
for (const kind of ['pending', 'initial', 'normal']) {
  for (const result of [false, new Error('offline transport refusal')]) {
    const h = scenario(kind, { transport: async () => { if (result instanceof Error) throw result; return result } })
    await h.context.typedSubmit()
    assertUnsent(h, kind)
    assert.ok(h.events.some(event => event[0] === 'toast' && event[1].description.includes('message was not sent')))
    if (kind === 'initial') {
      assert.equal(h.context.isUnsavedSession, false, 'created row is real local return, not rolled back because transport failed')
      assert.equal(h.context.createdDirectorSessionRef.current.id, 'offline-owned-session')
    }
    h.flush()
    h.context.transport = async () => true
    await h.context.typedSubmit()
    assert.equal(h.context.session.userMessages.length, 1)
    assert.equal(h.context.inputMessage, '')
    assert.equal(h.context.uploadedFiles.length, 0)
    assert.equal(h.context.studio.ownerRef.current.fileIds.size, 0, 'successful sends release submitted upload ownership')
    if (kind === 'pending') assert.equal(h.context.pendingActionInput, null)
    if (kind === 'initial') assert.equal(h.events.filter(event => event[0] === 'create-return').length, 1, 'normal rerender retry reuses created session')
    const calls = h.events.filter(event => event[0] === 'transport')
    assert.equal(calls.length, 2)
    assert.equal(calls[0][1], calls[1][1])
    assert.equal(JSON.stringify(calls[0][4]), JSON.stringify(calls[1][4]), 'retry keeps exact options/action/context')
    assert.equal(calls[1][3], 2, 'all attached native uploads preserved')
    assert.equal(calls[1][5], undefined, 'native reconnect timeout unchanged')
    assert.equal(typeof calls[1][6], 'function', 'local scope predicate is not part of wire options')
    cases++
  }
}
for (const kind of ['pending', 'initial', 'normal']) {
  const h = scenario(kind)
  await h.context.typedSubmit()
  const transportIndex = h.events.findIndex(event => event[0] === 'transport')
  const echoIndex = h.events.findIndex(event => event[0] === 'echo')
  assert.ok(transportIndex >= 0 && echoIndex > transportIndex)
  const message = h.context.session.userMessages[0]
  assert.equal(message.text, 'Keep this separate unsent draft')
  assert.deepEqual(JSON.parse(JSON.stringify(message.attachments)), files.map(({ id, name, size, type }) => ({ id, name, size, type })))
  if (kind === 'pending') {
    assert.equal(message.id, pendingAction.messageId)
    assert.equal(message.timestamp, pendingAction.timestamp)
    const queued = h.events.find(event => event[0] === 'persist')[1]
    assert.equal(queued.payload.action_value, pendingAction.action.value)
    assert.equal(queued.payload.action_label, pendingAction.action.label)
  }
  if (kind === 'initial') {
    const request = h.events.find(event => event[0] === 'rest-refused')
    assert.ok(h.events.indexOf(request) > transportIndex)
    assert.equal(request[1], '/api/sessions/offline-owned-session/messages')
    assert.equal(request[2].method, 'POST')
    const payload = JSON.parse(request[2].body).messages[0]
    assert.equal(payload.id, message.id)
    assert.equal(payload.userText, message.text)
    assert.deepEqual(payload.payload.attachments, JSON.parse(JSON.stringify(message.attachments)))
    assert.equal(h.events.filter(event => event[0] === 'create-return').length, 1)
  }
  cases++
}
// A stale callback can still capture isUnsavedSession=true before a rerender;
// the confirmed-row ref protects it as well as the normal state transition.
const staleRetry = scenario('initial', { transport: async () => false })
await staleRetry.context.typedSubmit()
staleRetry.flush()
staleRetry.context.isUnsavedSession = true
staleRetry.context.transport = async () => true
await staleRetry.context.typedSubmit()
assert.equal(staleRetry.events.filter(event => event[0] === 'create-return').length, 1)
assert.equal(staleRetry.context.session.userMessages.length, 1)
cases++

for (const kind of ['pending', 'initial', 'normal']) {
  let resolve
  const h = scenario(kind, { transport: () => new Promise(done => { resolve = done }) })
  const first = h.context.typedSubmit()
  await Promise.resolve()
  await h.context.typedSubmit()
  assert.equal(h.events.filter(event => event[0] === 'transport').length, 1, 'pending duplicate rejected')
  if (kind === 'initial') assert.equal(h.events.filter(event => event[0] === 'create-return').length, 1)
  resolve(false)
  await first
  assertUnsent(h, kind)
  h.flush()
  cases++
}
let finishCreate
const createDuplicate = scenario('initial', { createSession: id => { createDuplicate.events.push(['create-wait', id]); return new Promise(resolve => { finishCreate = resolve }) } })
const firstCreate = createDuplicate.context.typedSubmit()
await createDuplicate.context.typedSubmit()
assert.equal(createDuplicate.events.filter(event => event[0] === 'create-wait').length, 1)
finishCreate(null)
await firstCreate
assertUnsent(createDuplicate, 'initial')
cases++

const mutations = [
  ['route B before loader adoption', c => { c.routeSession = 'other-session'; c.renderScope() }],
  ['new route', c => { c.routeSession = 'new'; c.renderScope() }],
  ['bare route', c => { c.routeSession = null; c.renderScope() }],
  ['native session changed', c => { c.currentSessionId = 'other-session'; c.routeSession = 'other-session'; c.renderScope() }],
  ['account changed', c => { c.authScopeUserId = 'other-owner'; c.renderScope() }],
  ['unmounted', c => c.cleanup()],
]
for (const [name, change] of mutations) {
  let resolve
  const h = scenario('initial', { createSession: id => { h.events.push(['create-wait', id]); return new Promise(done => { resolve = done }) } })
  // Set the initial route to a specific owned-unsaved session so new/bare
  // transitions are actual navigation, not a no-op initial null URL.
  h.context.currentSessionId = 'offline-owned-session'
  h.context.routeSession = 'offline-owned-session'
  h.context.renderScope()
  const result = h.context.typedSubmit()
  change(h.context)
  resolve({ id: 'offline-owned-session' })
  await result
  assertUnsent(h, 'initial')
  assert.equal(h.context.createdDirectorSessionRef.current, null, `${name}: late created row does not adopt into another chat`)
  assert.ok(!h.events.some(event => ['navigation', 'unsaved', 'current-session', 'transport'].includes(event[0])))
  cases++
}
for (const kind of ['pending', 'initial', 'normal']) {
  for (const outcome of [true, false]) {
    for (const [name, change] of mutations) {
      let resolve
      const h = scenario(kind, { transport: () => new Promise(done => { resolve = done }) })
      if (kind === 'initial') { h.context.currentSessionId = 'offline-owned-session'; h.context.routeSession = 'offline-owned-session'; h.context.renderScope() }
      const result = h.context.typedSubmit()
      await settleMicrotasks()
      assert.equal(typeof resolve, 'function', `${kind}/${name}/${outcome}: ${JSON.stringify(h.events)}`)
      change(h.context)
      resolve(outcome)
      await result
      assertUnsent(h, kind)
      assert.equal(h.events.filter(event => event[0] === 'toast').length, 0, `${name}: no late notice into another chat`)
      cases++
    }
  }
}

// Actual hook transport plus page route intent, while hook session A remains
// adopted, protects pending and newly-created typed turns in the loader gap.
for (const kind of ['pending', 'initial', 'normal']) {
  for (const during of ['reconnect', 'post-open']) {
    const t = transportHarness()
    const h = scenario(kind, { transport: (...args) => t.c.send(...args) })
    const result = h.context.typedSubmit()
    await settleMicrotasks()
    if (during === 'post-open') await t.tick(150, t.open)
    await t.tick(during === 'reconnect' ? 150 : 250, () => { h.context.routeSession = 'other-session'; h.context.renderScope(); t.open() })
    await result
    assert.equal(t.c.sessionIdRef.current, 'offline-owned-session')
    assert.equal(t.calls.filter(event => event[0] === 'send').length, 0)
    assertUnsent(h, kind)
    cases++
  }
}
for (const kind of ['pending', 'initial', 'normal']) {
  const h = scenario(kind, { activeTemplate: { id: 'native-template', ready: true }, templateModeOn: true, transport: async () => false })
  await h.context.typedSubmit()
  assert.equal(h.context.isGeneratingFinal, false, 'failed template transport never enters native busy lock')
  assert.ok(!h.events.some(event => event[0] === 'template-build'))
  h.flush()
  h.context.transport = async () => true
  await h.context.typedSubmit()
  assert.equal(h.context.isGeneratingFinal, true)
  assert.ok(h.events.some(event => event[0] === 'template-wait' && event[1] === false))
  assert.ok(h.events.findIndex(event => event[0] === 'template-build') > h.events.findIndex(event => event[0] === 'transport'))
  cases++
}
const initialAdoption = scenario('initial')
await initialAdoption.context.typedSubmit()
assert.equal(initialAdoption.context.questionSubmissionScopeRef.current.generation, 0, 'same initially generated ID is not a session switch')
assert.equal(initialAdoption.context.session.userMessages.length, 1)
cases++
for (const response of [null, new Error('creation refused'), { id: 'unexpected-session' }]) {
  const h = scenario('initial', { createSession: async () => { if (response instanceof Error) throw response; return response } })
  await h.context.typedSubmit()
  assertUnsent(h, 'initial')
  assert.equal(h.context.isUnsavedSession, true)
  assert.equal(h.context.createdDirectorSessionRef.current, null)
  assert.ok(!h.events.some(event => ['transport', 'navigation', 'current-session'].includes(event[0])))
  cases++
}
// Source title-update path is retained after first transport success; its
// adapter is still a refusal and is never reported as actual durable storage.
const freshMetadata = scenario('initial')
freshMetadata.context.session.hasTitleFromUserMessageRef.current = false
await freshMetadata.context.typedSubmit()
const metadataRequest = freshMetadata.events.find(event => event[0] === 'rest-refused' && event[2].method === 'PATCH')
assert.equal(metadataRequest[1], '/api/sessions/offline-owned-session')
assert.deepEqual(JSON.parse(metadataRequest[2].body), { title: 'Keep this separate unsent draft' })
cases++
let finishHistory
const historyRace = scenario('initial', { fetch: (url, init) => { historyRace.events.push(['history-wait', url, init]); return new Promise(resolve => { finishHistory = resolve }) } })
const historyResult = historyRace.context.typedSubmit()
await settleMicrotasks()
assert.equal(typeof finishHistory, 'function')
assert.equal(historyRace.context.session.userMessages.length, 1, 'transport succeeded before original-chat history write')
historyRace.context.routeSession = 'other-session'
historyRace.context.currentSessionId = 'other-session'
historyRace.context.renderScope()
historyRace.context.inputMessage = 'Keep the newly displayed chat draft'
historyRace.context.session.userMessages = []
finishHistory({ ok: false, status: 403 })
await historyResult
assert.equal(historyRace.context.inputMessage, 'Keep the newly displayed chat draft')
assert.equal(historyRace.context.session.userMessages.length, 0)
assert.equal(historyRace.events.filter(event => event[0] === 'history-wait').length, 1, 'no late title update after route changed')
cases++
// Enqueue native route intent at the last ownership read in the async helper.
// The getter returns the unchanged owner, so that helper really resolves true;
// its queued navigation runs before the outer await continuation. This targets
// the Promise boundary rather than another already-canceled transport case.
for (const kind of ['pending', 'initial', 'normal']) {
  const h = scenario(kind)
  const scope = h.context.questionSubmissionScopeRef.current
  let owner = scope.userId
  let queued = false
  Object.defineProperty(scope, 'userId', {
    enumerable: true,
    configurable: true,
    get() {
      if (!queued && h.events.some(event => event[0] === 'transport')) {
        queued = true
        h.events.push(['boundary-helper-read'])
        queueMicrotask(() => {
          h.events.push(['boundary-route-change'])
          h.context.routeSession = 'other-session'
          h.context.renderScope()
        })
      }
      return owner
    },
    set(value) { owner = value },
  })
  await h.context.typedSubmit()
  assert.ok(queued, `${kind}: success helper reached its final ownership comparison`)
  assert.equal(h.events.filter(event => event[0] === 'boundary-route-change').length, 1)
  assertUnsent(h, kind)
  assert.ok(!h.events.some(event => ['template-build', 'template-wait', 'clear-files', 'draft', 'pending-action'].includes(event[0])), 'outer continuation rechecks before any visible commit')
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
  cases++
}
// Same-chat edits are not navigation: transport must consume the original
// snapshot while the functional draft updater and ID-specific removals retain
// controls entered during the wait. Run all three real native branches.
const newFile = { id: 'new-source', name: 'Added during wait.txt', size: 88, type: 'text/plain', status: 'stored' }
const replacementAction = { action: { value: 'replacement-native', label: 'Replacement native action', requires_input: true }, messageId: 'replacement-message', timestamp: 5678 }
function assertOriginalMessage(h, kind) {
  const message = h.context.session.userMessages[0]
  assert.equal(message.text, 'Keep this separate unsent draft')
  assert.deepEqual(JSON.parse(JSON.stringify(message.attachments)), files.map(({ id, name, size, type }) => ({ id, name, size, type })))
  const transport = h.events.find(event => event[0] === 'transport')
  assert.equal(transport[1], 'Keep this separate unsent draft')
  assert.equal(transport[3], 2)
  if (kind === 'pending') {
    assert.equal(message.id, pendingAction.messageId)
    assert.equal(message.timestamp, pendingAction.timestamp)
    const persisted = h.events.find(event => event[0] === 'persist')[1]
    assert.equal(persisted.payload.action_value, pendingAction.action.value)
    assert.equal(persisted.payload.action_label, pendingAction.action.label)
    assert.equal(transport[4].actionValue, pendingAction.action.value)
  }
}
for (const kind of ['pending', 'initial', 'normal']) {
  for (const outcome of [true, false, new Error('offline wait refusal')]) {
    let finish, reject
    const h = scenario(kind, { transport: () => new Promise((resolve, fail) => { finish = resolve; reject = fail }) })
    const result = h.context.typedSubmit()
    await settleMicrotasks()
    h.context.setInputMessage('New draft entered during transport')
    h.context.uploadedFiles.push(structuredClone(newFile))
    if (kind !== 'pending') h.context.setPendingActionInput(replacementAction)
    if (outcome instanceof Error) reject(outcome); else finish(outcome)
    await result
    assert.equal(h.context.inputMessage, 'New draft entered during transport')
    assert.deepEqual(h.context.uploadedFiles, outcome === true ? [newFile] : [...files, newFile])
    assert.equal(h.context.pendingActionInput, kind === 'pending' ? (outcome === true ? null : pendingAction) : replacementAction)
    if (outcome === true) {
      assertOriginalMessage(h, kind)
      assert.deepEqual(h.events.filter(event => event[0] === 'remove-file').map(event => event[1]), files.map(file => file.id))
    } else {
      assert.equal(h.context.session.userMessages.length, 0)
      assert.equal(h.events.filter(event => ['persist', 'rest-refused', 'remove-file'].includes(event[0])).length, 0)
    }
    cases++
  }
}
// The snapshot precedes createSession, not just the later transport await.
for (const outcome of [true, false]) {
  let finish
  const h = scenario('initial', { createSession: id => { h.events.push(['create-wait', id]); return new Promise(resolve => { finish = resolve }) }, transport: async () => outcome })
  const result = h.context.typedSubmit()
  h.context.setInputMessage('New draft during row creation')
  h.context.uploadedFiles.push(structuredClone(newFile))
  h.context.setPendingActionInput(replacementAction)
  finish({ id: 'offline-owned-session' })
  await result
  assert.equal(h.context.inputMessage, 'New draft during row creation')
  assert.equal(h.context.pendingActionInput, replacementAction)
  assert.deepEqual(h.context.uploadedFiles, outcome ? [newFile] : [...files, newFile])
  assert.equal(h.events.filter(event => event[0] === 'create-wait').length, 1)
  if (outcome) assertOriginalMessage(h, 'initial')
  else assert.equal(h.context.session.userMessages.length, 0)
  assert.equal(h.events.find(event => event[0] === 'transport')[1], 'Keep this separate unsent draft')
  assert.equal(h.events.find(event => event[0] === 'transport')[3], 2)
  cases++
}
// Cancellation is synchronous intent, including when the state update has not
// rendered yet. Execute the real setter and real hook's pre-send predicate in
// reconnect and post-open waits; no local queue bytes should escape.
for (const during of ['reconnect', 'post-open']) {
  for (const replacement of [null, replacementAction, pendingAction]) {
    for (const deferRender of [false, true]) {
      const t = transportHarness()
      const h = scenario('pending', { transport: (...args) => t.c.send(...args) })
      const result = h.context.typedSubmit()
      await settleMicrotasks()
      if (during === 'post-open') await t.tick(150, t.open)
      if (deferRender) h.context.setPendingActionInputState = value => h.events.push(['deferred-action-state', value])
      await t.tick(during === 'reconnect' ? 150 : 250, () => {
        // Cancel then restore identical object proves revision fencing, beyond
        // an identity-only check. State may still show the original row.
        if (replacement === pendingAction) h.context.setPendingActionInput(null)
        h.context.setPendingActionInput(replacement)
        t.open()
      })
      await result
      assert.equal(t.calls.filter(event => event[0] === 'send').length, 0, 'retired action never reaches actual hook dispatch')
      assert.equal(h.context.session.userMessages.length, 0)
      assert.equal(h.events.filter(event => ['persist', 'rest-refused', 'toast', 'remove-file', 'draft'].includes(event[0])).length, 0, 'cancel is not misreported as connection failure')
      assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
      assert.deepEqual(h.context.uploadedFiles, files)
      assert.equal(h.context.pendingActionIntentRef.current.action, replacement)
      assert.equal(h.context.pendingActionInput, deferRender ? pendingAction : replacement)
      cases++
    }
  }
}
// A stale rendered pending row cannot restart in the same cancel event.
for (const replacement of [null, replacementAction]) {
  const h = scenario('pending')
  h.context.setPendingActionInputState = value => h.events.push(['deferred-action-state', value])
  h.context.setPendingActionInput(replacement)
  await h.context.typedSubmit()
  assert.equal(h.events.filter(event => ['transport', 'echo', 'persist', 'rest-refused', 'toast', 'remove-file', 'draft'].includes(event[0])).length, 0)
  assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
  assert.deepEqual(h.context.uploadedFiles, files)
  cases++
}
// Even a rejected Promise must not turn intentional action retirement into a
// connection failure notice. The submitted editor/file snapshot stays intact.
for (const replacement of [null, replacementAction]) {
  for (const outcome of [false, new Error('canceled wait rejection')]) {
    let finish, reject
    const h = scenario('pending', { transport: () => new Promise((resolve, fail) => { finish = resolve; reject = fail }) })
    const result = h.context.typedSubmit()
    await settleMicrotasks()
    h.context.setPendingActionInput(replacement)
    if (outcome instanceof Error) reject(outcome); else finish(outcome)
    await result
    assert.equal(h.context.pendingActionInput, replacement)
    assert.equal(h.context.session.userMessages.length, 0)
    assert.equal(h.events.filter(event => ['persist', 'rest-refused', 'toast', 'remove-file', 'draft'].includes(event[0])).length, 0)
    assert.equal(h.context.inputMessage, 'Keep this separate unsent draft')
    assert.deepEqual(h.context.uploadedFiles, files)
    cases++
  }
}
// Once the actual hook queues the original action, cancellation cannot erase
// its accurate history. New action/draft/files survive the awaited completion.
for (const replacement of [null, replacementAction, pendingAction]) {
  const t = transportHarness()
  const h = scenario('pending', { transport: (...args) => t.c.send(...args) })
  const nativeDispatch = t.c.sendMessage
  t.c.sendMessage = (...args) => {
    const queued = nativeDispatch(...args)
    h.context.setInputMessage('Post-dispatch new draft')
    h.context.uploadedFiles.push(structuredClone(newFile))
    if (replacement === pendingAction) h.context.setPendingActionInput(null)
    h.context.setPendingActionInput(replacement)
    return queued
  }
  const result = h.context.typedSubmit()
  await settleMicrotasks()
  await t.tick(150, t.open)
  await t.tick(250)
  await result
  assert.equal(t.calls.filter(event => event[0] === 'send').length, 1)
  assertOriginalMessage(h, 'pending')
  assert.equal(h.context.inputMessage, 'Post-dispatch new draft')
  assert.deepEqual(h.context.uploadedFiles, [newFile])
  assert.equal(h.context.pendingActionInput, replacement)
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
  cases++
}
// Overrides use their native argument text, without consuming another draft.
for (const kind of ['pending', 'initial', 'normal']) {
  for (const override of ['Different native override', '  Keep this separate unsent draft  ']) {
    const h = scenario(kind)
    await h.context.typedSubmit(undefined, override)
    assert.equal(h.context.session.userMessages[0].text, override.trim())
    assert.equal(h.context.inputMessage, override.trim() === 'Keep this separate unsent draft' ? '' : 'Keep this separate unsent draft')
    assert.equal(h.events.find(event => event[0] === 'transport')[1], override.trim())
    assert.deepEqual(h.context.uploadedFiles, [])
    cases++
  }
}
// New editing state with identical trimmed content but different bytes still
// belongs to the user; only the exact submitted raw draft can be cleared.
for (const kind of ['pending', 'initial', 'normal']) {
  let finish
  const h = scenario(kind, { transport: () => new Promise(resolve => { finish = resolve }) })
  const result = h.context.typedSubmit()
  await settleMicrotasks()
  h.context.setInputMessage('  Keep this separate unsent draft  ')
  finish(true)
  await result
  assert.equal(h.context.inputMessage, '  Keep this separate unsent draft  ')
  assertOriginalMessage(h, kind)
  cases++
}
console.log(`Director typed commit: ${cases} offline C4 cases passed; exact native options/action/attachments, failure retention, confirmed-row retry, creation/send/route/account/unmount races, duplicate suppression, template busy timing, initial adoption, same-chat draft/file snapshots and synchronous action cancellation before/after actual dispatch. No service write or acknowledgement performed.`)
