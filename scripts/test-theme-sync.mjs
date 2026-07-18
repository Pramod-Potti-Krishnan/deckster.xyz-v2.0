import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const path = new URL('../lib/theme-sync.ts', import.meta.url)
const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require })

const {
  IDLE_THEME_SYNC,
  applyThemeSyncResponse,
  isThemeAppliedToPresentation,
  isThemeSyncTerminal,
  syncingTheme,
  waitForAuthoritativeTheme,
} = mod.exports
const current = syncingTheme('new-request', 'deck-2')
const acknowledged = applyThemeSyncResponse(current, {
  request_id: 'new-request', status: 'syncing', presentation_id: 'deck-2',
})
assert.equal(acknowledged.status, 'syncing')
assert.equal(isThemeAppliedToPresentation(acknowledged, 'deck-2'), false)
assert.equal(isThemeSyncTerminal('syncing'), false)
assert.equal(isThemeSyncTerminal('applied'), true)
assert.equal(isThemeSyncTerminal('failed'), true)
const stale = applyThemeSyncResponse(current, {
  request_id: 'old-request', status: 'applied', presentation_id: 'deck-1',
})
assert.equal(stale, current)

const applied = applyThemeSyncResponse(current, {
  request_id: 'new-request', status: 'applied', presentation_id: 'deck-2',
})
assert.equal(applied.status, 'applied')
assert.equal(isThemeAppliedToPresentation(applied, 'deck-2'), true)
assert.equal(isThemeAppliedToPresentation(applied, 'deck-1'), false)

const failed = applyThemeSyncResponse(current, {
  request_id: 'new-request', status: 'failed', error: 'Theme Builder unavailable',
})
assert.equal(failed.status, 'failed')
assert.equal(failed.error, 'Theme Builder unavailable')
assert.equal(
  applyThemeSyncResponse(applied, {
    request_id: 'new-request', status: 'syncing', presentation_id: 'deck-2',
  }),
  applied,
  'a late syncing frame must not regress an applied request',
)
assert.equal(
  applyThemeSyncResponse(failed, {
    request_id: 'new-request', status: 'syncing', presentation_id: 'deck-2',
  }),
  failed,
  'a late syncing frame must not regress a failed request',
)

const immediate = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => applied,
  isConnected: () => true,
  requestSync: () => {
    throw new Error('an already-applied theme must not start another request')
  },
})
assert.equal(immediate.ready, true)
assert.equal(immediate.sync.requestId, 'new-request')

let delayedState = syncingTheme('delayed-request', 'deck-2')
let delayedPolls = 0
const delayed = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => delayedState,
  isConnected: () => true,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  delay: async () => {
    delayedPolls += 1
    delayedState = applyThemeSyncResponse(delayedState, {
      request_id: 'delayed-request',
      status: 'applied',
      presentation_id: 'deck-2',
    })
  },
})
assert.equal(delayed.ready, true)
assert.equal(delayedPolls, 1)

let staleState = syncingTheme('stale-request', 'deck-1')
let staleRequestCount = 0
const recoveredFromStalePresentation = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => staleState,
  isConnected: () => true,
  requestSync: presentationId => {
    staleRequestCount += 1
    staleState = syncingTheme('fresh-request', presentationId)
    return { ok: true, requestId: 'fresh-request' }
  },
  delay: async () => {
    staleState = applyThemeSyncResponse(staleState, {
      request_id: 'fresh-request',
      status: 'applied',
      presentation_id: 'deck-2',
    })
  },
})
assert.equal(recoveredFromStalePresentation.ready, true)
assert.equal(staleRequestCount, 1)

let failedState = syncingTheme('failed-request', 'deck-2')
const failedReadiness = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => failedState,
  isConnected: () => true,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  delay: async () => {
    failedState = applyThemeSyncResponse(failedState, {
      request_id: 'failed-request',
      status: 'failed',
      presentation_id: 'deck-2',
      error: 'Theme Builder unavailable',
    })
  },
})
assert.equal(failedReadiness.ready, false)
assert.equal(failedReadiness.code, 'failed')
assert.equal(failedReadiness.error, 'Theme Builder unavailable')

let changedPresentationState = syncingTheme('changed-request', 'deck-2')
const changedPresentation = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => changedPresentationState,
  isConnected: () => true,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  delay: async () => {
    changedPresentationState = {
      status: 'syncing',
      requestId: 'changed-request',
      presentationId: 'deck-3',
      error: null,
    }
  },
})
assert.equal(changedPresentation.ready, false)
assert.equal(changedPresentation.code, 'presentation_changed')

let supersededState = syncingTheme('original-request', 'deck-2')
const superseded = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => supersededState,
  isConnected: () => true,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  delay: async () => {
    supersededState = syncingTheme('replacement-request', 'deck-2')
  },
})
assert.equal(superseded.ready, false)
assert.equal(superseded.code, 'request_superseded')

let connected = true
let disconnectState = syncingTheme('disconnect-request', 'deck-2')
const disconnected = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => disconnectState,
  isConnected: () => connected,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  delay: async () => {
    connected = false
  },
})
assert.equal(disconnected.ready, false)
assert.equal(disconnected.code, 'disconnected')
assert.match(disconnected.error, /Reconnect/)

let timeoutClock = 0
const timedOut = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => syncingTheme('timeout-request', 'deck-2'),
  isConnected: () => true,
  requestSync: () => {
    throw new Error('a matching in-flight request must be reused')
  },
  timeoutMs: 10,
  pollIntervalMs: 5,
  now: () => timeoutClock,
  delay: async milliseconds => {
    timeoutClock += milliseconds
  },
})
assert.equal(timedOut.ready, false)
assert.equal(timedOut.code, 'timeout')
assert.match(timedOut.error, /timed out/)

let disconnectedRequestCount = 0
const initiallyDisconnected = await waitForAuthoritativeTheme({
  presentationId: 'deck-2',
  getSyncState: () => IDLE_THEME_SYNC,
  isConnected: () => false,
  requestSync: () => {
    disconnectedRequestCount += 1
    return { ok: false, code: 'disconnected', error: 'not connected' }
  },
})
assert.equal(initiallyDisconnected.ready, false)
assert.equal(initiallyDisconnected.code, 'disconnected')
assert.equal(disconnectedRequestCount, 0)

const hookSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.ok(
  hookSource.indexOf('activeGenerationKeysRef.current.add(generationKey)') <
    hookSource.indexOf('await ensureThemeReady(requestedThemePresentationId)'),
  'theme readiness must wait behind the existing per-element duplicate-generation lock',
)

const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
const approvedHandler = builderSource.slice(
  builderSource.indexOf('const handleApprovedTextLabsGenerate'),
  builderSource.indexOf('const handleRefineElementRequested'),
)
assert.doesNotMatch(
  approvedHandler,
  /isThemeAppliedToPresentation|Apply the selected deck theme/,
  'the page wrapper must not reject idle/pending theme sync before the hook acquires its lock',
)

console.log('theme sync tests passed')
