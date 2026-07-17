import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(file, requireImplementation = () => ({})) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    process: { env: {} },
    require: requireImplementation,
  })
  return mod.exports
}

const catalogModule = compile(new URL('../lib/text-slot-catalog.ts', import.meta.url))
const catalog = catalogModule.parseTemplateSlotCatalog({
  success: true,
  canvas_type: 'H1',
  slots: [
    { slot_name: 'presentation_title', role: 'PRESENTATION_TITLE', kind: 'structural', geometry: { start_col: 3, start_row: 5, grid_width: 20, grid_height: 3 }, single_instance: true },
    { slot_name: 'presentation_subtitle', semantic_role: 'PRESENTATION_SUBTITLE', kind: 'structural', optional: true },
    { slot_name: 'hero_logo', kind: 'accessory', accessory_type: 'LOGO', supported: true },
    { slot_name: 'unsupported_logo', kind: 'accessory', accessory_type: 'LOGO', supported: false },
  ],
})

assert.equal(catalog.canvas_type, 'H1')
assert.deepEqual(catalog.slots.map(slot => slot.slot_name), ['presentation_title', 'presentation_subtitle', 'hero_logo'])
assert.equal(catalog.slots[0].role, 'PRESENTATION_TITLE')
assert.equal(catalog.slots[0].geometry.position_width, 20)
assert.equal(catalog.slots[2].kind, 'accessory')
assert.equal(catalog.slots[2].accessory_type, 'LOGO')
assert.equal(catalogModule.slotMetadataForRequest(catalog.slots[0]).geometry.grid_width, 20)
assert.equal(catalogModule.slotMetadataForRequest(catalog.slots[1]), undefined, 'slot metadata is omitted without valid geometry')
assert.equal(
  catalogModule.selectionForExistingTarget(catalog, { semanticRole: 'PRESENTATION_TITLE', slotName: 'presentation_title' }),
  'slot:presentation_title',
  'Regenerate preselects the persisted named slot',
)

for (const [canvasType, slots, expectedRoles, expectsLogo] of [
  ['C1', [
    { slot_name: 'slide_title', role: 'SLIDE_TITLE' },
    { slot_name: 'slide_subtitle', role: 'SLIDE_SUBTITLE' },
    { slot_name: 'footer', role: 'FOOTER' },
    { slot_name: 'sources', role: 'SOURCES', kind: 'system', system_managed: true },
  ], ['SLIDE_TITLE', 'SLIDE_SUBTITLE', 'FOOTER', 'SOURCES'], false],
  ['H2', [
    { slot_name: 'section_number', role: 'SECTION_NUMBER' },
    { slot_name: 'section_title', role: 'SECTION_TITLE' },
    { slot_name: 'section_subtitle', role: 'SECTION_SUBTITLE' },
  ], ['SECTION_NUMBER', 'SECTION_TITLE', 'SECTION_SUBTITLE'], false],
  ['H3', [
    { slot_name: 'closing_title', role: 'CLOSING_TITLE' },
    { slot_name: 'closing_subtitle', role: 'CLOSING_SUBTITLE' },
    { slot_name: 'contact_info', role: 'CONTACT_INFO' },
    { slot_name: 'quote_attribution', role: 'QUOTE_ATTRIBUTION' },
    { slot_name: 'closing_logo', kind: 'accessory', accessory_type: 'LOGO' },
  ], ['CLOSING_TITLE', 'CLOSING_SUBTITLE', 'CONTACT_INFO', 'QUOTE_ATTRIBUTION'], true],
]) {
  const parsed = catalogModule.parseTemplateSlotCatalog({ canvas_type: canvasType, slots })
  assert.deepEqual(parsed.slots.flatMap(slot => slot.role ? [slot.role] : []), expectedRoles)
  assert.equal(parsed.slots.some(slot => slot.accessory_type === 'LOGO'), expectsLogo)
  if (canvasType === 'C1') {
    assert.equal(parsed.slots.find(slot => slot.role === 'FOOTER').kind, 'structural')
    assert.equal(parsed.slots.find(slot => slot.role === 'SOURCES').kind, 'system')
  }
}
assert.equal(
  catalogModule.parseTemplateSlotCatalog({ slots: [{ slot_name: 'system_footer', role: 'FOOTER', kind: 'system' }] }).slots[0].kind,
  'system',
  'an explicit catalog kind can make FOOTER system-managed',
)
assert.equal(catalogModule.parseTemplateSlotCatalog({ canvas_type: 'C4' }).slots.length, 0, 'legacy/unknown templates safely retain Body text fallback')

const clientModule = compile(new URL('../lib/textlabs-client.ts', import.meta.url), id => {
  if (id === '@/types/textlabs') return {
    INSERTION_METHOD_MAP: { TEXT_BOX: 'insertElement', IMAGE: 'insertImage' },
    TEXT_LABS_ELEMENT_DEFAULTS: {
      TEXT_BOX: { width: 10, height: 6, zIndex: 1000 },
      IMAGE: { width: 12, height: 7, zIndex: 1000 },
    },
  }
  if (id === '@/lib/element-semantic-type') return { semanticTypeForInsertion: value => value }
  if (id === '@/lib/textlabs-theme-metadata') return { resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }) }
  if (id === '@/lib/element-provenance') return { parseThemeVariantSource: () => null, responseStyleOwner: () => null }
  throw new Error(`Unexpected dependency: ${id}`)
})

const baseForm = {
  componentType: 'TEXT_BOX',
  prompt: 'Explain the market shift',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  z_index: 1000,
  textboxConfig: {},
  semanticRole: 'BODY_TEXT',
  slotKind: 'body',
  geometryMode: 'AUTO',
  positionConfig: { start_col: 2, start_row: 4, position_width: 12, position_height: 7, auto_position: false },
}
const autoPayload = clientModule.buildApiPayload('session-1', baseForm).options
assert.equal(autoPayload.semanticRole, 'BODY_TEXT')
assert.equal(autoPayload.geometryMode, 'AUTO')
assert.equal(autoPayload.textboxConfig, undefined)
assert.equal(autoPayload.itemsPerInstance, undefined)
assert.equal(autoPayload.paddingConfig, undefined)
assert.equal(autoPayload.manualGeometryOverrides, undefined)

const structuralPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  semanticRole: 'SLIDE_TITLE',
  slotName: 'slide_title',
  slotKind: 'structural',
  slotMetadata: {
    geometry: { grid_width: 28, grid_height: 3, start_col: 2, start_row: 2 },
    typography: { font_size_px: 36, line_height: 1.1 },
    single_instance: true,
    kind: 'structural',
  },
  positionConfig: undefined,
}).options
assert.equal(structuralPayload.semanticRole, 'SLIDE_TITLE')
assert.equal(structuralPayload.slotName, 'slide_title')
assert.equal(structuralPayload.positionConfig, undefined)
assert.equal(structuralPayload.slotMetadata.geometry.grid_width, 28)
assert.equal(structuralPayload.slotMetadata.typography.line_height, 1.1)

const logoPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  componentType: 'IMAGE',
  imageConfig: { style: 'brand_graphic', quality: 'high', auto_position: true },
  slotName: 'brand_logo',
  slotKind: 'accessory',
  accessoryType: 'LOGO',
}).options
assert.equal(logoPayload.componentType, 'IMAGE')
assert.equal(logoPayload.semanticRole, undefined)
assert.equal(logoPayload.accessoryType, 'LOGO')
assert.equal(logoPayload.imageConfig.style, 'brand_graphic')

const manualPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  geometryMode: 'MANUAL',
  advancedModified: true,
  manualGeometryOverrides: { items_per_box: 3, item_max_chars: 72, line_height: 1.4 },
  textboxConfig: {
    list_style: 'numbered',
    heading_indent: 2,
    content_indent: 1,
  },
}).options
assert.deepEqual(
  JSON.parse(JSON.stringify(manualPayload.manualGeometryOverrides)),
  { items_per_box: 3, item_max_chars: 72, line_height: 1.4 },
)
assert.equal(manualPayload.textboxConfig.list_style, 'numbered')
assert.equal(manualPayload.textboxConfig.heading_indent, 2)
assert.equal(manualPayload.textboxConfig.content_indent, 1)

const insertion = clientModule.buildInsertionParams('TEXT_BOX', {
  html: '<p>Supported claim<sup data-citation-key="market-report">1</sup></p>',
  component_type: 'TEXT_BOX',
  semantic_role: 'SLIDE_TITLE',
  slot_name: 'slide_title',
  slot_kind: 'structural',
  citations_used: [{ source_key: 'market-report', display_number: 1 }],
  resolved_geometry: { max_lines: 2 },
  platinum_profile: 'title-h1',
})
assert.equal(insertion.params.semanticRole, 'SLIDE_TITLE')
assert.equal(insertion.params.slotName, 'slide_title')
assert.equal(insertion.params.citationsUsed[0].source_key, 'market-report')
assert.deepEqual(JSON.parse(JSON.stringify(insertion.params.resolvedGeometry)), { max_lines: 2 })

const footerFormPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  semanticRole: 'FOOTER',
  slotName: 'footer',
  slotKind: 'structural',
  slotMetadata: undefined,
  positionConfig: undefined,
}).options
assert.equal(footerFormPayload.semanticRole, 'FOOTER')
assert.equal(footerFormPayload.slotKind, 'structural')
assert.equal(footerFormPayload.slotMetadata, undefined)
const footerInsertion = clientModule.buildInsertionParams('TEXT_BOX', {
  html: '<p>Confidential</p>',
  component_type: 'TEXT_BOX',
  semantic_role: footerFormPayload.semanticRole,
  slot_name: footerFormPayload.slotName,
  slot_kind: footerFormPayload.slotKind,
})
const footerUpsert = clientModule.buildSemanticUpsertParams(footerInsertion.params, 2)
assert.equal(footerUpsert.content, '<p>Confidential</p>')
assert.equal(footerUpsert.semanticRole, 'FOOTER')
assert.equal(footerUpsert.slotKind, 'structural')
assert.equal(footerUpsert.geometry, undefined)

const logoInsertion = clientModule.buildInsertionParams('IMAGE', {
  image_url: 'https://cdn.example.com/acme-logo.png',
  component_type: 'IMAGE',
  slot_name: logoPayload.slotName,
  slot_kind: logoPayload.slotKind,
  accessory_type: logoPayload.accessoryType,
})
assert.equal(logoInsertion.method, 'insertImage')
const logoUpsert = clientModule.buildSemanticUpsertParams(logoInsertion.params, 0)
assert.equal(logoUpsert.content, 'https://cdn.example.com/acme-logo.png')
assert.equal(logoUpsert.semanticRole, undefined)
assert.equal(logoUpsert.accessoryType, 'LOGO')
assert.equal(logoUpsert.metadata.componentType, 'IMAGE')

const formSource = fs.readFileSync(new URL('../components/generation-panel/forms/text-box-form.tsx', import.meta.url), 'utf8')
const panelSource = fs.readFileSync(new URL('../components/generation-panel/header.tsx', import.meta.url), 'utf8')
const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
const clientSource = fs.readFileSync(new URL('../lib/textlabs-client.ts', import.meta.url), 'utf8')
const typesSource = fs.readFileSync(new URL('../types/textlabs.ts', import.meta.url), 'utf8')
assert.doesNotMatch(formSource, /theme_mode|ThemeSourceSelector|recalcTextBoxLimits/)
assert.match(formSource, /componentType: 'IMAGE'/)
assert.match(formSource, /style: 'brand_graphic'/)
for (const section of ['Instances', 'Box Design', 'Heading', 'Content', 'Positioning', 'Container Padding']) {
  assert.match(
    formSource,
    new RegExp(`CollapsibleSection title="${section}"`),
    `Advanced retains the production ${section} section`,
  )
}
assert.match(formSource, /Items \/ Box/)
assert.match(formSource, /Auto — Platinum fit/)
assert.match(formSource, /updateExplicitManualOverride\(\s*'items_per_box'/)
assert.match(formSource, /Heading Font/)
assert.match(formSource, /Content Font/)
assert.match(formSource, /Deck theme/)
assert.doesNotMatch(panelSource, /Regenerate|onRegenerateToggle|regenerateEnabled/)
assert.doesNotMatch(typesSource, /function recalcTextBoxLimits/)
assert.match(generationSource, /sendElementCommand\('upsertSemanticElement'/)
assert.match(generationSource, /buildSemanticUpsertParams/)
assert.match(clientSource, /citationsUsed/)
assert.match(generationSource, /slot_name:/)

console.log('textbox role and Platinum geometry contract tests passed')
