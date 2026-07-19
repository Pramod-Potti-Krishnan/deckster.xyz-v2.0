import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const policySource = fs.readFileSync(
  new URL('../lib/director-reconnect-policy.ts', import.meta.url),
  'utf8',
)
const compiledPolicy = ts.transpileModule(policySource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})
const policyModule = { exports: {} }
vm.runInNewContext(compiledPolicy.outputText, {
  module: policyModule,
  exports: policyModule.exports,
})
const {
  DIRECTOR_HEARTBEAT_INTERVAL_MS,
  DIRECTOR_PONG_TIMEOUT_MS,
  DIRECTOR_RECONNECT_STABILITY_MS,
  resolveDirectorReconnectPlan,
  shouldRequestBuilderSessionConnection,
  shouldReconnectDirectorOnOnline,
} = policyModule.exports
const plain = value => JSON.parse(JSON.stringify(value))

assert.equal(DIRECTOR_HEARTBEAT_INTERVAL_MS, 15_000)
assert.equal(DIRECTOR_PONG_TIMEOUT_MS, 10_000)
assert.equal(DIRECTOR_RECONNECT_STABILITY_MS, 30_000)

const commonPlan = {
  reconnectEnabled: true,
  manualDisconnect: false,
  connectionDesired: true,
  online: true,
  attempts: 0,
  maxAttempts: 4,
  baseDelayMs: 1_500,
}

assert.deepEqual(
  plain(resolveDirectorReconnectPlan(commonPlan)),
  { kind: 'schedule', attempt: 1, delayMs: 1_500 },
)
assert.deepEqual(
  plain(resolveDirectorReconnectPlan({ ...commonPlan, attempts: 3 })),
  { kind: 'schedule', attempt: 4, delayMs: 12_000 },
)
assert.deepEqual(
  plain(resolveDirectorReconnectPlan({ ...commonPlan, attempts: 4 })),
  { kind: 'skip', reason: 'exhausted' },
)
assert.deepEqual(
  plain(resolveDirectorReconnectPlan({ ...commonPlan, attempts: 3, online: false })),
  { kind: 'pause', reason: 'offline' },
  'offline recovery pauses without incrementing or exhausting the retry budget',
)
assert.deepEqual(
  plain(resolveDirectorReconnectPlan({ ...commonPlan, manualDisconnect: true })),
  { kind: 'skip', reason: 'manual' },
)
assert.deepEqual(
  plain(resolveDirectorReconnectPlan({ ...commonPlan, connectionDesired: false })),
  { kind: 'skip', reason: 'not_desired' },
)

for (const readyState of [null, 0, 1, 3]) {
  assert.equal(
    shouldReconnectDirectorOnOnline({
      reconnectEnabled: true,
      manualDisconnect: false,
      connectionDesired: true,
      resumingFromOffline: false,
      reconnectStatus: 'idle',
      socketReadyState: readyState,
    }),
    false,
    'an online event without an owned offline pause cannot create a retry side channel',
  )
}
assert.equal(
  shouldReconnectDirectorOnOnline({
    reconnectEnabled: true,
    manualDisconnect: true,
    connectionDesired: true,
    resumingFromOffline: true,
    reconnectStatus: 'manual',
    socketReadyState: null,
  }),
  false,
  'manual disconnect remains disconnected across online events',
)
for (const staleReadyState of [0, 1]) {
  assert.equal(
    shouldReconnectDirectorOnOnline({
      reconnectEnabled: true,
      manualDisconnect: false,
      connectionDesired: true,
      resumingFromOffline: true,
      reconnectStatus: 'paused_offline',
      socketReadyState: staleReadyState,
    }),
    true,
    'a socket that crossed an offline boundary is replaced regardless of its stale readyState',
  )
}
assert.equal(
  shouldReconnectDirectorOnOnline({
    reconnectEnabled: true,
    manualDisconnect: false,
    connectionDesired: true,
    resumingFromOffline: true,
    reconnectStatus: 'exhausted',
    socketReadyState: null,
  }),
  false,
  'offline/online events cannot erase durable retry exhaustion',
)

const initialSessionRequest = {
  sessionKey: 'session-a',
  lastRequestedSessionKey: null,
  loading: false,
  connected: false,
  connecting: false,
  reconnectStatus: 'idle',
}
assert.equal(shouldRequestBuilderSessionConnection(initialSessionRequest), true)
assert.equal(
  shouldRequestBuilderSessionConnection({
    ...initialSessionRequest,
    lastRequestedSessionKey: 'session-a',
  }),
  false,
  'StrictMode/effect replay cannot duplicate the initial connection request',
)
for (const reconnectStatus of ['idle', 'scheduled', 'paused_offline', 'exhausted', 'manual']) {
  assert.equal(
    shouldRequestBuilderSessionConnection({
      ...initialSessionRequest,
      lastRequestedSessionKey: 'session-a',
      reconnectStatus,
    }),
    false,
    `a close render in ${reconnectStatus} state cannot bypass transport ownership`,
  )
}
assert.equal(
  shouldRequestBuilderSessionConnection({
    ...initialSessionRequest,
    sessionKey: 'session-b',
    lastRequestedSessionKey: 'session-a',
  }),
  true,
  'a session switch resets initial connection ownership',
)
assert.equal(
  shouldRequestBuilderSessionConnection({
    ...initialSessionRequest,
    loading: true,
  }),
  false,
  'session restore must finish before the initial connection handoff',
)

const timedAttempts = []
let executedAttempts = 0
while (true) {
  const plan = plain(resolveDirectorReconnectPlan({
    ...commonPlan,
    attempts: executedAttempts,
  }))
  if (plan.kind === 'skip') {
    assert.deepEqual(plan, { kind: 'skip', reason: 'exhausted' })
    break
  }
  assert.equal(plan.kind, 'schedule')
  timedAttempts.push({ attempt: plan.attempt, delayMs: plan.delayMs })
  executedAttempts = plan.attempt
}
assert.deepEqual(
  timedAttempts,
  [
    { attempt: 1, delayMs: 1_500 },
    { attempt: 2, delayMs: 3_000 },
    { attempt: 3, delayMs: 6_000 },
    { attempt: 4, delayMs: 12_000 },
  ],
  'repeated transport closes produce exactly the configured timed retry attempts',
)

const hookSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
  'utf8',
)
const sessionHookSource = fs.readFileSync(
  new URL('../hooks/use-builder-session.ts', import.meta.url),
  'utf8',
)
const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')

const renderInitialization = hookSource.slice(
  hookSource.indexOf('// CRITICAL FIX: Initialize session ID'),
  hookSource.indexOf('// FIXED: Initialize user ID'),
)
assert.doesNotMatch(
  renderInitialization,
  /options\.existingSessionId !== sessionIdRef\.current[\s\S]*sessionIdRef\.current = options\.existingSessionId/,
  'a changed Director session ID must not be consumed during render',
)

const sessionTransitionEffect = hookSource.slice(
  hookSource.indexOf('// Reconnect when the Builder adopts a persisted/new database session ID.'),
  hookSource.indexOf('// Connect on the render after session adoption.'),
)
assert.match(sessionTransitionEffect, /sessionIdRef\.current = nextSessionId/)
assert.match(sessionTransitionEffect, /reconnectAttemptsRef\.current = 0/)
assert.match(sessionTransitionEffect, /setReconnectStatus\('idle', 0\)/)
assert.match(sessionTransitionEffect, /wsRef\.current = null/)
assert.match(sessionTransitionEffect, /if \(previousSocket\) previousSocket\.close\(\)/)
assert.ok(
  sessionTransitionEffect.indexOf('wsRef.current = null') <
    sessionTransitionEffect.indexOf('previousSocket.close()'),
  'the old session socket is detached before close',
)

const browserConnectivityEffect = hookSource.slice(
  hookSource.indexOf('// Browser connectivity is a gate, not a retry attempt.'),
  hookSource.indexOf('// Reconnect when the Builder adopts a persisted/new database session ID.'),
)
assert.match(browserConnectivityEffect, /window\.addEventListener\('offline', handleOffline\)/)
assert.match(browserConnectivityEffect, /window\.addEventListener\('online', handleOnline\)/)
assert.doesNotMatch(
  browserConnectivityEffect,
  /reconnectAttemptsRef\.current = 0/,
  'offline recovery preserves the bounded retry budget',
)
assert.match(browserConnectivityEffect, /pendingReconnectAttemptRef\.current/)
assert.match(browserConnectivityEffect, /startConnectionRef\.current\(\)/)
assert.match(
  browserConnectivityEffect,
  /resumingFromOffline: reconnectPausedForOfflineRef\.current/,
)
assert.match(browserConnectivityEffect, /reconnectStatusRef\.current === 'exhausted'/)
assert.ok(
  browserConnectivityEffect.indexOf('wsRef.current = null') <
    browserConnectivityEffect.indexOf("socket.close(4001, 'Browser online reconnect')"),
  'online recovery detaches the stale socket before closing it',
)
assert.doesNotMatch(
  browserConnectivityEffect,
  /sendMessage\(/,
  'transport recovery never replays non-idempotent user/build messages',
)

const disconnectHandler = hookSource.slice(
  hookSource.indexOf('// Disconnect from WebSocket'),
  hookSource.indexOf('// Send message to server'),
)
assert.match(disconnectHandler, /manualDisconnectRef\.current = true/)
assert.match(disconnectHandler, /connectionDesiredRef\.current = false/)
assert.ok(
  disconnectHandler.indexOf('manualDisconnectRef.current = true') <
    disconnectHandler.indexOf('socket.close()'),
  'manual intent is recorded before closing the socket',
)
assert.ok(
  disconnectHandler.indexOf('wsRef.current = null') <
    disconnectHandler.indexOf('socket.close()'),
  'manual close is detached so it cannot schedule a reconnect',
)

assert.match(hookSource, /socket\.send\('ping'\)/)
assert.match(hookSource, /acknowledgeHeartbeat\(ws\)/)
assert.match(hookSource, /socket\.close\(4000, 'Director heartbeat timeout'\)/)
assert.match(hookSource, /scheduleReconnect\(`close:\$\{event\.code\}`\)/)
const scheduleHandler = hookSource.slice(
  hookSource.indexOf('const scheduleReconnect = useCallback'),
  hookSource.indexOf('// Start one transport attempt.'),
)
assert.match(scheduleHandler, /setReconnectStatus\('scheduled', plan\.attempt\)/)
assert.match(scheduleHandler, /setReconnectStatus\('exhausted', reconnectAttemptsRef\.current\)/)
assert.match(scheduleHandler, /startConnectionRef\.current\(\)/)
assert.doesNotMatch(scheduleHandler, /\bconnect\(\)/)

const automaticConnectionOwner = hookSource.slice(
  hookSource.indexOf('// Automatic session ownership never resets'),
  hookSource.indexOf('// Public connect is an explicit user retry.'),
)
assert.match(automaticConnectionOwner, /reconnectStatusRef\.current !== 'idle'/)
assert.doesNotMatch(automaticConnectionOwner, /reconnectAttemptsRef\.current = 0/)

const manualRetryOwner = hookSource.slice(
  hookSource.indexOf('// Public connect is an explicit user retry.'),
  hookSource.indexOf('// React StrictMode replays mount setup'),
)
assert.match(manualRetryOwner, /reconnectAttemptsRef\.current = 0/)
assert.match(manualRetryOwner, /clearReconnectTimer\(\)/)

const strictModeMountOwner = hookSource.slice(
  hookSource.indexOf('// React StrictMode replays mount setup'),
  hookSource.indexOf('// Browser connectivity is a gate, not a retry attempt.'),
)
assert.match(strictModeMountOwner, /reconnectStatusRef\.current === 'manual'/)
assert.match(strictModeMountOwner, /reconnectAttemptsRef\.current === 0/)
assert.match(strictModeMountOwner, /ensureConnected\(\)/)
assert.doesNotMatch(strictModeMountOwner, /reconnectStatusRef\.current === 'exhausted'/)

const builderConnectionOwner = sessionHookSource.slice(
  sessionHookSource.indexOf('// The session layer owns exactly one initial connection request'),
  sessionHookSource.indexOf('// Persist bot messages received from WebSocket'),
)
assert.match(builderConnectionOwner, /connectionRequestedSessionRef\.current = sessionKey/)
assert.match(builderConnectionOwner, /shouldRequestBuilderSessionConnection\(/)
assert.match(
  builderConnectionOwner,
  /if \(!ensureConnected\(\)\) \{[\s\S]*connectionRequestedSessionRef\.current = null/,
  'a rejected low-level start does not permanently latch the session before auth is ready',
)
assert.match(builderConnectionOwner, /loading: isLoadingSession \|\| isAuthLoading \|\| !user/)
assert.doesNotMatch(
  builderConnectionOwner,
  /\bconnect\(\)/,
  'the higher-level session effect cannot invoke the manual retry/reset path',
)
assert.match(
  sessionHookSource,
  /useState\(\(\) => Boolean\(currentSessionId\)\)/,
  'a URL-owned session is loading before any effect can request Director',
)

const openHandler = hookSource.slice(
  hookSource.indexOf('ws.onopen = () => {'),
  hookSource.indexOf('ws.onmessage = (event) => {'),
)
assert.match(openHandler, /clearReconnectTimer\(\)/)
assert.match(openHandler, /DIRECTOR_RECONNECT_STABILITY_MS/)
assert.doesNotMatch(
  openHandler.slice(0, openHandler.indexOf('setTimeout')),
  /reconnectAttemptsRef\.current = 0/,
  'an unstable open/close cycle cannot reset the retry budget immediately',
)

assert.match(builderSource, /reconnectOnError: true/)
assert.match(builderSource, /maxReconnectAttempts: 4/)
assert.match(builderSource, /reconnectDelay: 1500/)
assert.match(builderSource, /reconnectStatus,\s*ensureConnected,/)

const disconnectedUserTurn = builderSource.slice(
  builderSource.indexOf('// Sending a Director turn is non-idempotent.'),
  builderSource.indexOf('// Handle pending action input'),
)
assert.match(disconnectedUserTurn, /\bconnect\(\)/)
assert.match(disconnectedUserTurn, /Your message is still in the composer/)
assert.doesNotMatch(
  disconnectedUserTurn,
  /setTimeout\(/,
  'a disconnected user message is never sent on a handshake timing guess',
)
assert.doesNotMatch(
  disconnectedUserTurn,
  /sendMessage\(/,
  'a disconnected user message is not replayed automatically',
)
assert.doesNotMatch(
  disconnectedUserTurn,
  /setInputMessage\(""\)/,
  'the composer retains the exact user message while reconnecting',
)
assert.doesNotMatch(
  disconnectedUserTurn,
  /persistence\.queueMessage/,
  'a blocked message is not persisted as though Director accepted it',
)
assert.equal(
  (hookSource.match(/\bconnect\(\);/g) || []).length,
  0,
  'the WebSocket hook never invokes its public exhaustion-reset path automatically',
)
assert.equal(
  (sessionHookSource.match(/\bconnect\(\)/g) || []).length,
  0,
  'the Builder session hook never invokes the explicit user retry path',
)
assert.equal(
  (builderSource.match(/\bconnect\(\)/g) || []).length,
  1,
  'only the explicit disconnected user submission resets same-session exhaustion',
)

console.log('Director WebSocket reconnect runtime and contract tests passed')
