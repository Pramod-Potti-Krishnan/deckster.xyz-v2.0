import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(
  new URL('../lib/layout-command-result.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })

assert.equal(mod.exports.layoutCommandSucceeded({ success: true, elementId: 'new' }), true)
assert.equal(mod.exports.layoutCommandSucceeded({ success: false, error: 'geometry' }), false)
assert.equal(mod.exports.layoutCommandSucceeded(undefined), false)
assert.throws(
  () => mod.exports.assertLayoutCommandSucceeded(
    { success: false, error: 'geometry is invalid' },
    'Element insertion',
  ),
  /Element insertion failed: geometry is invalid/,
)

const generationSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
const assertIndex = generationSource.indexOf('assertLayoutCommandSucceeded(')
const refineDeleteIndex = generationSource.indexOf(
  "'deleteElement',\n            { elementId: refineContext.elementId }",
)
assert.ok(assertIndex >= 0 && refineDeleteIndex > assertIndex)
assert.match(generationSource, /!layoutCommandSucceeded\(result\.value\)/)
assert.match(generationSource, /layoutMutationStateIsAmbiguous\(deleteError\)/)
assert.match(generationSource, /activePresentationTargetRef/)
assert.match(generationSource, /expectedPresentationTarget\.epoch/)
assert.match(generationSource, /!presentationTargetChanged\s*&&\s*\(!refineContext \|\| !refineElementDeleted\)/)
assert.match(generationSource, /presentationIsStillAuthoritative\(\)\s*&&\s*refineContext/)

const waitImmediately = async () => {}
const insertCalls = []
const insertResult = await mod.exports.sendLayoutMutationWithReconciliation(
  async (action, params) => {
    insertCalls.push({ action, params })
    if (action === 'insertDiagram') throw new Error('Command timeout')
    return {
      success: true,
      status: 'completed',
      result: { success: true, elementId: 'diagram-new' },
    }
  },
  'insertDiagram',
  { elementId: 'diagram-new' },
  'mutation-insert',
  { attempts: 1, delayMs: 0, wait: waitImmediately },
)
assert.equal(insertResult.elementId, 'diagram-new')
assert.equal(insertCalls[0].params.mutationId, 'mutation-insert')
assert.equal(insertCalls[1].action, 'getElementMutationReceipt')

const deleteResult = await mod.exports.sendLayoutMutationWithReconciliation(
  async action => {
    if (action === 'deleteElement') throw new Error('Command timeout')
    return {
      success: true,
      status: 'completed',
      result: { success: true, elementId: 'diagram-old' },
    }
  },
  'deleteElement',
  { elementId: 'diagram-old' },
  'mutation-delete',
  { attempts: 1, delayMs: 0, wait: waitImmediately },
)
assert.equal(deleteResult.success, true)

let negativeDeleteCalls = 0
await assert.rejects(
  mod.exports.sendLayoutMutationWithReconciliation(
    async () => {
      negativeDeleteCalls += 1
      return { success: false, error: 'Element not found' }
    },
    'deleteElement',
    { elementId: 'missing-placeholder' },
    'mutation-negative-delete',
  ),
  /deleteElement failed: Element not found/,
)
assert.equal(
  negativeDeleteCalls,
  1,
  'an explicit negative deletion receipt is not treated as success or retried as a timeout',
)

await assert.rejects(
  mod.exports.sendLayoutMutationWithReconciliation(
    async action => {
      if (action === 'insertDiagram') throw new Error('Command timeout')
      return { success: true, status: 'pending' }
    },
    'insertDiagram',
    { elementId: 'diagram-ambiguous' },
    'mutation-ambiguous',
    { attempts: 2, delayMs: 0, wait: waitImmediately },
  ),
  /no automatic rollback was attempted/,
)

console.log('layout command receipt and timeout reconciliation tests passed')
