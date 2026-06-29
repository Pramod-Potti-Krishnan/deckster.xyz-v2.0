import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, '..', 'lib', 'slide-compose-async.ts')
const source = readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const module = { exports: {} }
vm.runInNewContext(transpiled.outputText, {
  module,
  exports: module.exports,
})

const {
  withAsyncSlideComposeFields,
  normalizeSlideComposeSocketFrame,
  getComposeVisualIndexForTarget,
  isMatchingSlideComposeCommandResponse,
  resolveSlideComposeCountAfterReady,
  shouldNavigateToResolvedComposeSlide,
  shouldUseIncomingComposePresentationUrl,
  SLIDE_COMPOSE_WATCHDOG_MS,
} = module.exports

const request = withAsyncSlideComposeFields(
  {
    session_id: 'session-1',
    presentation_id: 'deck-1',
    assume_on_missing: false,
  },
  'job-1',
)

assert.equal(request.job_id, 'job-1')
assert.equal(request.async, true)
assert.equal(request.assume_on_missing, true)
assert.equal(request.session_id, 'session-1')

const topLevelReady = normalizeSlideComposeSocketFrame({
  type: 'slide_ready',
  message_id: 'msg-1',
  session_id: 'session-1',
  timestamp: '2026-06-28T00:00:00Z',
  job_id: 'job-1',
  status: 'built',
  slide_index: 3,
  presentation_id: 'deck-1',
})

assert.equal(JSON.stringify(topLevelReady.payload), JSON.stringify({
  job_id: 'job-1',
  status: 'built',
  slide_index: 3,
  presentation_id: 'deck-1',
}))

const payloadFailed = {
  type: 'slide_failed',
  message_id: 'msg-2',
  session_id: 'session-1',
  timestamp: '2026-06-28T00:00:01Z',
  payload: {
    job_id: 'job-2',
    stage: 'insert',
    errors: ['failed'],
  },
}

assert.equal(normalizeSlideComposeSocketFrame(payloadFailed), payloadFailed)

assert.equal(getComposeVisualIndexForTarget(3, {
  'job-before': { target_visual_index: 2, status: 'building' },
  'job-after': { target_visual_index: 7, status: 'building' },
}), 4)

assert.equal(getComposeVisualIndexForTarget(3, {
  'failed-before': { target_visual_index: 2, status: 'error' },
  'building-at-target': { target_visual_index: 3, status: 'building' },
}), 4)

assert.equal(isMatchingSlideComposeCommandResponse({
  action: 'composeSlideReconcile',
  requestId: 'request-1',
  job_id: 'job-1',
  success: true,
}, {
  action: 'composeSlideReconcile',
  requestId: 'request-1',
  expectedJobId: 'job-1',
}), true)

assert.equal(isMatchingSlideComposeCommandResponse({
  action: 'composeSlideReconcile',
  requestId: 'request-2',
  job_id: 'job-1',
  success: true,
}, {
  action: 'composeSlideReconcile',
  requestId: 'request-1',
  expectedJobId: 'job-1',
}), false)

assert.equal(isMatchingSlideComposeCommandResponse({
  action: 'composeSlideReconcile',
  requestId: 'request-1',
  job_id: 'job-2',
  success: true,
}, {
  action: 'composeSlideReconcile',
  requestId: 'request-1',
  expectedJobId: 'job-1',
}), false)

assert.equal(
  shouldUseIncomingComposePresentationUrl(
    'https://layout.test/p/deck-1?sc_refresh=123',
    'https://layout.test/p/deck-1?sc_refresh=456',
  ),
  false,
)
assert.equal(
  shouldUseIncomingComposePresentationUrl(
    'https://layout.test/p/deck-1',
    'https://layout.test/p/deck-2',
  ),
  true,
)

assert.equal(SLIDE_COMPOSE_WATCHDOG_MS, 480_000)
assert.ok(SLIDE_COMPOSE_WATCHDOG_MS > 420_000)

const firstReadyCount = resolveSlideComposeCountAfterReady({
  currentSlideCount: 5,
  existingDeck: true,
  resolvedVisualIndex: 2,
  viewerSlideCount: 6,
})
assert.equal(firstReadyCount, 6)
assert.equal(resolveSlideComposeCountAfterReady({
  currentSlideCount: firstReadyCount,
  existingDeck: true,
  resolvedVisualIndex: 3,
  viewerSlideCount: 7,
}), 7)

assert.equal(shouldNavigateToResolvedComposeSlide({
  currentSlideIndex: 8,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 2,
}), false)
assert.equal(shouldNavigateToResolvedComposeSlide({
  currentSlideIndex: 2,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 4,
}), true)
assert.equal(shouldNavigateToResolvedComposeSlide({
  currentSlideIndex: 4,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 4,
}), true)

console.log('async slide composer unit checks passed')
