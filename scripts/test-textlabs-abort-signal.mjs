import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/textlabs-client.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})

let fetchImplementation
const fetch = (...args) => fetchImplementation(...args)
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  process: { env: {} },
  fetch,
  FormData,
  Blob,
  AbortController,
  AbortSignal,
  DOMException,
  require: id => {
    if (id === '@/types/textlabs') {
      return {
        INSERTION_METHOD_MAP: { ICON_LABEL: 'insertElement' },
        TEXT_LABS_ELEMENT_DEFAULTS: {
          ICON_LABEL: { width: 6, height: 4, zIndex: 100 },
          TEXT_BOX: { width: 10, height: 6, zIndex: 100 },
        },
      }
    }
    if (id === '@/lib/element-semantic-type') {
      return { semanticTypeForInsertion: value => value }
    }
    if (id === '@/lib/textlabs-theme-metadata') {
      return {
        resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }),
      }
    }
    if (id === '@/lib/element-provenance') {
      return {
        parseThemeVariantSource: () => null,
        responseStyleOwner: () => null,
      }
    }
    if (id === '@/lib/element-research-policy') {
      return {
        isNonResearchVisualElement: componentType => ['IMAGE', 'ICON_LABEL', 'SHAPE'].includes(componentType),
      }
    }
    throw new Error(`Unexpected dependency: ${id}`)
  },
})

const {
  buildInsertionParams,
  formatBackendError,
  generateInfographic,
  isRetryableTextLabsRequestError,
  responseRetryStrategy,
  sendMessage,
  TextLabsRequestError,
} = mod.exports

const retrySource = fs.readFileSync(
  new URL('../lib/element-generation-retry.ts', import.meta.url),
  'utf8',
)
const retryCompiled = ts.transpileModule(retrySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const retryMod = { exports: {} }
vm.runInNewContext(retryCompiled.outputText, {
  module: retryMod,
  exports: retryMod.exports,
})
const {
  DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES,
  diagramGenerationRequestFingerprint,
  diagramRetryCandidateForPreDispatch,
  executeDiagramRequestWithFreshAttemptHandoff,
  resolveDiagramGenerationAttemptId,
} = retryMod.exports

assert.equal(
  formatBackendError({ detail: [{ loc: ['body', 'chart_config', 'data'], msg: 'Explicit chart data is invalid' }] }, 'API error: 422'),
  'chart_config.data: Explicit chart data is invalid',
)
assert.equal(
  responseRetryStrategy({ detail: { retry_strategy: 'start_fresh_attempt' } }),
  'start_fresh_attempt',
)
assert.equal(
  responseRetryStrategy({ detail: { retryStrategy: 'do_not_retry' } }),
  'do_not_retry',
  'camelCase proxy payloads remain compatible',
)
assert.equal(responseRetryStrategy({ retry_strategy: 'unexpected' }), null)
assert.equal(
  responseRetryStrategy({
    response: {
      error_detail: {
        retry_strategy: 'start_fresh_attempt',
      },
    },
  }),
  'start_fresh_attempt',
  'known cached/proxy envelope layers preserve the retry contract',
)

const iconInsertion = buildInsertionParams('ICON_LABEL', { html: '<div>Priority</div>' })
assert.equal(iconInsertion.method, 'insertElement')
assert.equal(iconInsertion.params.componentType, 'ICON_LABEL')
assert.equal(iconInsertion.params.content, '<div>Priority</div>')

let capturedSignal
let capturedHeaders
let capturedBody
fetchImplementation = async (_url, init) => {
  capturedSignal = init.signal
  capturedHeaders = init.headers
  capturedBody = JSON.parse(init.body)
  return { ok: true, json: async () => ({ elements: [] }) }
}
const messageController = new AbortController()
await sendMessage(
  'session-1',
  'hello',
  {
    componentType: 'CODE_DISPLAY',
    generationAttemptId: 'attempt-123',
    deadlineMs: 140_000,
    languageSelection: { mode: 'auto' },
  },
  messageController.signal,
)
assert.equal(capturedSignal, messageController.signal, 'chat fetch receives the generation signal')
assert.equal(capturedHeaders['X-Generation-Attempt-ID'], 'attempt-123')
assert.equal(capturedBody.generation_attempt_id, 'attempt-123')
assert.equal(capturedBody.deadline_ms, 140_000)
assert.equal(capturedBody.language_selection.mode, 'auto')

fetchImplementation = async () => ({
  ok: false,
  status: 503,
  headers: { get: name => name.toLowerCase() === 'x-request-id' ? 'request-503' : null },
  json: async () => ({ detail: 'Service warming up' }),
})
await assert.rejects(
  sendMessage('session-1', 'retry me', { componentType: 'TEXT_BOX' }),
  error => {
    assert.equal(error.name, 'TextLabsRequestError')
    assert.equal(error.status, 503)
    assert.equal(error.requestId, 'request-503')
    assert.equal(error.retryStrategy, 'resume_same_attempt')
    assert.equal(
      isRetryableTextLabsRequestError(error),
      false,
      'application failures must not trigger a second paid request',
    )
    return true
  },
)

fetchImplementation = async () => ({
  ok: false,
  status: 408,
  headers: { get: () => null },
  json: async () => ({ detail: 'Request timeout' }),
})
await assert.rejects(
  sendMessage(
    'session-1',
    'reconcile a timed-out diagram',
    {
      componentType: 'CLOUD_ARCHITECTURE',
      generationAttemptId: 'attempt-408',
    },
  ),
  error => {
    assert.equal(error.status, 408)
    assert.equal(error.ambiguousCompletion, true)
    assert.equal(error.retryStrategy, 'resume_same_attempt')
    assert.equal(error.requestId, 'attempt-408')
    return true
  },
)

const terminalFreshEnvelope = attemptId => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({
    success: false,
    error: 'Cloud planner output was invalid after one repair.',
    error_code: 'CLOUD_PLANNER_OUTPUT_INVALID',
    retryable: false,
    retry_strategy: 'start_fresh_attempt',
    generation_attempt_id: attemptId,
    request_id: `waiter:${attemptId}`,
    downstream_request_id: `generator:${attemptId}`,
  }),
})
const successfulDiagramEnvelope = attemptId => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({
    success: true,
    elements: [{ id: `diagram:${attemptId}`, html: '<svg></svg>' }],
    generation_attempt_id: attemptId,
  }),
})

const sequentialAttemptIds = []
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  sequentialAttemptIds.push(attemptId)
  return attemptId === 'attempt:G1'
    ? terminalFreshEnvelope(attemptId)
    : successfulDiagramEnvelope(attemptId)
}
const uiSubmitIntent = 'retry'
const uiRequestOptions = {
  componentType: 'CLOUD_ARCHITECTURE',
  generationAttemptId: 'attempt:G1',
  deadlineMs: 140_000,
  generationConfig: {
    diagram_type: 'CLOUD_ARCHITECTURE',
    settings: { provider: 'aws' },
  },
}
const uiRetryFingerprint = diagramGenerationRequestFingerprint({
  sessionId: 'session-1',
  message: 'recover the cached cloud generation',
  options: uiRequestOptions,
})
const uiRetryCandidate = diagramRetryCandidateForPreDispatch(
  uiSubmitIntent,
  {
    attemptId: 'attempt:G1',
    requestFingerprint: uiRetryFingerprint,
  },
)
const preparedUiFingerprint = diagramGenerationRequestFingerprint({
  sessionId: 'session-1',
  message: 'recover the cached cloud generation',
  options: {
    ...uiRequestOptions,
    generationAttemptId: 'attempt:new-preflight-id',
    deadlineMs: 127_000,
  },
})
const resolvedUiAttempt = resolveDiagramGenerationAttemptId({
  submitIntent: uiSubmitIntent,
  freshAttemptId: 'attempt:new-preflight-id',
  requestFingerprint: preparedUiFingerprint,
  retryCandidate: uiRetryCandidate,
})
assert.equal(resolvedUiAttempt.attemptId, 'attempt:G1')
assert.equal(
  resolvedUiAttempt.reused,
  true,
  'the UI Retry intent and exact prepared fingerprint reconcile G1 before handoff',
)
const sequentialHandoffIds = []
const sequentialDecisions = []
const sequentialHandoff = await executeDiagramRequestWithFreshAttemptHandoff({
  submitIntent: uiSubmitIntent,
  reusedAttempt: resolvedUiAttempt.reused,
  initialAttemptId: resolvedUiAttempt.attemptId,
  freshAttemptId: 'attempt:G2',
  registry: new Map(),
  onFreshAttempt: attemptId => sequentialHandoffIds.push(attemptId),
  onDecision: decision => sequentialDecisions.push(decision),
  resolveFreshBackendDeadlineMs: () => 90_000,
  send: attemptId => sendMessage(
    'session-1',
    'recover the cached cloud generation',
    {
      componentType: 'CLOUD_ARCHITECTURE',
      generationAttemptId: attemptId,
    },
  ),
})
assert.deepEqual(
  sequentialAttemptIds,
  ['attempt:G1', 'attempt:G2'],
  'an HTTP-200 success:false terminal G1 envelope launches one fresh G2',
)
assert.deepEqual(sequentialHandoffIds, ['attempt:G2'])
assert.equal(sequentialHandoff.attemptId, 'attempt:G2')
assert.equal(sequentialHandoff.freshAttemptStarted, true)
assert.equal(sequentialHandoff.response.success, true)
assert.deepEqual(
  sequentialDecisions.map(decision => ({
    policyEligible: decision.policyEligible,
    existingHandoff: decision.existingHandoff,
    backendBudgetMs: decision.backendBudgetMs,
    freshAttemptStarted: decision.freshAttemptStarted,
  })),
  [{
    policyEligible: true,
    existingHandoff: false,
    backendBudgetMs: 90_000,
    freshAttemptStarted: true,
  }],
  'the production decision chain exposes sanitized trigger telemetry',
)

const concurrentAttemptIds = []
let releaseConcurrentFresh
const concurrentFreshGate = new Promise(resolve => {
  releaseConcurrentFresh = resolve
})
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  concurrentAttemptIds.push(attemptId)
  if (attemptId === 'attempt:G1-concurrent') {
    return terminalFreshEnvelope(attemptId)
  }
  await concurrentFreshGate
  return successfulDiagramEnvelope(attemptId)
}
const concurrentRegistry = new Map()
const concurrentInput = freshAttemptId => ({
  submitIntent: 'retry',
  reusedAttempt: true,
  initialAttemptId: 'attempt:G1-concurrent',
  freshAttemptId,
  registry: concurrentRegistry,
  resolveFreshBackendDeadlineMs: () => 90_000,
  send: attemptId => sendMessage(
    'session-1',
    'join the recovered cloud generation',
    {
      componentType: 'CLOUD_ARCHITECTURE',
      generationAttemptId: attemptId,
    },
  ),
})
const concurrentFirst = executeDiagramRequestWithFreshAttemptHandoff(
  concurrentInput('attempt:G2-owner'),
)
const concurrentSecond = executeDiagramRequestWithFreshAttemptHandoff(
  concurrentInput('attempt:G2-duplicate'),
)
await new Promise(resolve => setImmediate(resolve))
assert.equal(
  concurrentAttemptIds.filter(id => id === 'attempt:G2-owner').length,
  1,
  'concurrent G1 waiters start one G2 owner request',
)
assert.equal(
  concurrentAttemptIds.filter(id => id === 'attempt:G2-duplicate').length,
  0,
  'the second G1 waiter joins G2 instead of spending another generation',
)
releaseConcurrentFresh()
const concurrentResults = await Promise.all([concurrentFirst, concurrentSecond])
assert.deepEqual(
  concurrentResults.map(result => result.attemptId),
  ['attempt:G2-owner', 'attempt:G2-owner'],
)
assert.equal(
  concurrentRegistry.size,
  1,
  'settled handoffs remain briefly joinable for delayed G1 responses',
)

const delayedAttemptIds = []
let delayedG1Count = 0
let releaseDelayedG1
const delayedG1Gate = new Promise(resolve => {
  releaseDelayedG1 = resolve
})
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  delayedAttemptIds.push(attemptId)
  if (attemptId === 'attempt:G1-delayed') {
    delayedG1Count += 1
    if (delayedG1Count === 2) await delayedG1Gate
    return terminalFreshEnvelope(attemptId)
  }
  return successfulDiagramEnvelope(attemptId)
}
const delayedRegistry = new Map()
const delayedInput = freshAttemptId => ({
  submitIntent: 'retry',
  reusedAttempt: true,
  initialAttemptId: 'attempt:G1-delayed',
  freshAttemptId,
  registry: delayedRegistry,
  resolveFreshBackendDeadlineMs: () => 90_000,
  send: attemptId => sendMessage(
    'session-1',
    'join G2 even after it already completed',
    {
      componentType: 'CLOUD_ARCHITECTURE',
      generationAttemptId: attemptId,
    },
  ),
})
const completedBeforeDelayedG1 = executeDiagramRequestWithFreshAttemptHandoff(
  delayedInput('attempt:G2-delayed-owner'),
)
const delayedG1Waiter = executeDiagramRequestWithFreshAttemptHandoff(
  delayedInput('attempt:G2-must-not-start'),
)
const completedG2Result = await completedBeforeDelayedG1
assert.equal(completedG2Result.attemptId, 'attempt:G2-delayed-owner')
assert.equal(completedG2Result.freshAttemptStarted, true)
assert.equal(completedG2Result.freshAttemptJoined, false)
assert.equal(
  delayedAttemptIds.filter(id => id === 'attempt:G2-delayed-owner').length,
  1,
)
releaseDelayedG1()
const delayedG1Result = await delayedG1Waiter
assert.equal(delayedG1Result.attemptId, 'attempt:G2-delayed-owner')
assert.equal(delayedG1Result.freshAttemptStarted, false)
assert.equal(delayedG1Result.freshAttemptJoined, true)
assert.equal(
  delayedAttemptIds.filter(id => id.startsWith('attempt:G2')).length,
  1,
  'a delayed G1 terminal response joins the retained completed G2 exactly once',
)

const insufficientBudgetAttemptIds = []
const insufficientBudgetDecisions = []
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  insufficientBudgetAttemptIds.push(attemptId)
  return terminalFreshEnvelope(attemptId)
}
await assert.rejects(
  executeDiagramRequestWithFreshAttemptHandoff({
    submitIntent: 'retry',
    reusedAttempt: true,
    initialAttemptId: 'attempt:G1-no-budget',
    freshAttemptId: 'attempt:G2-no-budget',
    registry: new Map(),
    resolveFreshBackendDeadlineMs: () => 59_999,
    onDecision: decision => insufficientBudgetDecisions.push(decision),
    send: attemptId => sendMessage(
      'session-1',
      'preserve the original G1 terminal failure',
      {
        componentType: 'CLOUD_ARCHITECTURE',
        generationAttemptId: attemptId,
      },
    ),
  }),
  error => error?.retryStrategy === 'start_fresh_attempt',
)
assert.deepEqual(
  insufficientBudgetAttemptIds,
  ['attempt:G1-no-budget'],
  'less than the meaningful fresh budget never dispatches or mutates into G2',
)
assert.deepEqual(
  insufficientBudgetDecisions.map(decision => ({
    retryStrategy: decision.retryStrategy,
    policyEligible: decision.policyEligible,
    backendBudgetMs: decision.backendBudgetMs,
    freshAttemptStarted: decision.freshAttemptStarted,
  })),
  [{
    retryStrategy: 'start_fresh_attempt',
    policyEligible: true,
    backendBudgetMs: 59_999,
    freshAttemptStarted: false,
  }],
  'budget suppression preserves the original terminal strategy in sanitized telemetry',
)

const fullRegistryAttemptIds = []
const fullRegistryDecisions = []
const neverSettles = new Promise(() => {})
const fullInFlightRegistry = new Map()
for (
  let index = 0;
  index < DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES;
  index += 1
) {
  fullInFlightRegistry.set(`attempt:occupied-G1-${index}`, {
    attemptId: `attempt:occupied-G2-${index}`,
    promise: neverSettles,
    createdAtMs: index,
    settledAtMs: null,
  })
}
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  fullRegistryAttemptIds.push(attemptId)
  return terminalFreshEnvelope(attemptId)
}
await assert.rejects(
  executeDiagramRequestWithFreshAttemptHandoff({
    submitIntent: 'retry',
    reusedAttempt: true,
    initialAttemptId: 'attempt:G1-registry-full',
    freshAttemptId: 'attempt:G2-must-not-run-unregistered',
    registry: fullInFlightRegistry,
    resolveFreshBackendDeadlineMs: () => 90_000,
    onDecision: decision => fullRegistryDecisions.push(decision),
    send: attemptId => sendMessage(
      'session-1',
      'do not evict or duplicate an in-flight handoff',
      {
        componentType: 'CLOUD_ARCHITECTURE',
        generationAttemptId: attemptId,
      },
    ),
  }),
  error => error?.retryStrategy === 'start_fresh_attempt',
)
assert.deepEqual(
  fullRegistryAttemptIds,
  ['attempt:G1-registry-full'],
  'a full in-flight registry suppresses G2 instead of starting it unregistered',
)
assert.equal(
  fullInFlightRegistry.size,
  DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES,
  'capacity handling never evicts an in-flight G2 handoff',
)
assert.deepEqual(
  fullRegistryDecisions.map(decision => ({
    registryCapacityAvailable: decision.registryCapacityAvailable,
    freshAttemptStarted: decision.freshAttemptStarted,
    backendBudgetMs: decision.backendBudgetMs,
  })),
  [{
    registryCapacityAvailable: false,
    freshAttemptStarted: false,
    backendBudgetMs: 90_000,
  }],
)

const boundedAttemptIds = []
fetchImplementation = async (_url, init) => {
  const attemptId = JSON.parse(init.body).generation_attempt_id
  boundedAttemptIds.push(attemptId)
  return terminalFreshEnvelope(attemptId)
}
await assert.rejects(
  executeDiagramRequestWithFreshAttemptHandoff({
    submitIntent: 'retry',
    reusedAttempt: true,
    initialAttemptId: 'attempt:G1-bounded',
    freshAttemptId: 'attempt:G2-bounded',
    registry: new Map(),
    resolveFreshBackendDeadlineMs: () => 90_000,
    send: attemptId => sendMessage(
      'session-1',
      'do not loop after the fresh attempt fails',
      {
        componentType: 'CLOUD_ARCHITECTURE',
        generationAttemptId: attemptId,
      },
    ),
  }),
  error => error?.retryStrategy === 'start_fresh_attempt',
)
assert.deepEqual(
  boundedAttemptIds,
  ['attempt:G1-bounded', 'attempt:G2-bounded'],
  'a terminal G2 failure is surfaced without G3',
)

fetchImplementation = async () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({
    success: false,
    error: 'The diagram service may have completed before its response was lost.',
    error_code: 'DIAGRAM_SERVICE_HTTP_503',
    retryable: true,
    ambiguous_completion: true,
    generation_attempt_id: 'attempt-ambiguous',
  }),
})
await assert.rejects(
  sendMessage(
    'session-1',
    'retry the same diagram attempt',
    {
      componentType: 'CLOUD_ARCHITECTURE',
      generationAttemptId: 'attempt-ambiguous',
    },
  ),
  error => {
    assert.equal(error.name, 'TextLabsRequestError')
    assert.equal(error.kind, 'application')
    assert.equal(error.retryable, true)
    assert.equal(error.ambiguousCompletion, true)
    assert.equal(error.retryStrategy, 'resume_same_attempt')
    assert.equal(error.requestId, 'attempt-ambiguous')
    return true
  },
)

fetchImplementation = async () => ({
  ok: false,
  status: 422,
  headers: { get: () => null },
  json: async () => ({
    request_id: 'textlabs-request',
    detail: {
      message: 'Planner output was invalid after one repair.',
      retryable: false,
      retry_strategy: 'start_fresh_attempt',
      downstream_request_id: 'diagram-request',
    },
  }),
})
await assert.rejects(
  sendMessage(
    'session-1',
    'recover with a fresh model run',
    {
      componentType: 'CUSTOM',
      generationAttemptId: 'recovered-attempt',
    },
  ),
  error => {
    assert.equal(error.kind, 'http')
    assert.equal(error.requestId, 'textlabs-request')
    assert.equal(error.downstreamRequestId, 'diagram-request')
    assert.equal(error.retryable, false)
    assert.equal(error.retryStrategy, 'start_fresh_attempt')
    return true
  },
)

fetchImplementation = async () => ({
  ok: true,
  status: 200,
  headers: {
    get: name => name.toLowerCase() === 'x-request-id'
      ? 'request-unreadable'
      : null,
  },
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input')
  },
})
await assert.rejects(
  sendMessage(
    'session-1',
    'reconcile an unreadable success envelope',
    {
      componentType: 'CUSTOM',
      generationAttemptId: 'attempt-unreadable',
    },
  ),
  error => {
    assert.equal(error.kind, 'application')
    assert.equal(error.status, 200)
    assert.equal(error.retryable, true)
    assert.equal(error.ambiguousCompletion, true)
    assert.equal(error.retryStrategy, 'resume_same_attempt')
    assert.equal(error.requestId, 'request-unreadable')
    return true
  },
)

assert.equal(
  isRetryableTextLabsRequestError(new TextLabsRequestError(
    'transport failed before a response',
    { kind: 'transport', retryable: true },
  )),
  true,
)
assert.equal(
  new TextLabsRequestError(
    'legacy transport failure',
    { kind: 'transport', retryable: true },
  ).retryStrategy,
  'resume_same_attempt',
)

fetchImplementation = async (_url, init) => {
  capturedSignal = init.signal
  return { ok: true, json: async () => ({ elements: [] }) }
}
const infographicController = new AbortController()
await generateInfographic(
  'session-1',
  'make an infographic',
  new Blob(['image'], { type: 'image/png' }),
  {},
  {},
  infographicController.signal,
)
assert.equal(capturedSignal, infographicController.signal, 'multipart fetch receives the generation signal')

fetchImplementation = (_url, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
})
const timeoutController = new AbortController()
const request = sendMessage('session-1', 'slow request', { componentType: 'TEXT_BOX' }, timeoutController.signal)
timeoutController.abort()
await assert.rejects(request, error => error?.name === 'AbortError')

fetchImplementation = (_url, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener(
    'abort',
    () => reject(new TypeError('fetch aborted by browser')),
    { once: true },
  )
})
const typeErrorAbortController = new AbortController()
const typeErrorAbortRequest = sendMessage(
  'session-1',
  'slow browser request',
  { componentType: 'TEXT_BOX' },
  typeErrorAbortController.signal,
)
typeErrorAbortController.abort()
await assert.rejects(typeErrorAbortRequest, error => error?.name === 'AbortError')

const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
assert.match(generationSource, /ensureSession\(controller\.signal\)/)
assert.match(
  generationSource,
  /insertedElementIds\.map\(\(elementId, index\) => sendLayoutMutationWithReconciliation\(/,
)
assert.match(generationSource, /`\$\{lifecycleMutationId\}:rollback-generation:\$\{index\}`/)
assert.match(generationSource, /!layoutCommandSucceeded\(result\.value\)/)
assert.match(generationSource, /generating: false/)

console.log('Text Labs abort signal tests passed')
