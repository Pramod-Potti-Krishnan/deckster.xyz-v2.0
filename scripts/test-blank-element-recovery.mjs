import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/blank-element-recovery.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })
const { restoreBlankElementAfterFailure } = mod.exports

let inserted = 0
let restoredIds = []
const sameId = await restoreBlankElementAfterFailure({
  elementId: 'blank-1',
  trackingWasRemoved: true,
  deleteElement: async () => { throw new Error('Element not found') },
  insertElement: async () => { inserted += 1; return { elementId: 'blank-1' } },
  restoreTracking: id => restoredIds.push(id),
})
assert.equal(sameId, 'blank-1')
assert.equal(inserted, 1, 'a failed delete cannot suppress placeholder insertion')
assert.deepEqual(restoredIds, ['blank-1'], 'same-ID recovery restores removed tracking')

restoredIds = []
const remappedId = await restoreBlankElementAfterFailure({
  elementId: 'blank-2',
  trackingWasRemoved: false,
  deleteElement: async () => undefined,
  insertElement: async () => ({ elementId: 'blank-remapped' }),
  restoreTracking: id => restoredIds.push(id),
})
assert.equal(remappedId, 'blank-remapped')
assert.deepEqual(restoredIds, ['blank-remapped'], 'an ID remap always updates tracking')

const hookSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
assert.match(hookSource, /blankElements\.trackElement\(restoredElementId\)/)
assert.ok(
  hookSource.lastIndexOf('generationPanel.setError(errorMessage)') >
    hookSource.indexOf('restoreBlankElementAfterFailure'),
  'the recovered panel must retain the generation error',
)

console.log('blank element failure recovery tests passed')
