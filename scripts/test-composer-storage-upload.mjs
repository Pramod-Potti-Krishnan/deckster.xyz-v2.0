import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/researcher-upload.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
// lib/researcher-upload.ts reads the owner id through lib/upload-owner.ts (flag NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED,
// unset here, so the original `userId || 'anonymous'` behaviour).
const uploadOwnerModule = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(new URL('../lib/upload-owner.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module: uploadOwnerModule, exports: uploadOwnerModule.exports, process: { env: {} } },
)

// ...and sends its Researcher calls through lib/upload-identity-token.ts (R-20261007-frontend-27; flag
// NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED, unset here, so a plain `fetch(url, init)`).
const tokenWrapperCode = ts.transpileModule(fs.readFileSync(new URL('../lib/upload-identity-token.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function tokenWrapper(fetchStub) {
  const wrapper = { exports: {} }
  vm.runInNewContext(tokenWrapperCode, {
    module: wrapper, exports: wrapper.exports, process: { env: {} }, fetch: fetchStub,
    require: name => {
      assert.equal(name, '@/lib/identity-token-client')
      return { NotYourSessionError: class extends Error {}, identityTokenClient: {} }
    },
  })
  return wrapper.exports
}

async function upload(options, failAt) {
  const calls = []
  const progress = []
  const module = { exports: {} }
  const replies = [
    { session_id: 'owned-session' },
    { signed_url: 'https://storage.example.test/signed-upload', storage_path: 'owned-session/123_deck.pptx' },
    {},
    { job_id: 'researcher-job', file_name: 'processed-name.pptx', storage_path: 'owned-session/123_deck.pptx' },
  ]
  const fetchStub = async (url, init) => {
    calls.push({ url, init })
    return Response.json(failAt === calls.length ? { error: 'failed upload step' } : replies[calls.length - 1],
      { status: failAt === calls.length ? 500 : calls.length === 4 ? 202 : 200 })
  }
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports,
    require: name => {
      if (name === '@/lib/upload-owner') return uploadOwnerModule.exports
      if (name === '@/lib/upload-identity-token') return tokenWrapper(fetchStub)
      assert.equal(name, '@/lib/config')
      return { apiConfig: { knowledgeServiceUrl: 'https://researcher-v11-uat.up.railway.app' } }
    },
    fetch: fetchStub,
  })
  const file = { name: 'deck.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  try {
    const result = await module.exports.uploadFileToResearcher({ sessionId: 'owned-session', userId: 'owner', file, onProgress: value => progress.push(value), ...options })
    return { calls, progress, result, file }
  } catch (error) { return { calls, progress, error } }
}

const composer = await upload({ storageOnly: true, intent: 'composer_template' })
assert.equal(composer.calls.length, 3)
assert.deepEqual(composer.calls.map(call => call.init.method), ['POST', 'POST', 'PUT'])
assert.equal(composer.calls[2].init.body, composer.file)
assert.ok(composer.calls.every(call => !call.url.endsWith('/process-uploaded')))
assert.equal(composer.result.storagePath, 'owned-session/123_deck.pptx')
assert.equal(composer.result.jobId, null)
assert.equal(composer.result.fileName, 'deck.pptx')
assert.equal(composer.progress.at(-1).percent, 100)
assert.equal(composer.progress.at(-1).stage, 'upload')

for (const storageOnly of [undefined, false]) {
  const legacy = await upload({ storageOnly, intent: 'template_ingest' })
  assert.equal(legacy.calls.length, 4)
  assert.ok(legacy.calls[3].url.endsWith('/process-uploaded'))
  const payload = JSON.parse(legacy.calls[3].init.body)
  assert.equal(payload.session_id, 'owned-session')
  assert.equal(payload.storage_path, 'owned-session/123_deck.pptx')
  assert.equal(payload.intent, 'template_ingest')
  assert.equal(legacy.result.jobId, 'researcher-job')
  assert.equal(legacy.result.fileName, 'processed-name.pptx')
  assert.equal(legacy.progress.at(-1).stage, 'process')
}
const failed = await upload({ storageOnly: true }, 3)
assert.ok(failed.error)
assert.equal(failed.calls.length, 3)
assert.ok(failed.calls.every(call => !call.url.endsWith('/process-uploaded')))

console.log('Composer storage upload: exactly three requests, original bytes preserved, no processing call; legacy four-step path preserved.')
