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

console.log('layout command receipt tests passed')

