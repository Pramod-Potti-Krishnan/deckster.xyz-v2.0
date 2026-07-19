import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function moduleUrl(relativePath) {
  return new URL(relativePath, import.meta.url)
}

function loadClient(fetchImpl) {
  const moduleCache = new Map()
  const loadModule = url => {
    const key = url.href
    if (moduleCache.has(key)) return moduleCache.get(key)
    const compiled = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })
    const mod = { exports: {} }
    moduleCache.set(key, mod.exports)
    vm.runInNewContext(compiled.outputText, {
      module: mod,
      exports: mod.exports,
      process: { env: {} },
      fetch: url.pathname.endsWith('textlabs-client.ts') ? fetchImpl : () => {
        throw new Error('Unexpected dependency fetch')
      },
      FormData,
      DOMException,
      Error,
      TypeError,
      setTimeout,
      clearTimeout,
      require: id => {
        const aliases = {
          '@/types/textlabs': '../types/textlabs.ts',
          '@/lib/element-semantic-type': '../lib/element-semantic-type.ts',
          '@/lib/textlabs-theme-metadata': '../lib/textlabs-theme-metadata.ts',
          '@/lib/element-provenance': '../lib/element-provenance.ts',
          '@/lib/element-research-policy': '../lib/element-research-policy.ts',
        }
        if (!aliases[id]) throw new Error(`Unexpected test import: ${id}`)
        return loadModule(moduleUrl(aliases[id]))
      },
    })
    moduleCache.set(key, mod.exports)
    return mod.exports
  }
  return loadModule(moduleUrl('../lib/textlabs-client.ts'))
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

async function runScenario(sequence, options) {
  let calls = 0
  const { sendMessage } = loadClient(async () => {
    const next = sequence[calls]
    calls += 1
    if (next instanceof Error) throw next
    return next
  })
  let result
  let error
  try {
    result = await sendMessage('session-1', 'chart request', options)
  } catch (caught) {
    error = caught
  }
  return { calls, result, error }
}

const chartOptions = {
  componentType: 'CHART',
  serverSideInsert: false,
  chartConfig: { requested_data_source_mode: 'custom' },
}

const lostResponseIsNotReplayed = await runScenario([
  new TypeError('Failed to fetch'),
  response(200, { success: true, elements: [{ element_id: 'chart-1' }] }),
], chartOptions)
assert.equal(
  lostResponseIsNotReplayed.calls,
  1,
  'a non-idempotent Text Labs POST is never replayed after an ambiguous fetch failure',
)
assert.match(
  lostResponseIsNotReplayed.error.message,
  /element generation service could not be reached/i,
)

const gatewayFailureIsNotReplayed = await runScenario([
  response(503, { detail: 'Service unavailable' }),
  response(200, { success: true, elements: [{ element_id: 'chart-2' }] }),
], chartOptions)
assert.equal(
  gatewayFailureIsNotReplayed.calls,
  1,
  'gateway errors can follow successful upstream processing and are not replay-safe',
)
assert.match(gatewayFailureIsNotReplayed.error.message, /Service unavailable/)

const actionableFailure = await runScenario([
  response(400, { detail: 'Chart data requires at least two valid points.' }),
  response(200, { success: true }),
], chartOptions)
assert.equal(actionableFailure.calls, 1)
assert.match(actionableFailure.error.message, /at least two valid points/)

const nonChartFailure = await runScenario([
  new TypeError('Failed to fetch'),
  response(200, { success: true }),
], { componentType: 'TEXT_BOX', serverSideInsert: false })
assert.equal(nonChartFailure.calls, 1)
assert.match(
  nonChartFailure.error.message,
  /element generation service could not be reached/i,
)

const serverInsertFailure = await runScenario([
  response(503, { detail: 'Service unavailable' }),
  response(200, { success: true }),
], { componentType: 'CHART', serverSideInsert: true })
assert.equal(serverInsertFailure.calls, 1)
assert.match(serverInsertFailure.error.message, /Service unavailable/)

const researchedAutoFailure = await runScenario([
  response(503, { detail: 'Service unavailable' }),
  response(200, { success: true }),
], {
  componentType: 'CHART',
  serverSideInsert: false,
  chartConfig: { requested_data_source_mode: 'auto' },
  research: { mode: 'on', web: true },
})
assert.equal(
  researchedAutoFailure.calls,
  1,
  'browser retries never multiply bounded researched-chart attempts',
)
assert.match(researchedAutoFailure.error.message, /Service unavailable/)

const abortFailure = await runScenario([
  new DOMException('The operation was aborted.', 'AbortError'),
  response(200, { success: true }),
], chartOptions)
assert.equal(abortFailure.calls, 1)
assert.equal(abortFailure.error.name, 'AbortError')

const responseBodyAbort = await runScenario([
  {
    ok: false,
    status: 503,
    json: async () => {
      throw new DOMException('The operation was aborted.', 'AbortError')
    },
  },
  response(200, { success: true }),
], chartOptions)
assert.equal(responseBodyAbort.calls, 1)
assert.equal(
  responseBodyAbort.error.name,
  'AbortError',
  'an abort while reading a failed response body is never retried or rewritten',
)

const backendFailure = await runScenario([
  response(200, { success: false, error: 'Research data is invalid.' }),
  response(200, { success: true }),
], chartOptions)
assert.equal(backendFailure.calls, 1)
assert.match(backendFailure.error.message, /Research data is invalid/)

console.log('chart request safety tests passed')
