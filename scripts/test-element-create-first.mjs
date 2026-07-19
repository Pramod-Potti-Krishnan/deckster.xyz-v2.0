import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(
  path.join(here, '..', 'hooks', 'use-textlabs-generation.ts'),
  'utf8',
)

const insertion = source.indexOf('const insertResponse = await sendLayoutMutationWithReconciliation')
const placeholderDelete = source.indexOf(
  '`${lifecycleMutationId}:delete-placeholder-after-insert`',
)

assert.ok(insertion >= 0, 'generated element insertion must be present')
assert.ok(placeholderDelete >= 0, 'post-insert placeholder deletion must be present')
assert.ok(
  insertion < placeholderDelete,
  'placeholder deletion must happen only after generated insertion is acknowledged',
)
assert.ok(
  source.includes('if (layoutMutationStateIsAmbiguous(deleteError))'),
  'ambiguous placeholder deletion must preserve the inserted copy for reload reconciliation',
)
assert.ok(
  source.includes('insertedElementIds.length = 0'),
  'ambiguous deletion must disable destructive rollback of the inserted copy',
)

console.log('element create-first lifecycle contract passed')
