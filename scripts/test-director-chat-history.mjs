import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

function compile(path, require = () => { throw new Error('Unexpected dependency') }, extra = {}, sourceOverride) {
  const source = sourceOverride ?? fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(result.outputText, { module, exports: module.exports, require, console, setTimeout, clearTimeout, Blob, ...extra })
  return module.exports
}
const helpers = compile('../lib/director-chat-history.ts')
const { mergeDirectorChatHistory, missingDirectorUserTurns, directorHistoryTimestamp, DirectorChatSaveQueue } = helpers
const plain = value => JSON.parse(JSON.stringify(value))
const frame = (id, session = 'synthetic-a', text = 'Repeated response', type = 'chat_message') => ({
  message_id: id, session_id: session, timestamp: '2026-10-04T00:00:00Z', type, payload: { text },
})
let checks = 0
function check(name, action) { action(); checks++; console.log(`PASS ${name}`) }
check('DB restore retains pending cached/live responses and repeated text with different IDs', () => {
  const db = frame('old')
  const cached = frame('cached')
  const live = frame('live')
  assert.deepEqual(plain(mergeDirectorChatHistory('synthetic-a', [db], [cached], [live])), [db, cached, live])
})
check('restored snapshot never replaces a newer replayed decision payload for the same ID', () => {
  const old = { ...frame('decision', 'synthetic-a', '', 'action_request'), payload: { actions: [{ value: 'old' }] } }
  const live = { ...old, payload: { actions: [{ value: 'approve_plan' }], question_set: { id: 'set-original' } } }
  assert.deepEqual(plain(mergeDirectorChatHistory('synthetic-a', [old], [live])), [live])
})
check('session switch rejects another conversation and capability frame', () => {
  assert.deepEqual(plain(mergeDirectorChatHistory('synthetic-b', [frame('a')], [frame('b', 'synthetic-b'), frame('secret', 'synthetic-b', '', 'build_control_capability')])), [frame('b', 'synthetic-b')])
})
check('empty DB snapshot keeps only same-session current history', () => {
  assert.deepEqual(plain(mergeDirectorChatHistory('synthetic-a', [], [frame('a'), frame('b', 'synthetic-b')])), [frame('a')])
})
check('one local answer reconciles only one replay; repeated identical turns remain', () => {
  const first = { ...frame('replay-1'), role: 'user' }
  const second = { ...frame('replay-2'), role: 'user' }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [first, second], [{ id: 'local-1', text: 'Repeated response', timestamp: Date.parse(first.timestamp) }])), [second])
})
check('exact IDs reserve their local match before the legacy text fallback', () => {
  const oldReplay = { ...frame('replay-1'), role: 'user' }
  const exact = { ...frame('local-2'), role: 'user' }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [oldReplay, exact], [{ id: 'local-2', text: 'Repeated response', timestamp: Date.parse(exact.timestamp) }])), [oldReplay])
})
check('recovery ignores assistant and other-session turns', () => {
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [{ ...frame('assistant'), role: 'assistant' }, { ...frame('other', 'synthetic-b'), role: 'user' }], [])), [])
})
check('older same-text historical turn is retained beside newer local turn', () => {
  const historical = { ...frame('old-user'), role: 'user' }
  const local = { id: 'new-user', text: 'Repeated response', timestamp: Date.parse(historical.timestamp) + 60_000 }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [historical], [local])), [historical])
})
check('newer same-text Director turn is retained beside older local turn', () => {
  const incoming = { ...frame('new-user'), role: 'user' }
  const local = { id: 'old-user', text: 'Repeated response', timestamp: Date.parse(incoming.timestamp) - 60_000 }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [incoming], [local])), [incoming])
})
check('different-ID user echo reconciles only exact text and equal finite timestamp', () => {
  const incoming = { ...frame('replay-user'), role: 'user' }
  const local = { id: 'local-user', text: 'Repeated response', timestamp: Date.parse(incoming.timestamp) }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [incoming], [local])), [])
  for (const text of ['repeated response', 'Repeated response ']) {
    assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [incoming], [{ ...local, text }])), [incoming])
  }
})
check('invalid or absent timestamp never consumes a different-ID same-text turn', () => {
  const incoming = { ...frame('replay-user'), role: 'user' }
  const local = { id: 'local-user', text: 'Repeated response', timestamp: Date.parse(incoming.timestamp) }
  for (const timestamp of [NaN, Infinity, undefined]) {
    assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [incoming], [{ ...local, timestamp }])), [incoming])
  }
  for (const timestamp of ['', 'invalid', undefined]) {
    const unknown = { ...incoming, timestamp }
    assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [unknown], [local])), [plain(unknown)])
  }
  assert.deepEqual(plain(missingDirectorUserTurns('synthetic-a', [incoming], [{ ...local, id: incoming.message_id, timestamp: NaN }])), [], 'exact IDs still identify a turn despite malformed timestamp')
})
check('Director naive ISO timestamp uses UTC and explicit offset retains its instant', () => {
  const expected = Date.parse('2026-10-04T00:00:00Z')
  assert.equal(directorHistoryTimestamp('2026-10-04T00:00:00'), expected)
  assert.equal(directorHistoryTimestamp('2026-10-03T20:00:00-04:00'), expected)
  assert.equal(Number.isNaN(directorHistoryTimestamp(undefined)), true)
})
const persisted = (id, text = id) => ({ id, messageType: 'chat_message', timestamp: '2026-10-04T00:00:00Z', payload: { text } })
check('snapshot acknowledgement preserves messages queued while save was in flight', () => {
  const queue = new DirectorChatSaveQueue()
  queue.enqueue('synthetic-owner', 'synthetic-a', persisted('first'))
  const snapshot = queue.snapshots('synthetic-owner')[0]
  queue.enqueue('synthetic-owner', 'synthetic-a', persisted('reply'))
  assert.equal(queue.acknowledge(snapshot, { saved: 1, failed: 0, total: 1 }), true)
  assert.deepEqual(plain(queue.snapshots('synthetic-owner')[0].messages), [persisted('reply')])
})
check('same-ID action update during save remains pending', () => {
  const queue = new DirectorChatSaveQueue()
  queue.enqueue('synthetic-owner', 'synthetic-a', persisted('action', 'old'))
  const snapshot = queue.snapshots('synthetic-owner')[0]
  queue.enqueue('synthetic-owner', 'synthetic-a', persisted('action', 'new'))
  queue.acknowledge(snapshot, { saved: 1, failed: 0, total: 1 })
  assert.deepEqual(plain(queue.snapshots('synthetic-owner')[0].messages), [persisted('action', 'new')])
})
check('partial/refused/malformed saves retain the full idempotent batch', () => {
  for (const result of [null, { saved: 1, failed: 1, total: 2 }, { saved: 2, failed: 0, total: 1 }]) {
    const queue = new DirectorChatSaveQueue()
    queue.enqueue('synthetic-owner', 'synthetic-a', persisted('one'))
    queue.enqueue('synthetic-owner', 'synthetic-a', persisted('two'))
    assert.equal(queue.acknowledge(queue.snapshots('synthetic-owner')[0], result), false)
    assert.equal(queue.size('synthetic-owner'), 2)
  }
})
check('same-ID rows preserve session/account owners without collisions', () => {
  const queue = new DirectorChatSaveQueue()
  queue.enqueue('synthetic-owner', 'synthetic-a', persisted('shared'))
  queue.enqueue('synthetic-owner', 'synthetic-b', persisted('shared'))
  queue.enqueue('other-owner', 'synthetic-a', persisted('shared'))
  assert.deepEqual(plain(queue.snapshots('synthetic-owner').map(batch => batch.sessionId)), ['synthetic-a', 'synthetic-b'])
  assert.equal(queue.size('other-owner'), 1)
})

// Execute the real persistence hook with only transport/cache/React boundaries
// mocked. Every record is synthetic and all save calls stay in this process.
const harnesses = []
function hookHarness(persistenceSource) {
  const timers = new Set()
  let cursor = 0
  const slots = []
  const effects = []
  const requests = []
  const cacheWrites = []
  const errors = []
  const events = new Map()
  const beacons = []
  const saveMessages = (sessionId, messages) => new Promise(resolve => { requests.push({ sessionId, messages: plain(messages), resolve }) })
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useCallback(callback, deps) {
      const index = cursor++
      const old = slots[index]
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) slots[index] = { callback, deps }
      return slots[index].callback
    },
    useEffect(callback, deps) {
      const index = cursor++
      const old = slots[index]
      if (!old || !deps || deps.some((dep, i) => dep !== old.deps?.[i])) effects.push(callback)
      slots[index] = { deps }
    },
  }
  const cache = { appendMessage: (...args) => cacheWrites.push(args) }
  const { useSessionPersistence } = compile('../hooks/use-session-persistence.ts', name => {
    if (name === 'react') return react
    if (name === './use-chat-sessions') return { useChatSessions: () => ({ saveMessages, updateSession: async () => null }) }
    if (name === './use-session-cache') return { useSessionCache: () => cache }
    if (name === '@/lib/debug-log') return { debugLog: () => {} }
    if (name === '@/lib/director-chat-history') return helpers
    throw new Error(`Unexpected import ${name}`)
  }, {
    setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timers.add(timer); return timer },
    clearTimeout: timer => { clearTimeout(timer); timers.delete(timer) },
    window: { addEventListener: (name, listener) => events.set(name, listener), removeEventListener: name => events.delete(name) },
    navigator: { sendBeacon: (url, blob) => { beacons.push({ url, blob }); return true } },
  }, persistenceSource)
  const render = (sessionId = 'synthetic-a', enabled = true, userId = 'synthetic-owner') => {
    cursor = 0
    const api = useSessionPersistence({ sessionId, userId, enabled, debounceMs: 60_000, onError: error => errors.push(error.message) })
    while (effects.length) effects.shift()()
    return api
  }
  const harness = { render, requests, cacheWrites, errors, events, beacons, dispose: () => { for (const timer of timers) clearTimeout(timer) } }
  harnesses.push(harness)
  return harness
}
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)) }
const success = request => request.resolve({ saved: request.messages.length, failed: 0, total: request.messages.length })
const beforeRef = process.argv.find(argument => argument.startsWith('--before-ref='))?.slice('--before-ref='.length)
if (beforeRef) {
  const source = execFileSync('git', ['show', `${beforeRef}:hooks/use-session-persistence.ts`], { encoding: 'utf8' })
  const h = hookHarness(source)
  const api = h.render()
  api.queueMessage(frame('baseline-user'), 'Synthetic baseline turn')
  api.queueMessage(frame('baseline-response'))
  success(h.requests[0]); await settle()
  assert.equal(h.requests.length, 1, 'baseline never saves the response queued during the user request')
  assert.equal(h.render().pendingCount, 0, 'baseline silently clears that unsaved response')
  console.log(`CONFIRMED before-state at ${beforeRef}: in-flight user save clears the later assistant response without saving it.`)
  for (const harness of harnesses) harness.dispose()
} else {

async function asyncCheck(name, action) { await action(); checks++; console.log(`PASS ${name}`) }
await asyncCheck('real hook drains assistant response arriving during user save', async () => {
  const h = hookHarness(); const api = h.render()
  api.queueMessage(frame('user'), 'Synthetic turn')
  api.queueMessage(frame('response'))
  assert.equal(h.requests.length, 1)
  success(h.requests[0]); await settle()
  assert.equal(h.requests.length, 2)
  assert.deepEqual(h.requests[1].messages.map(row => row.id), ['response'])
  success(h.requests[1]); await settle()
  assert.equal(h.render().pendingCount, 0)
})
await asyncCheck('real hook keeps partial batch, then explicit retry saves it', async () => {
  const h = hookHarness(); let api = h.render()
  api.queueMessage(frame('user'), 'Synthetic turn')
  h.requests[0].resolve({ saved: 0, failed: 1, total: 1 }); await settle()
  api = h.render()
  assert.equal(api.pendingCount, 1)
  assert.equal(h.requests.length, 1, 'rerender does not create a failure retry loop')
  const retry = api.flushMessages(); success(h.requests[1]); await retry
  assert.equal(h.render().pendingCount, 0)
})
await asyncCheck('real hook preserves disabled queue and saves to original session after navigation', async () => {
  const h = hookHarness(); let api = h.render()
  api.queueMessage(frame('old-response'))
  api = h.render('synthetic-b', false)
  api.queueMessage(frame('blocked', 'synthetic-b'))
  await api.flushMessages()
  assert.equal(h.requests.length, 0)
  assert.equal(api.pendingCount, 1)
  api = h.render('synthetic-b', true)
  assert.equal(h.requests[0].sessionId, 'synthetic-a')
  success(h.requests[0]); await settle()
  assert.equal(h.render('synthetic-b').pendingCount, 0)
})
await asyncCheck('real hook isolates account change while previous save finishes', async () => {
  const h = hookHarness(); let api = h.render()
  api.queueMessage(frame('old-user'), 'Synthetic old turn')
  api.queueMessage(frame('old-response'))
  api = h.render('synthetic-b', true, 'other-owner')
  api.queueMessage(frame('new-user', 'synthetic-b'), 'Synthetic new turn')
  success(h.requests[0]); await settle()
  assert.equal(h.requests[1].sessionId, 'synthetic-b')
  assert.deepEqual(h.requests[1].messages.map(row => row.id), ['new-user'])
  success(h.requests[1]); await settle()
  api = h.render('synthetic-a', true, 'synthetic-owner')
  assert.equal(h.requests[2].sessionId, 'synthetic-a')
  assert.deepEqual(h.requests[2].messages.map(row => row.id), ['old-response'])
  success(h.requests[2]); await settle()
})
await asyncCheck('refused older conversation cannot block a new conversation save', async () => {
  const h = hookHarness(); let api = h.render()
  api.queueMessage(frame('old-response'))
  h.render('synthetic-b', false)
  api = h.render('synthetic-b')
  api.queueMessage(frame('new-user', 'synthetic-b'), 'Synthetic new turn')
  h.requests[0].resolve(null); await settle()
  assert.equal(h.requests[1].sessionId, 'synthetic-b')
  assert.deepEqual(h.requests[1].messages.map(row => row.id), ['new-user'])
  success(h.requests[1]); await settle()
  assert.equal(h.render('synthetic-b').pendingCount, 1)
})
await asyncCheck('saveBatch awaits all batched messages even when a save is in flight', async () => {
  const h = hookHarness(); const api = h.render()
  api.queueMessage(frame('first'), 'Synthetic first turn')
  let completed = false
  const saved = api.saveBatch([frame('batch-response')]).then(() => { completed = true })
  success(h.requests[0]); await settle()
  assert.equal(completed, false)
  assert.deepEqual(h.requests[1].messages.map(row => row.id), ['batch-response'])
  success(h.requests[1]); await saved
  assert.equal(completed, true)
})
await asyncCheck('beforeunload beacons retain original session and current account only', async () => {
  const h = hookHarness(); let api = h.render()
  api.queueMessage(frame('a-response'))
  h.render('synthetic-b', false)
  api = h.render('synthetic-b', true, 'other-owner')
  api.queueMessage(frame('b-response', 'synthetic-b'))
  h.events.get('beforeunload')()
  assert.equal(h.beacons.length, 1)
  assert.equal(h.beacons[0].url, '/api/sessions/synthetic-b/messages')
  assert.deepEqual(JSON.parse(await h.beacons[0].blob.text()).messages.map(row => row.id), ['b-response'])
  api.queueMessage(frame('new-user', 'synthetic-b'), 'Synthetic turn')
  success(h.requests[0]); await settle()
})
await asyncCheck('hook refuses obsolete-session frames and never persists a capability', async () => {
  const h = hookHarness(); const api = h.render('synthetic-b')
  api.queueMessage(frame('stale', 'synthetic-a'))
  api.queueMessage(frame('capability', 'synthetic-b', '', 'build_control_capability'))
  api.queueMessage(frame('tokens', 'synthetic-b', '', 'token_usage'))
  assert.equal(h.cacheWrites.length, 0)
  assert.equal(h.requests.length, 0)
  assert.equal(h.render('synthetic-b').pendingCount, 0)
})
console.log(`${checks} Director chat history checks passed (source and synthetic in-process replay only).`)
for (const harness of harnesses) harness.dispose()

}
