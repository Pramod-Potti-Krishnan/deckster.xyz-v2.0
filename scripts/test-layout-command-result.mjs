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
// Test the actual guard expressions rather than their formatting or adjacency.
// Compensation must stop after a deck switch or deletion of the refined source;
// cleanup must clear only an overlay whose original target still survives.
const generationAst = ts.createSourceFile('generation.ts', generationSource, ts.ScriptTarget.Latest, true)
function findNode(root, predicate) {
  if (predicate(root)) return root
  let found
  ts.forEachChild(root, child => { found ??= findNode(child, predicate) })
  return found
}
function containingIf(node) {
  while (node && !ts.isIfStatement(node)) node = node.parent
  assert.ok(node, 'mutation has an explicit safety guard')
  return node
}
const rollbackMap = findNode(generationAst, node => ts.isCallExpression(node)
  && node.expression.getText(generationAst) === 'insertedElementIds.map'
  && node.arguments[0]?.getText(generationAst).includes(':rollback-generation:'))
assert.ok(rollbackMap, 'inserted elements are compensated as a batch')
const rollbackGuard = containingIf(rollbackMap).expression.getText(generationAst)
const rollbackAllowed = overrides => vm.runInNewContext(rollbackGuard, {
  presentationTargetChanged: false,
  immediateFailureFeedbackEnabled: false,
  failureRecoveryIsCurrent: () => true,
  presentationIsStillAuthoritative: () => true,
  refineContext: null,
  refineElementDeleted: false,
  insertedElementIds: ['generated'],
  generationLayoutServiceApis: { sendElementCommand: () => {} },
  ...overrides,
})
assert.ok(rollbackAllowed({}), 'ordinary inserted elements can be rolled back')
assert.ok(rollbackAllowed({ immediateFailureFeedbackEnabled: true }),
  'ON compensates while presentation/native authority is current')
assert.equal(Boolean(rollbackAllowed({ immediateFailureFeedbackEnabled: true,
  failureRecoveryIsCurrent: () => false })), false,
  'ON cannot compensate after losing native presentation authority')
assert.ok(rollbackAllowed({ failureRecoveryIsCurrent: () => false }),
  'OFF preserves its original presentation guard without the ON native lease gate')
assert.equal(Boolean(rollbackAllowed({ presentationTargetChanged: true })), false,
  'compensation cannot mutate a different presentation')
assert.equal(Boolean(rollbackAllowed({ refineContext: { elementId: 'old' }, refineElementDeleted: true })), false,
  'a deleted refined source is not compensated as an untouched original')
assert.ok(rollbackAllowed({ refineContext: { elementId: 'old' } }),
  'a surviving refined source allows rollback of generated replacements')
assert.equal(Boolean(rollbackAllowed({ insertedElementIds: [] })), false)
const refineOverlayCall = findNode(generationAst, node => ts.isCallExpression(node)
  && node.expression.getText(generationAst) === 'generationLayoutServiceApis.sendElementCommand'
  && node.arguments[0]?.getText(generationAst) === "'setElementGenerationState'"
  && node.arguments[1]?.getText(generationAst).includes('elementId: refineContext.elementId')
  && node.arguments[1]?.getText(generationAst).includes('generating: false'))
assert.ok(refineOverlayCall, 'the refined overlay is explicitly cleared')
const refineOverlayGuard = containingIf(refineOverlayCall).expression.getText(generationAst)
const refineOverlayAllowed = overrides => vm.runInNewContext(refineOverlayGuard, {
  presentationIsStillAuthoritative: () => true,
  immediateFailureFeedbackEnabled: false,
  failureRecoveryStarted: true,
  failureRecoveryIsCurrent: () => true,
  refineContext: { elementId: 'old' },
  refineOverlayActive: true,
  refineOverlayTargetSurvived: true,
  generationLayoutServiceApis: { sendElementCommand: () => {} },
  ...overrides,
})
assert.ok(refineOverlayAllowed({}), 'a surviving old overlay is cleaned up')
assert.ok(refineOverlayAllowed({ immediateFailureFeedbackEnabled: true }),
  'ON clears a surviving overlay while native authority is current')
assert.equal(Boolean(refineOverlayAllowed({ immediateFailureFeedbackEnabled: true,
  failureRecoveryIsCurrent: () => false })), false)
assert.ok(refineOverlayAllowed({ failureRecoveryIsCurrent: () => false }),
  'OFF retains original cleanup authority')
assert.equal(Boolean(refineOverlayAllowed({ presentationIsStillAuthoritative: () => false })), false)
assert.equal(Boolean(refineOverlayAllowed({ refineOverlayTargetSurvived: false })), false,
  'cleanup cannot write to a deleted refined target')
assert.equal(Boolean(refineOverlayAllowed({ refineOverlayActive: false })), false)

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
