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

const provenanceSource = fs.readFileSync(new URL('../lib/element-provenance.ts', import.meta.url), 'utf8')
const provenanceCompiled = ts.transpileModule(provenanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const provenanceMod = { exports: {} }
vm.runInNewContext(provenanceCompiled.outputText, { module: provenanceMod, exports: provenanceMod.exports })

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

const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
assert.match(generationSource, /Couldn't assign deterministic deck-theme treatments/)
assert.doesNotMatch(generationSource, /normal deck-theme fallback/)

const metadataSource = fs.readFileSync(new URL('../lib/textlabs-theme-metadata.ts', import.meta.url), 'utf8')
const metadataCompiled = ts.transpileModule(metadataSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const metadataMod = { exports: {} }
vm.runInNewContext(metadataCompiled.outputText, { module: metadataMod, exports: metadataMod.exports })
const { resolveElementThemeMetadata } = metadataMod.exports

const nested = resolveElementThemeMetadata({
  metadata: { theme_variant_id: 'nested-variant', theme_bindings: { background: 'accent_2_500' } },
})
assert.equal(nested.themeVariantId, 'nested-variant')
assert.equal(nested.themeBindings.background, 'accent_2_500')

const assigned = resolveElementThemeMetadata({}, {
  themeVariantId: 'requested-box-2',
  themeBindings: { background: 'accent_1_500' },
})
assert.equal(assigned.themeVariantId, 'requested-box-2')
assert.equal(assigned.themeBindings.background, 'accent_1_500')
assert.match(generationSource, /requestedElementTheme\?\.theme_variant_id/)

const clientSource = fs.readFileSync(new URL('../lib/textlabs-client.ts', import.meta.url), 'utf8')
const clientCompiled = ts.transpileModule(clientSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const clientMod = { exports: {} }
vm.runInNewContext(clientCompiled.outputText, {
  module: clientMod,
  exports: clientMod.exports,
  process: { env: {} },
  require: id => {
    if (id === '@/lib/element-semantic-type') return semanticMod.exports
    if (id === '@/lib/textlabs-theme-metadata') return metadataMod.exports
    if (id === '@/lib/element-provenance') return provenanceMod.exports
    if (id === '@/types/textlabs') return {
      INSERTION_METHOD_MAP: { TEXT_BOX: 'insertElement', METRICS: 'insertElement' },
      TEXT_LABS_ELEMENT_DEFAULTS: {
        TEXT_BOX: { width: 12, height: 6, zIndex: 10 },
        METRICS: { width: 12, height: 6, zIndex: 10 },
      },
    }
    throw new Error(`Unexpected client dependency: ${id}`)
  },
})
const { buildInsertionParams } = clientMod.exports
const insertionOne = buildInsertionParams('TEXT_BOX', {
  html: '<div>One</div>',
  metadata: {
    theme_variant_id: 'box-variant-1',
    theme_bindings: { background: 'primary_500' },
    style_owner: 'text_service',
  },
}).params
const insertionTwo = buildInsertionParams('TEXT_BOX', {
  html: '<div>Two</div>',
  metadata: {
    theme_variant_id: 'box-variant-2',
    theme_bindings: { background: 'accent_2_500' },
    theme_variant_source: 'full_deck_generation',
  },
}).params
assert.equal(insertionOne.themeVariantId, 'box-variant-1')
assert.equal(insertionOne.styleOwner, 'text_service')
assert.equal(insertionOne.themeVariantSource, 'element_generation')
assert.equal(insertionOne.themeBindings.background, 'primary_500')
assert.equal(insertionTwo.themeVariantId, 'box-variant-2')
assert.equal(insertionTwo.themeBindings.background, 'accent_2_500')
assert.equal(insertionTwo.styleOwner, undefined)
assert.equal(insertionTwo.themeVariantSource, 'full_deck_generation')

const swatchSource = fs.readFileSync(new URL('../hooks/use-deck-theme-palette.ts', import.meta.url), 'utf8')
for (const token of [
  '--theme-primary', '--theme-accent-1', '--theme-accent-2',
  '--theme-surface', '--theme-text-heading', '--theme-text-body',
]) {
  assert.match(swatchSource, new RegExp(`\\['${token.replaceAll('-', '\\-')}'`))
}
assert.doesNotMatch(swatchSource, /\['(?:heading_text|body_text)'/)

console.log('element theme variant tests passed')
