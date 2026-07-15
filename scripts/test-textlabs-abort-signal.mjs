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
      return { INSERTION_METHOD_MAP: {}, TEXT_LABS_ELEMENT_DEFAULTS: {} }
    }
    if (id === '@/lib/element-semantic-type') {
      return { semanticTypeForInsertion: value => value }
    }
    if (id === '@/lib/textlabs-theme-metadata') {
      return {
        resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }),
      }
    }
    throw new Error(`Unexpected dependency: ${id}`)
  },
})

const { generateInfographic, sendMessage } = mod.exports

let capturedSignal
fetchImplementation = async (_url, init) => {
  capturedSignal = init.signal
  return { ok: true, json: async () => ({ elements: [] }) }
}
const messageController = new AbortController()
await sendMessage('session-1', 'hello', { componentType: 'TEXT_BOX' }, messageController.signal)
assert.equal(capturedSignal, messageController.signal, 'chat fetch receives the generation signal')

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

const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
assert.match(generationSource, /ensureSession\(controller\.signal\)/)
assert.match(generationSource, /insertedElementIds\.map\(elementId => layoutServiceApis\.sendElementCommand\('deleteElement'/)
assert.match(generationSource, /generating: false/)

console.log('Text Labs abort signal tests passed')
