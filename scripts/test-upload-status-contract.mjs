import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const helperUrl = new URL('../lib/upload-status.ts', import.meta.url)
const source = fs.readFileSync(helperUrl, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require,
  Set,
})

const {
  getEnrichmentLabel,
  getUploadStatusPresentation,
  resolveEnrichmentOutcome,
} = mod.exports
const plain = value => JSON.parse(JSON.stringify(value))

assert.equal(
  getEnrichmentLabel({
    readiness: {
      text_extracted: true,
      summary_ready: true,
      inventory_ready: true,
      semantic_query_verified: false,
    },
  }),
  'Research-ready · indexing',
)
assert.equal(
  getEnrichmentLabel({
    readiness: {
      text_extracted: true,
      summary_ready: false,
      inventory_ready: false,
      semantic_query_verified: false,
    },
  }),
  'Read · building inventory',
)
assert.equal(
  getEnrichmentLabel({
    readiness: {
      semantic_query_verified: true,
    },
  }),
  'Searchable',
)

{
  const uploading = getUploadStatusPresentation('uploading', 'brief.pdf')
  assert.equal(uploading.blocksSend, true)
  assert.equal(uploading.showActivity, true)
  assert.equal(uploading.showProgress, true)
  assert.match(uploading.label, /Uploading/)
}

{
  const stored = getUploadStatusPresentation('stored', 'brief.pdf')
  assert.equal(stored.blocksSend, false)
  assert.equal(stored.showActivity, false)
  assert.equal(stored.showProgress, false)
  assert.equal(stored.label, 'Stored')
  assert.match(stored.ariaLabel, /stored and attached/)
}

{
  const enriching = getUploadStatusPresentation('processing', 'brief.pdf')
  assert.equal(enriching.blocksSend, false)
  assert.equal(enriching.showActivity, false)
  assert.equal(enriching.showProgress, false)
  assert.equal(enriching.label, 'Enriching in background')
  assert.match(enriching.ariaLabel, /stored and enriching sources in the background/)
}

{
  const ready = getUploadStatusPresentation('success', 'brief.pdf')
  assert.equal(ready.blocksSend, false)
  assert.equal(ready.showActivity, false)
  assert.equal(ready.showProgress, false)
  assert.equal(ready.label, 'Searchable')
}

{
  const partial = getUploadStatusPresentation(
    'degraded',
    'brief.pdf',
    'No tables were extracted',
  )
  assert.equal(partial.blocksSend, false)
  assert.equal(partial.showActivity, false)
  assert.equal(partial.showProgress, false)
  assert.equal(partial.label, 'Stored — partial / needs attention')
  assert.match(partial.ariaLabel, /No tables were extracted/)
}

{
  const failed = getUploadStatusPresentation(
    'error',
    'brief.pdf',
    'Storage upload failed',
  )
  assert.equal(failed.blocksSend, true)
  assert.equal(failed.showActivity, false)
  assert.equal(failed.showProgress, false)
  assert.equal(failed.label, 'Upload failed')
}

assert.deepEqual(
  plain(resolveEnrichmentOutcome({ status: 'ready', deep_summary_chars: 1200 })),
  { status: 'success' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ status: 'degraded', degraded_reason: 'fallback parser used' })),
  { status: 'degraded', detail: 'fallback parser used' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ status: 'partial', warning: 'one sheet was skipped' })),
  { status: 'degraded', detail: 'one sheet was skipped' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ status: 'ready', error: 'v3_indexing_disabled' })),
  { status: 'degraded', detail: 'v3_indexing_disabled' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({
    status: 'ready',
    readiness: {
      fully_ready: false,
      partial: true,
      degraded_reasons: ['vector_index_failed'],
      retryable_steps: ['vector_index'],
    },
  })),
  { status: 'degraded', detail: 'vector_index_failed' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({
    status: 'ready',
    readiness: {
      fully_ready: true,
      semantic_query_verified: false,
      degraded_reasons: ['semantic_query_not_verified'],
    },
  })),
  { status: 'degraded', detail: 'semantic_query_not_verified' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ success: false, warning: 'fallback only' })),
  { status: 'degraded', detail: 'fallback only' },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ annotation_status: 'upstream_error' })),
  {
    status: 'degraded',
    detail: 'Source enrichment completed with upstream error.',
  },
)
assert.deepEqual(
  plain(resolveEnrichmentOutcome({ annotation_status: 'skipped' })),
  { status: 'success' },
)

const chipSource = fs.readFileSync(
  new URL('../components/file-chip.tsx', import.meta.url),
  'utf8',
)
const builderSource = fs.readFileSync(
  new URL('../app/builder/page.tsx', import.meta.url),
  'utf8',
)
const chatInputSource = fs.readFileSync(
  new URL('../components/builder/chat-input.tsx', import.meta.url),
  'utf8',
)
const uploadHookSource = fs.readFileSync(
  new URL('../hooks/use-file-upload.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(
  chipSource,
  /file\.status === 'uploading'\s*\|\|\s*file\.status === 'processing'/,
  'background enrichment must not share the upload spinner/progress condition',
)
assert.match(
  chipSource,
  /file\.status === 'processing'[\s\S]*?<Sparkles/,
  'background enrichment uses a calm, non-animated status icon',
)
assert.match(
  builderSource,
  /file\.status === 'success'[\s\S]*file\.status === 'stored'[\s\S]*file\.status === 'processing'[\s\S]*file\.status === 'degraded'/,
  'stored, enriching, ready, and partial uploads all remain attached to Director requests',
)
assert.doesNotMatch(
  chatInputSource,
  /pendingUpload[\s\S]{0,120}status === 'processing'/,
  'background enrichment must not block the composer',
)
assert.match(
  uploadHookSource,
  /status:\s*'stored'/,
  'the durable-object boundary must produce a distinct Stored attachment state',
)
assert.match(
  uploadHookSource,
  /respond_async:\s*true/,
  'the frontend must ask Researcher to durably enqueue small files',
)
assert.ok(
  uploadHookSource.indexOf('await recordUploadedFile')
    < uploadHookSource.indexOf('onUploadComplete?.([storedFile])'),
  'Send may be enabled once the durable object is linked to the session',
)
assert.ok(
  uploadHookSource.indexOf('onUploadComplete?.([storedFile])')
    < uploadHookSource.indexOf('processResult = await processUploadedFile'),
  'source enrichment starts after the non-blocking Stored attachment is visible',
)

console.log('upload status contract tests passed')
