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
