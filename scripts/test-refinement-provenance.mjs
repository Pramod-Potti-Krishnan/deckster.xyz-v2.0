import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../hooks/use-element-refinement.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require: id => {
    if (id === 'react') return { useCallback: callback => callback }
    return {}
  },
})

const buildRefineContext = mod.exports.useElementRefinement({
  currentSlideIndex: 0,
  slideContextByIndex: null,
  deckContext: null,
  sessionStoreName: null,
  sessionId: null,
})
const context = buildRefineContext({
  elementId: 'full-deck-box',
  elementType: 'textbox',
  componentType: 'TEXT_BOX',
  styleOwner: 'text_service',
  themeVariantSource: 'slide_builder_renderer',
}, 'TEXT_BOX')

assert.equal(context.styleOwner, 'text_service')
assert.equal(context.themeVariantSource, 'slide_builder_renderer')
assert.equal(context.existingElement.style_owner, 'text_service')
assert.equal(context.existingElement.theme_variant_source, 'slide_builder_renderer')

const generationSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.match(generationSource, /theme_variant_source: refineContext\?\.themeVariantSource/)

console.log('refinement provenance tests passed')
