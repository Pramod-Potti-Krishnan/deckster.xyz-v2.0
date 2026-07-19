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
  resolveDirectorReconnectPlan,
  shouldReconnectDirectorOnOnline,
} = policyModule.exports
const plain = value => JSON.parse(JSON.stringify(value))

assert.equal(DIRECTOR_HEARTBEAT_INTERVAL_MS, 15_000)
assert.equal(DIRECTOR_PONG_TIMEOUT_MS, 10_000)

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

assert.equal(
  shouldReconnectDirectorOnOnline({
    reconnectEnabled: true,
    manualDisconnect: false,
    connectionDesired: true,
    resumingFromOffline: false,
    socketReadyState: null,
  }),
  true,
  'a missing socket reconnects immediately when the browser comes online',
)
assert.equal(
  shouldReconnectDirectorOnOnline({
    reconnectEnabled: true,
    manualDisconnect: false,
    connectionDesired: true,
    resumingFromOffline: false,
    socketReadyState: 3,
  }),
  true,
  'a closed socket reconnects immediately when the browser comes online',
)
for (const readyState of [0, 1]) {
  assert.equal(
    shouldReconnectDirectorOnOnline({
      reconnectEnabled: true,
      manualDisconnect: false,
      connectionDesired: true,
      resumingFromOffline: false,
      socketReadyState: readyState,
    }),
    false,
    'an already connecting/open socket is not duplicated',
  )
}
assert.equal(
  shouldReconnectDirectorOnOnline({
    reconnectEnabled: true,
    manualDisconnect: true,
    connectionDesired: true,
    resumingFromOffline: true,
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
      socketReadyState: staleReadyState,
    }),
    true,
    'a socket that crossed an offline boundary is replaced regardless of its stale readyState',
  )
}

const hookSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
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
assert.match(browserConnectivityEffect, /reconnectAttemptsRef\.current = 0/)
assert.match(browserConnectivityEffect, /connectRef\.current\(\)/)
assert.match(
  browserConnectivityEffect,
  /resumingFromOffline: reconnectPausedForOfflineRef\.current/,
)
assert.ok(
  browserConnectivityEffect.indexOf('reconnectAttemptsRef.current = 0') <
    browserConnectivityEffect.indexOf('connectRef.current()'),
  'online recovery resets the retry budget before reconnecting',
)
assert.ok(
  browserConnectivityEffect.indexOf('wsRef.current = null') <
    browserConnectivityEffect.indexOf("socket.close(4001, 'Browser online reconnect')"),
  'online recovery detaches the stale socket before closing it',
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
const openHandler = hookSource.slice(
  hookSource.indexOf('ws.onopen = () => {'),
  hookSource.indexOf('ws.onmessage = (event) => {'),
)
assert.match(openHandler, /clearReconnectTimer\(\)/)
assert.ok(
  openHandler.indexOf('clearReconnectTimer()') <
    openHandler.indexOf('reconnectAttemptsRef.current = 0'),
  'a manual early recovery cancels its old timer before resetting the budget',
)

assert.match(builderSource, /reconnectOnError: true/)
assert.match(builderSource, /maxReconnectAttempts: 4/)
assert.match(builderSource, /reconnectDelay: 1500/)

console.log('Director WebSocket reconnect runtime and contract tests passed')
