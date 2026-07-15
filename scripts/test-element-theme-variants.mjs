import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const semanticSource = fs.readFileSync(new URL('../lib/element-semantic-type.ts', import.meta.url), 'utf8')
const semanticCompiled = ts.transpileModule(semanticSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const semanticMod = { exports: {} }
vm.runInNewContext(semanticCompiled.outputText, { module: semanticMod, exports: semanticMod.exports })

const source = fs.readFileSync(new URL('../lib/element-theme-variants.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require: id => {
    if (id === '@/lib/element-semantic-type') return semanticMod.exports
    throw new Error(`Unexpected dependency: ${id}`)
  },
})

const { parseElementThemeAssignments } = mod.exports
const assignments = parseElementThemeAssignments({
  success: true,
  assignments: [
    { slot_index: 1, component_type: 'TEXT_BOX', theme_variant_id: 'accent-2', theme_bindings: { background: 'accent_2' } },
    { slot_index: 0, component_type: 'TEXT_BOX', theme_variant_id: 'accent-1', theme_bindings: { background: 'accent_1' } },
  ],
}, 'TEXT_BOX', 2)
assert.equal(assignments[0].slotIndex, 0)
assert.equal(assignments[1].themeVariantId, 'accent-2')
assert.throws(
  () => parseElementThemeAssignments({ success: true, assignments: [] }, 'METRICS', 2),
  /every element slot/,
)

console.log('element theme variant tests passed')
