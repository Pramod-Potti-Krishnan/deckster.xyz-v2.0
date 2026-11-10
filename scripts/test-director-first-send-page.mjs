import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createFirstSendHookHarness } from '../docs/studio-v4/first-send-20261004/test-first-send-hook.mjs'
import { typedHarness, pageOwnership, evaluate, layoutLifecycle, page } from './test-director-question-submit.mjs'

// Actual hook + extracted actual page submission, with synthetic React scheduling,
// token responses and WebSocket only. No login, server acknowledgement or API write.
const hookPath = 'hooks/use-deckster-websocket-v2.ts'
const before = execFileSync('git', ['show', `afae30c7:${hookPath}`], { encoding: 'utf8' })
const after = fs.readFileSync(hookPath, 'utf8')
const receipts = []
for (const [label, source, expectedSent] of [['accepted-before', before, false], ['corrected-after', after, true]]) {
  const transport = createFirstSendHookHarness({}, source)
  transport.adopt('synthetic-b')
  await transport.token(1)
  const currentSocket = transport.sockets.find(socket => socket.session === 'synthetic-b')
  assert.ok(currentSocket)
  currentSocket.open(); currentSocket.sync()
  await transport.token(0)
  transport.sockets.find(socket => socket.session === 'synthetic-a')?.open()

  const p = typedHarness({
    user: { id: 'synthetic-owner' },
    currentSessionId: 'synthetic-b', wsSessionId: 'synthetic-b', isUnsavedSession: true,
    isReady: transport.api.isReady,
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'synthetic-b', userId: 'synthetic-owner', routeSessionId: 'synthetic-b', freshRouteSourceSessionId: null } },
    createdDirectorSessionRef: { current: null },
    setIsUnsavedSession: value => p.context.isUnsavedSession = value,
    setCurrentSessionId: value => p.context.currentSessionId = value,
    router: { push: () => assert.fail('persisted B route must not be reassigned') },
    createSession: async id => { p.events.push(['synthetic-db-create', id]); return { id } },
    transport: (...args) => transport.api.sendMessageWhenConnected(...args),
    buildSendOptions: { theme: { mode: 'preset', preset_id: 'synthetic-preset' }, deckIdentity: { main_title: 'Synthetic retained title' } },
  })
  pageOwnership(p, 'synthetic-b')
  evaluate(`globalThis.cleanup = (${layoutLifecycle(page, 'questionSubmissionScopeRef')})();`, p.context)
  await p.context.typedSubmit()
  const sends = currentSocket.sends.map(JSON.parse).filter(frame => frame.type === 'user_message')
  const failureToast = p.events.find(event => event[0] === 'toast' && event[1].title === "Couldn't reach the Director")
  assert.equal(sends.length, expectedSent ? 1 : 0)
  assert.equal(p.context.session.userMessages.length, expectedSent ? 1 : 0)
  assert.equal(p.context.inputMessage, expectedSent ? '' : 'Keep this separate unsent draft')
  assert.equal(Boolean(failureToast), !expectedSent)
  assert.equal(p.events.filter(event => event[0] === 'synthetic-db-create').length, 1)
  if (expectedSent) {
    assert.equal(sends[0].data.text, 'Keep this separate unsent draft')
    assert.deepEqual(sends[0].data.theme, { mode: 'preset', preset_id: 'synthetic-preset' })
    assert.deepEqual(sends[0].data.deck_identity, { main_title: 'Synthetic retained title' })
    assert.equal(sends[0].data.deep_research, true)
    assert.equal(sends[0].data.web_search, true)
    assert.equal(sends[0].data.store_name, 'offline-linked-store')
  } else {
    assert.equal(failureToast[1].description, 'Your message was not sent — the connection dropped and could not be reopened. It is still in the box; try again.')
    assert.equal(p.events.some(event => event[0] === 'rest-refused'), false, 'refused transport never commits sent history')
  }
  receipts.push({ label, constructedSessions: transport.sockets.map(socket => socket.session), displayedSession: transport.api.sessionId, socketSession: transport.api.socketSessionId, connected: transport.api.connected, userFrames: sends.length, draftRetained: Boolean(p.context.inputMessage), localEchoCount: p.context.session.userMessages.length, observedFailureToast: Boolean(failureToast) })
  transport.unmount()
}
console.log(JSON.stringify({ evidenceLevel: 'Actual source under synthetic in-process transport; no connected acceptance', scenarios: receipts }, null, 2))
console.log('2 page + full-hook first-send integration scenarios passed (imported structured submission checks are separate).')
