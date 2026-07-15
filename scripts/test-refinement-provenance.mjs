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
  themeVariantSource: 'full_deck_generation',
}, 'TEXT_BOX')

assert.equal(context.styleOwner, 'text_service')
assert.equal(context.themeVariantSource, 'full_deck_generation')
assert.equal(context.existingElement.style_owner, 'text_service')
assert.equal(context.existingElement.theme_variant_source, 'full_deck_generation')

const generationSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.match(generationSource, /style_owner: responseStyleOwner\(element\)/)
assert.doesNotMatch(generationSource, /\?\? refineContext\?\.styleOwner/)
assert.match(generationSource, /parseThemeVariantSource\(refineContext\?\.themeVariantSource\)/)

const provenanceSource = fs.readFileSync(
  new URL('../lib/element-provenance.ts', import.meta.url),
  'utf8',
)
const provenanceCompiled = ts.transpileModule(provenanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const provenanceMod = { exports: {} }
vm.runInNewContext(provenanceCompiled.outputText, {
  module: provenanceMod,
  exports: provenanceMod.exports,
})
const { parseStyleOwner, parseThemeVariantSource, responseStyleOwner } = provenanceMod.exports

for (const owner of [
  'text_service', 'analytics', 'image_builder', 'illustrator',
  'diagram_generator', 'slide_builder_placeholder',
]) assert.equal(parseStyleOwner(owner), owner)
assert.equal(parseStyleOwner('analytics_service'), null)
assert.equal(parseStyleOwner('text_labs'), null)
assert.equal(responseStyleOwner({}), null, 'missing new owner stays unset')
assert.equal(responseStyleOwner({ style_owner: 'illustrator' }), 'illustrator')
assert.equal(responseStyleOwner({ style_owner: 'analytics_service' }), null)
assert.equal(parseThemeVariantSource('full_deck_generation'), 'full_deck_generation')
assert.equal(parseThemeVariantSource('slide_builder_renderer'), null)

const insertIndex = generationSource.indexOf('const { method, params } = buildInsertionParams')
const deleteIndex = generationSource.indexOf("sendElementCommand('deleteElement'", insertIndex)
assert.ok(insertIndex >= 0 && deleteIndex > insertIndex, 'replacement inserts before deleting the original')

console.log('refinement provenance tests passed')
