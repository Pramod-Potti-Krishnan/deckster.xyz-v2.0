import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const helperPath = new URL('../lib/element-semantic-type.ts', import.meta.url)
const compiled = ts.transpileModule(fs.readFileSync(helperPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require })

const { normalizeSemanticComponentType, semanticTypeForInsertion } = mod.exports

assert.equal(normalizeSemanticComponentType('METRICS'), 'METRICS')
assert.equal(normalizeSemanticComponentType('text'), 'TEXT_BOX')
assert.equal(normalizeSemanticComponentType('icon-label'), 'ICON_LABEL')
assert.equal(normalizeSemanticComponentType('CLOUD_ARCHITECTURE'), 'DIAGRAM')
assert.equal(normalizeSemanticComponentType('unknown'), null)
assert.equal(semanticTypeForInsertion('TABLE'), 'TABLE')
assert.equal(semanticTypeForInsertion('GANTT_CHART'), 'DIAGRAM')

const viewerSource = fs.readFileSync(new URL('../components/presentation-viewer.tsx', import.meta.url), 'utf8')
const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')

assert.match(
  viewerSource,
  /onTextBoxSelected\?\.\(elementId, formatting, componentType\)/,
  'textbox-rendered semantic types must survive the Layout selection event',
)
assert.match(
  builderSource,
  /normalizeTextLabsElementType\(selectedComponentType\) \?\? 'TEXT_BOX'/,
  'metrics and tables must route by semantic type, with TEXT_BOX only as a legacy fallback',
)
assert.doesNotMatch(
  builderSource,
  /onTextBoxSelected=\{\(elementId, formatting\) => \{[\s\S]{0,250}openPanelForEdit\('TEXT_BOX'/,
  'the selection handler must not collapse every textbox renderer to TEXT_BOX',
)

console.log('element semantic type tests passed')
