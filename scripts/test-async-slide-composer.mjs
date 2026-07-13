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
  buildSlideComposeProgressStatus,
  hasLiveTrackedEphemeralMessage,
  normalizeSlideComposeSocketFrame,
  buildSlideComposeVisualOrder,
  canLiveReconcileSlideCompose,
  getComposeVisualIndexForTarget,
  resolveSlideComposeVisualIndex,
  resolveSlideComposeViewerState,
  isMatchingSlideComposeCommandResponse,
  resolveSlideComposeCountAfterReady,
  resolveSlideComposeSelectionAfterReady,
  restoreSlideViewerSelection,
  resolveSlideViewerNavigationInfo,
  shouldNavigateToResolvedComposeSlide,
  shouldUseIncomingComposePresentationUrl,
  shiftSlideComposeTargetsAfterInsert,
  canPollCompleteSlideComposeJob,
  SLIDE_COMPOSE_WATCHDOG_MS,
} = module.exports

const recoverySourcePath = path.join(__dirname, '..', 'lib', 'slide-compose-job-recovery.ts')
const recoverySource = readFileSync(recoverySourcePath, 'utf8')
const recoveryTranspiled = ts.transpileModule(recoverySource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})
const recoveryModule = { exports: {} }
vm.runInNewContext(recoveryTranspiled.outputText, {
  module: recoveryModule,
  exports: recoveryModule.exports,
  URLSearchParams,
})
const {
  buildSlideComposeJobStatusPath,
  normalizeSlideComposeJobRecoveryResult,
  resolveSlideComposeSessionId,
} = recoveryModule.exports

assert.equal(resolveSlideComposeSessionId({
  deckOwnerSessionId: 'deck-owner',
  currentSessionId: 'current-session',
  wsSessionId: 'stale-socket',
}), 'deck-owner')
assert.equal(resolveSlideComposeSessionId({
  currentSessionId: 'current-session',
  wsSessionId: 'socket-session',
}), 'current-session')
assert.equal(
  buildSlideComposeJobStatusPath({
    jobId: 'job/1',
    sessionId: 'session 1',
    presentationId: 'deck/1',
  }),
  '/api/slides/jobs/job%2F1?session_id=session+1&presentation_id=deck%2F1',
)
assert.equal(JSON.stringify(normalizeSlideComposeJobRecoveryResult({
  job_id: 'job-1',
  kind: 'compose',
  session_id: 'session-1',
  presentation_id: 'deck-1',
  target_index: 3,
  status: 'built',
  slide_index: 3,
  real_slide_id: 'slide-3',
  presentation_url: 'https://layout.test/p/deck-1',
  stage: null,
  errors: [],
})), JSON.stringify({
  job_id: 'job-1',
  kind: 'compose',
  session_id: 'session-1',
  presentation_id: 'deck-1',
  target_index: 3,
  status: 'built',
  slide_index: 3,
  real_slide_id: 'slide-3',
  presentation_url: 'https://layout.test/p/deck-1',
  stage: null,
  errors: [],
}))
assert.equal(normalizeSlideComposeJobRecoveryResult({
  job_id: 'job-1',
  kind: 'compose',
  session_id: 'session-1',
  status: 'unknown',
}), null)
assert.equal(normalizeSlideComposeJobRecoveryResult({
  job_id: 'job-1',
  session_id: 'session-1',
  status: 'built',
}), null)

assert.equal(JSON.stringify(buildSlideComposeProgressStatus({
  text: '  Researching slide content…  ',
})), JSON.stringify({
  status: 'generating',
  text: 'Researching slide content…',
  progress: null,
  estimated_time: null,
}))

assert.equal(buildSlideComposeProgressStatus({ text: '   ' }).text, 'Building slide…')

assert.equal(hasLiveTrackedEphemeralMessage(
  ['old-progress-1', 'old-progress-2'],
  new Set(['current-progress-1']),
), false)
assert.equal(hasLiveTrackedEphemeralMessage(
  ['old-progress-1', 'current-progress-1'],
  new Set(['current-progress-1']),
), true)

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

assert.equal(getComposeVisualIndexForTarget(2, {
  'job-layout-before': { target_layout_index: 2, target_visual_index: 2, status: 'building' },
}), 3)

const visualOrder = buildSlideComposeVisualOrder(
  [
    { slideNumber: 1, title: 'Slide 1' },
    { slideNumber: 2, title: 'Slide 2' },
  ],
  [{ jobId: 'job-1', targetIndex: 1, status: 'building' }],
)
assert.equal(
  JSON.stringify(visualOrder.map(item => ({
    kind: item.kind,
    visualNumber: item.visualNumber,
    label: item.kind === 'compose' ? item.job.jobId : item.slide.title,
  }))),
  JSON.stringify([
    { kind: 'slide', visualNumber: 1, label: 'Slide 1' },
    { kind: 'compose', visualNumber: 2, label: 'job-1' },
    { kind: 'slide', visualNumber: 3, label: 'Slide 2' },
  ]),
)

const appendVisualOrder = buildSlideComposeVisualOrder(
  [
    { slideNumber: 1, title: 'Slide 1' },
    { slideNumber: 2, title: 'Slide 2' },
  ],
  [{ jobId: 'job-append', targetLayoutIndex: 2, status: 'building' }],
)
assert.equal(
  JSON.stringify(appendVisualOrder.map(item => ({
    kind: item.kind,
    visualNumber: item.visualNumber,
    label: item.kind === 'compose' ? item.job.jobId : item.slide.title,
  }))),
  JSON.stringify([
    { kind: 'slide', visualNumber: 1, label: 'Slide 1' },
    { kind: 'slide', visualNumber: 2, label: 'Slide 2' },
    { kind: 'compose', visualNumber: 3, label: 'job-append' },
  ]),
)

const onePendingAfterSlideEight = buildSlideComposeVisualOrder(
  Array.from({ length: 11 }, (_value, index) => ({
    slideNumber: index + 1,
    title: `Slide ${index + 1}`,
  })),
  [{ jobId: 'job-after-8', targetLayoutIndex: 8, status: 'building' }],
)
assert.equal(
  JSON.stringify(onePendingAfterSlideEight.slice(6, 11).map(item => ({
    kind: item.kind,
    visualNumber: item.visualNumber,
    label: item.kind === 'compose' ? item.job.jobId : item.slide.title,
  }))),
  JSON.stringify([
    { kind: 'slide', visualNumber: 7, label: 'Slide 7' },
    { kind: 'slide', visualNumber: 8, label: 'Slide 8' },
    { kind: 'compose', visualNumber: 9, label: 'job-after-8' },
    { kind: 'slide', visualNumber: 10, label: 'Slide 9' },
    { kind: 'slide', visualNumber: 11, label: 'Slide 10' },
  ]),
)

const shiftedAfterFirstSameTargetReady = shiftSlideComposeTargetsAfterInsert({
  'job-auto-first': {
    target_layout_index: 1,
    target_visual_index: 1,
    status: 'building',
  },
  'job-text-second': {
    target_layout_index: 1,
    target_visual_index: 2,
    status: 'building',
  },
  'job-later': {
    target_layout_index: 5,
    target_visual_index: 6,
    status: 'building',
  },
  'job-before': {
    target_layout_index: 0,
    target_visual_index: 0,
    status: 'building',
  },
}, 'job-auto-first', 1)

assert.equal('job-auto-first' in shiftedAfterFirstSameTargetReady, false)
assert.equal(shiftedAfterFirstSameTargetReady['job-text-second'].target_layout_index, 2)
assert.equal(shiftedAfterFirstSameTargetReady['job-text-second'].target_visual_index, 2)
assert.equal(shiftedAfterFirstSameTargetReady['job-later'].target_layout_index, 6)
assert.equal(shiftedAfterFirstSameTargetReady['job-before'].target_layout_index, 0)

const orderAfterFirstSameTargetReady = buildSlideComposeVisualOrder(
  [
    { slideNumber: 1, title: 'Slide 1' },
    { slideNumber: 2, title: 'Auto result' },
    { slideNumber: 3, title: 'Original slide 2' },
  ],
  [shiftedAfterFirstSameTargetReady['job-text-second']],
)
assert.equal(
  JSON.stringify(orderAfterFirstSameTargetReady.slice(0, 4).map(item => ({
    kind: item.kind,
    visualNumber: item.visualNumber,
    label: item.kind === 'compose' ? 'pending-text' : item.slide.title,
  }))),
  JSON.stringify([
    { kind: 'slide', visualNumber: 1, label: 'Slide 1' },
    { kind: 'slide', visualNumber: 2, label: 'Auto result' },
    { kind: 'compose', visualNumber: 3, label: 'pending-text' },
    { kind: 'slide', visualNumber: 4, label: 'Original slide 2' },
  ]),
)

assert.equal(
  JSON.stringify(resolveSlideComposeVisualIndex(1, {
    slideCount: 2,
    jobs: {
      'job-middle': { target_layout_index: 1, target_visual_index: 1, status: 'building' },
    },
  })),
  JSON.stringify({ kind: 'compose', targetLayoutIndex: 1 }),
)
assert.equal(
  JSON.stringify(resolveSlideComposeVisualIndex(2, {
    slideCount: 2,
    jobs: {
      'job-middle': { target_layout_index: 1, target_visual_index: 1, status: 'building' },
    },
  })),
  JSON.stringify({ kind: 'slide', layoutIndex: 1 }),
)

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

assert.equal(canLiveReconcileSlideCompose('slide_abc123'), true)
assert.equal(canLiveReconcileSlideCompose(null), false)
assert.equal(canLiveReconcileSlideCompose(''), false)
assert.equal(canPollCompleteSlideComposeJob('slide_abc123'), true)
assert.equal(canPollCompleteSlideComposeJob(null), false)
assert.equal(canPollCompleteSlideComposeJob(''), false)

assert.equal(JSON.stringify(resolveSlideComposeViewerState({
  current_visual_index: 8,
  real_slide_count: 8,
  visual_section_count: 10,
})), JSON.stringify({
  currentVisualIndex: 8,
  realTotal: 8,
  visualTotal: 10,
}))

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

assert.equal(resolveSlideComposeSelectionAfterReady({
  currentSlideIndex: 2,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 2,
}), 2)
assert.equal(resolveSlideComposeSelectionAfterReady({
  currentSlideIndex: 2,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 4,
}), 4)
assert.equal(resolveSlideComposeSelectionAfterReady({
  currentSlideIndex: 7,
  jobTargetVisualIndex: 2,
  resolvedVisualIndex: 2,
}), 7)

assert.equal(JSON.stringify(resolveSlideViewerNavigationInfo({
  success: true,
  data: { index: 3, total: 9 },
})), JSON.stringify({
  currentVisualIndex: 3,
  totalSlides: 9,
}))
assert.equal(JSON.stringify(resolveSlideViewerNavigationInfo({
  current_visual_index: 4,
  total_visual_sections: 10,
})), JSON.stringify({
  currentVisualIndex: 4,
  totalSlides: 10,
}))
assert.equal(resolveSlideViewerNavigationInfo({
  success: true,
  data: { index: 0, total: 0 },
}), null)
assert.equal(resolveSlideViewerNavigationInfo({
  success: true,
  data: { index: 9, total: 9 },
}), null)
assert.equal(resolveSlideViewerNavigationInfo({
  success: false,
  data: { index: 3, total: 9 },
}), null)

const navigationStates = [
  null,
  { currentVisualIndex: 0, totalSlides: 9 },
  { currentVisualIndex: 3, totalSlides: 9 },
  { currentVisualIndex: 0, totalSlides: 9 },
  { currentVisualIndex: 0, totalSlides: 9 },
  { currentVisualIndex: 3, totalSlides: 9 },
  { currentVisualIndex: 3, totalSlides: 9 },
]
const restoreRetries = []
let navigationCalls = 0
const restoredSelection = await restoreSlideViewerSelection({
  targetVisualIndex: 3,
  readNavigationInfo: async () => navigationStates.shift() ?? null,
  navigate: async visualIndex => {
    assert.equal(visualIndex, 3)
    navigationCalls += 1
  },
  wait: async () => {},
  onRetry: retry => restoreRetries.push(retry.phase),
})
assert.equal(restoredSelection.attempts, 3)
assert.equal(navigationCalls, 2)
assert.equal(JSON.stringify(restoreRetries), JSON.stringify([
  'waiting',
  'stability_check',
]))

await assert.rejects(
  restoreSlideViewerSelection({
    targetVisualIndex: 3,
    readNavigationInfo: async () => ({ currentVisualIndex: 0, totalSlides: 2 }),
    navigate: async () => assert.fail('must not navigate before the target slide exists'),
    wait: async () => {},
    maxAttempts: 2,
  }),
  /Could not restore slide 4/,
)

console.log('async slide composer unit checks passed')
