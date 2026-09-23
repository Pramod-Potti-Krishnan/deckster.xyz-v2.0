import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/researcher-upload.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })

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
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports,
    require: name => {
      assert.equal(name, '@/lib/config')
      return { apiConfig: { knowledgeServiceUrl: 'https://researcher-v11-uat.up.railway.app' } }
    },
    fetch: async (url, init) => {
      calls.push({ url, init })
      return Response.json(failAt === calls.length ? { error: 'failed upload step' } : replies[calls.length - 1],
        { status: failAt === calls.length ? 500 : calls.length === 4 ? 202 : 200 })
    },
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
