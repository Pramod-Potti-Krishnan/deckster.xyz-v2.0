import assert from 'node:assert/strict'
import fs from 'node:fs'

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
  'a changed Director session ID must not be consumed during render before the reconnect effect can see it',
)

const sessionTransitionEffect = hookSource.slice(
  hookSource.indexOf('// Reconnect when the Builder adopts a persisted/new database session ID.'),
  hookSource.indexOf('// Disconnect from WebSocket'),
)
assert.match(sessionTransitionEffect, /sessionIdRef\.current = nextSessionId/)
assert.match(sessionTransitionEffect, /wsRef\.current = null/)
assert.match(sessionTransitionEffect, /if \(previousSocket\) previousSocket\.close\(\)/)
assert.ok(
  sessionTransitionEffect.indexOf('wsRef.current = null') <
    sessionTransitionEffect.indexOf('previousSocket.close()'),
  'the old socket is detached before close so its event cannot reconnect the wrong session',
)
assert.match(sessionTransitionEffect, /pendingSessionReconnectRef\.current = shouldReconnect/)
assert.match(sessionTransitionEffect, /state\.sessionId !== pendingSessionId/)
assert.ok(
  sessionTransitionEffect.indexOf('pendingSessionReconnectRef.current = shouldReconnect') <
    sessionTransitionEffect.indexOf('connect();'),
  'the replacement connection waits for the render that rekeys the session cache',
)

const closeHandler = hookSource.slice(
  hookSource.indexOf('ws.onclose = (event) => {'),
  hookSource.indexOf('} catch (error) {', hookSource.indexOf('ws.onclose = (event) => {')),
)
assert.match(closeHandler, /options\.reconnectOnError/)
assert.match(closeHandler, /reconnectAttemptsRef\.current < maxReconnectAttempts/)
assert.doesNotMatch(
  closeHandler,
  /hasConnectedRef\.current &&/,
  'a transient first-connect failure receives the same bounded recovery as an established connection',
)

assert.match(builderSource, /reconnectOnError: true/)
assert.match(builderSource, /maxReconnectAttempts: 4/)
assert.match(builderSource, /reconnectDelay: 1500/)

console.log('Director WebSocket reconnect contract tests passed')
