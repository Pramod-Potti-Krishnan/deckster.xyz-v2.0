import { serviceUrl, textLabsEnv } from './service-url-harness.mjs'
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
    process: { env: { ...textLabsEnv } },
    require: id => id === '@/lib/service-url' ? serviceUrl : requireImplementation(id),
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
  if (id === '@/lib/element-research-policy') return {
    isNonResearchVisualElement: componentType => ['IMAGE', 'ICON_LABEL', 'SHAPE'].includes(componentType),
  }
  throw new Error(`Unexpected dependency: ${id}`)
})
const geometryModule = compile(new URL('../lib/textbox-geometry-mode.ts', import.meta.url))
const gridModule = compile(new URL('../lib/grid-splitter.ts', import.meta.url))
const layoutModule = compile(new URL('../lib/textbox-layout.ts', import.meta.url), id => {
  if (id === '@/lib/grid-splitter') return gridModule
  throw new Error(`Unexpected layout dependency: ${id}`)
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

const staleManualPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  geometryMode: 'MANUAL',
  manualGeometryOverrides: {},
}).options
assert.equal(staleManualPayload.geometryMode, 'AUTO', 'empty manual state cannot escape as an invalid request')
assert.equal(staleManualPayload.manualGeometryOverrides, undefined)
assert.deepEqual(
  JSON.parse(JSON.stringify(geometryModule.effectiveTextGeometry('MANUAL', {}))),
  { geometryMode: 'AUTO' },
)

const textBoxFormSource = fs.readFileSync(
  new URL('../components/generation-panel/forms/text-box-form.tsx', import.meta.url),
  'utf8',
)
assert.match(
  textBoxFormSource,
  /geometryMode,\s*\n\s*manualGeometryOverrides: geometryMode === 'MANUAL' \? manualGeometryOverrides : undefined/,
  'saved generation config must preserve the user-selected UI geometry mode, not just the backend-effective request mode',
)
assert.doesNotMatch(
  textBoxFormSource,
  /geometryMode === 'MANUAL'[\s\S]{0,160}setGeometryMode\('AUTO'\)/,
  'selecting Manual with no overrides must not snap back to Auto before the user can choose fields',
)
assert.doesNotMatch(
  textBoxFormSource,
  /aria-label="Geometry mode"|<option value="MANUAL">Manual<\/option>/,
  'Advanced no longer exposes a global Auto/Manual geometry selector',
)
for (const restoredField of [
  'setCount(saved?.count ?? 1)',
  "setLayoutChoice(saved?.layoutChoice ?? 'auto')",
  "setMultiBoxColorMode(saved?.multiBoxColorMode ?? 'SAME')",
  'setTextboxOverrides(saved?.textboxOverrides ?? {})',
  "setGeometryMode(saved?.geometryMode ?? 'AUTO')",
  'setManualGeometryOverrides(saved?.manualGeometryOverrides ?? {})',
]) {
  assert.ok(
    textBoxFormSource.includes(restoredField),
    `same-element regenerate should restore ${restoredField}`,
  )
}

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
assert.equal(manualPayload.geometryMode, 'MANUAL')

const mediumArea = { start_col: 2, start_row: 4, position_width: 10, position_height: 6 }
assert.equal(layoutModule.isTextBoxLayoutViable(mediumArea, 3, 'horizontal'), false)
assert.equal(layoutModule.isTextBoxLayoutViable(mediumArea, 3, 'vertical'), false)
assert.equal(layoutModule.isTextBoxLayoutViable(mediumArea, 3, 'grid', 2), true)
assert.equal(layoutModule.isTextBoxLayoutViable(mediumArea, 4, 'grid', 2), true)
assert.equal(layoutModule.isTextBoxCountViable(mediumArea, 6), false)
const automaticGrid = layoutModule.resolveTextBoxLayout(mediumArea, 4, 'auto')
assert.equal(automaticGrid.layout, 'grid')
assert.equal(automaticGrid.gridColumns, 2)
assert.equal(automaticGrid.gridRows, 2)
assert.deepEqual(
  JSON.parse(JSON.stringify(layoutModule.textBoxGridDimensions(6))),
  [{ columns: 2, rows: 3 }, { columns: 3, rows: 2 }],
)
assert.deepEqual(
  JSON.parse(JSON.stringify(layoutModule.textBoxGridDimensions(3))),
  [{ columns: 2, rows: 2 }, { columns: 3, rows: 1 }].filter(item => item.rows >= 2),
)
const wideArea = { start_col: 2, start_row: 4, position_width: 18, position_height: 6 }
assert.equal(layoutModule.isTextBoxLayoutViable(wideArea, 3, 'horizontal'), true)
assert.equal(layoutModule.isTextBoxLayoutViable(wideArea, 3, 'vertical'), false)

const multiColorPayload = clientModule.buildApiPayload('session-1', {
  ...baseForm,
  count: 4,
  multiBoxColorMode: 'THEME_SEQUENCE',
}).options
assert.equal(multiColorPayload.multiBoxColorMode, 'THEME_SEQUENCE')

const insertion = clientModule.buildInsertionParams('TEXT_BOX', {
  html: '<p>Supported claim<sup data-citation-key="market-report">1</sup></p>',
  component_type: 'TEXT_BOX',
  semantic_role: 'SLIDE_TITLE',
  slot_name: 'slide_title',
  slot_kind: 'structural',
  generation_config: { version: 1, count: 4, multiBoxColorMode: 'THEME_SEQUENCE' },
  citations_used: [{ source_key: 'market-report', display_number: 1 }],
  resolved_geometry: { max_lines: 2 },
  platinum_profile: 'title-h1',
})
assert.equal(insertion.params.semanticRole, 'SLIDE_TITLE')
assert.equal(insertion.params.slotName, 'slide_title')
assert.equal(insertion.params.citationsUsed[0].source_key, 'market-report')
assert.deepEqual(JSON.parse(JSON.stringify(insertion.params.resolvedGeometry)), { max_lines: 2 })
assert.deepEqual(
  JSON.parse(JSON.stringify(insertion.params.generationConfig)),
  { version: 1, count: 4, multiBoxColorMode: 'THEME_SEQUENCE' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(clientModule.buildSemanticUpsertParams(insertion.params, 1).metadata.generationConfig)),
  { version: 1, count: 4, multiBoxColorMode: 'THEME_SEQUENCE' },
)

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

const refinedBodyInsertion = clientModule.buildInsertionParams('TEXT_BOX', {
  html: '<p>Refined body</p>',
  component_type: 'TEXT_BOX',
  semantic_role: 'BODY_TEXT',
  slot_name: 'content',
  slot_kind: 'body',
  grid_position: {
    start_col: 5,
    start_row: 10,
    position_width: 10,
    position_height: 6,
  },
})
const refinedBodyUpsert = clientModule.buildSemanticUpsertParams(
  refinedBodyInsertion.params,
  0,
  'existing-body',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(refinedBodyUpsert.geometry)),
  { gridRow: '10/16', gridColumn: '5/15' },
  'BODY_TEXT regeneration forwards the live element rectangle to Layout',
)

const formLifecycleSource = fs.readFileSync(new URL('../components/generation-panel/forms/text-box-form.tsx', import.meta.url), 'utf8')
assert.match(formLifecycleSource, /readSavedTextBoxGenerationConfig/)
assert.match(formLifecycleSource, /previousTargetIdentity\.current !== targetResetKey/)
assert.match(formLifecycleSource, /generationConfig/)
assert.match(formLifecycleSource, /\{\(isBodyText \|\| isSystemManaged\) && researchControls\}/)
assert.match(formLifecycleSource, /\{isStructuralText && \(\s*<CollapsibleSection title="Template Text"/)
const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
assert.match(
  builderSource,
  /features\.useTextLabsGeneration && generationPanel\.isOpen/,
  'the Element drawer handle is unavailable without an active target',
)

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
assert.match(formSource, /componentType: 'IMAGE'[\s\S]{0,500}placeholder_mode: false/)
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
assert.match(formSource, /Grid rows/)
assert.match(formSource, /Multi-box color style/)
assert.match(formSource, /Transparent/)
assert.match(formSource, /effectiveTextGeometry/)
assert.match(formSource, /Explicit values below become sparse overrides/)
assert.doesNotMatch(formSource, />Structure</)
assert.doesNotMatch(panelSource, /Regenerate|onRegenerateToggle|regenerateEnabled/)
assert.doesNotMatch(typesSource, /function recalcTextBoxLimits/)
// Execute the actual hook insertion block and shared reconciliation wrapper.
// The July acknowledgement refactor made the former direct-call literal stale.
function insertionBlock(source) {
  const tree = ts.createSourceFile('generation.ts', source, ts.ScriptTarget.Latest, true)
  let result
  const variable = (node, name) => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(tree) === name)
  function visit(node) {
    if (ts.isBlock(node)) {
      const start = node.statements.findIndex(n => variable(n, 'insertionComponentType'))
      if (start >= 0) {
        const end = node.statements.findIndex((n, i) => i > start && ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(tree) === 'assertLayoutCommandSucceeded')
        assert.ok(end > start, 'insertion must require an acknowledged result')
        result = node.statements.slice(start, end + 1).map(n => n.getText(tree)).join('\n')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(result, 'actual hook insertion block must exist')
  return result
}
const reconcileModule = compile(new URL('../lib/layout-command-result.ts', import.meta.url))
async function dispatchCase(block, fixture, behavior = 'success') {
  const calls = []
  const element = { element_id: 'generated-local', html: '<p>Local semantic content</p>', component_type: 'TEXT_BOX', semantic_role: 'BODY_TEXT', slot_kind: 'body', grid_position: { start_col: 5, start_row: 10, position_width: 10, position_height: 6 }, generation_config: { version: 1, prompt: 'Local source' }, ...fixture.element }
  let polls = 0, insertion
  const send = async (action, params) => {
    calls.push({ action, params: JSON.parse(JSON.stringify(params)) })
    if (action === 'getElementMutationReceipt') {
      polls++
      if (behavior === 'ambiguous' || (behavior === 'pending' && polls === 1)) return { success: true, status: 'pending' }
      return { success: true, status: 'completed', result: behavior === 'failed-receipt' ? { success: false, error: 'local refused receipt' } : { success: true, elementId: calls[0].params.elementId } }
    }
    if (['timeout', 'pending', 'ambiguous', 'failed-receipt'].includes(behavior)) throw new Error('Command timeout')
    if (behavior === 'refusal') return { success: false, error: 'local refused mutation' }
    if (behavior === 'network') throw new Error('local transport refusal')
    return { success: true, elementId: params.elementId }
  }
  const context = { studio: false, element, elementWithPosition: element, formData: { slotKind: 'body', ...fixture.formData }, refineContext: fixture.refineContext ?? null, index: 0, effectiveSlideIndex: 2, lifecycleMutationId: 'local-owned-attempt', layoutServiceApis: { sendElementCommand: send }, generationLayoutServiceApis: { sendElementCommand: send }, buildInsertionParams: (...args) => { insertion = clientModule.buildInsertionParams(...args); return insertion }, buildSemanticUpsertParams: clientModule.buildSemanticUpsertParams, assertLayoutCommandSucceeded: reconcileModule.assertLayoutCommandSucceeded, sendLayoutMutationWithReconciliation: (...args) => reconcileModule.sendLayoutMutationWithReconciliation(...args, { attempts: 2, delayMs: 0 }) }
  let result, error
  try {
    result = await vm.runInNewContext(ts.transpileModule('(async()=>{'+block+';return insertResponse})()', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  } catch (caught) { error = caught }
  return { calls, result, error, insertion }
}
let semanticDispatchChecks = 0
async function verifySemanticDispatch(source) {
  const block = insertionBlock(source)
  const fixtures = [
    ...['SLIDE_TITLE', 'SLIDE_SUBTITLE', 'FOOTER', 'SOURCES'].map(role => ({ name: role, element: { semantic_role: role, slot_name: role.toLowerCase(), slot_kind: role === 'SOURCES' ? 'system' : 'structural' }, refineContext: { elementId: 'existing-local', elementType: 'TEXT_BOX' }, action: 'upsertSemanticElement', semantic: true, geometry: undefined })),
    { name: 'named body', element: { slot_name: 'content' }, refineContext: { elementId: 'existing-local', elementType: 'TEXT_BOX' }, action: 'upsertSemanticElement', semantic: true, geometry: { gridRow: '10/16', gridColumn: '5/15' } },
    { name: 'cited body', element: { citations_used: [{ source_key: 'local-evidence' }] }, action: 'upsertSemanticElement', semantic: true, geometry: { gridRow: '10/16', gridColumn: '5/15' } },
    { name: 'unnamed body', action: 'insertTextBox' },
    { name: 'Logo accessory', element: { component_type: 'IMAGE', image_url: 'https://fixtures.invalid/brand.svg', slot_name: 'brand_logo', slot_kind: 'accessory', accessory_type: 'LOGO', semantic_role: undefined }, formData: { slotKind: 'accessory' }, refineContext: { elementId: 'existing-local', elementType: 'TEXT_BOX' }, action: 'upsertSemanticElement', semantic: true, geometry: undefined },
    { name: 'ordinary image', element: { component_type: 'IMAGE', image_url: 'https://fixtures.invalid/image.svg' }, action: 'insertImage' },
    { name: 'Table cited dispatch', element: { component_type: 'TABLE', citations_used: [{ source_key: 'local-table' }] }, action: 'upsertCitedElement', cited: true },
    { name: 'refined Metric cited dispatch', element: { component_type: 'METRICS' }, refineContext: { elementId: 'existing-local', elementType: 'METRICS' }, action: 'upsertCitedElement', cited: true },
  ]
  for (const fixture of fixtures) {
    const run = await dispatchCase(block, fixture)
    assert.ifError(run.error)
    assert.equal(run.calls.length, 1, fixture.name + ': exactly one mutation')
    const { action, params } = run.calls[0]
    assert.equal(action, fixture.action, fixture.name)
    assert.equal(params.elementId, run.insertion.params.elementId)
    assert.notEqual(params.elementId, 'existing-local')
    assert.equal(params.slideIndex, 2)
    assert.equal(params.mutationId, 'local-owned-attempt:insert:0')
    assert.equal(run.result.elementId, run.insertion.params.elementId)
    if (fixture.semantic) {
      assert.equal(params.replacesElementId, fixture.refineContext?.elementId)
      assert.equal(params.content, fixture.name === 'Logo accessory' ? 'https://fixtures.invalid/brand.svg' : '<p>Local semantic content</p>')
      assert.equal(params.semanticRole, fixture.element?.semantic_role ?? (fixture.name === 'Logo accessory' ? undefined : 'BODY_TEXT'))
      assert.equal(params.slotName, fixture.element?.slot_name)
      assert.deepEqual(params.geometry, fixture.geometry)
      assert.equal(params.metadata.generationConfig.prompt, 'Local source')
      if (fixture.name === 'Logo accessory') assert.equal(params.metadata.componentType, 'IMAGE')
      if (fixture.name === 'cited body') assert.equal(params.citationsUsed[0].source_key, 'local-evidence')
    }
    if (fixture.cited) {
      assert.equal(params.componentType, fixture.element.component_type)
      assert.equal(params.replacesElementId, fixture.refineContext?.elementId)
      assert.equal(params.geometry.gridRow, '10/16')
      assert.equal(params.metadata.generationConfig.prompt, 'Local source')
    }
    semanticDispatchChecks++
  }
  // Independently exercise both candidate objects to prove cited precedence in
  // the actual action/argument expressions; no producer recipe is invented.
  const choiceTree = ts.createSourceFile('choice.ts', block, ts.ScriptTarget.Latest, true)
  const actionStatement = choiceTree.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(choiceTree) === 'insertionAction'))
  const responseStatement = choiceTree.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(choiceTree) === 'insertResponse'))
  assert.ok(actionStatement && responseStatement)
  let chosen
  const cited = { elementId: 'cited-local' }, semantic = { elementId: 'semantic-local' }
  await vm.runInNewContext(ts.transpileModule('(async()=>{'+actionStatement.getText(choiceTree)+'\n'+responseStatement.getText(choiceTree)+'})()', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { citedUpsertParams: cited, semanticUpsertParams: semantic, params: { elementId: 'ordinary-local' }, method: 'insertElement', layoutServiceApis: { sendElementCommand: () => {} }, generationLayoutServiceApis: { sendElementCommand: () => {} }, lifecycleMutationId: 'local', index: 0, sendLayoutMutationWithReconciliation: async (_, action, params) => { chosen = { action, params } } })
  assert.equal(chosen.action, 'upsertCitedElement');assert.equal(chosen.params, cited);semanticDispatchChecks++
  for (const behavior of ['timeout', 'pending', 'refusal', 'network', 'failed-receipt', 'ambiguous']) {
    const run = await dispatchCase(block, fixtures[4], behavior)
    assert.equal(run.calls.filter(c => c.action !== 'getElementMutationReceipt').length, 1, 'no duplicate semantic mutation on '+behavior)
    for (const call of run.calls.filter(c => c.action === 'getElementMutationReceipt')) assert.deepEqual(call.params, { mutationId: 'local-owned-attempt:insert:0' })
    if (['timeout', 'pending'].includes(behavior)) { assert.ifError(run.error);assert.equal(run.result.success, true) }
    else { assert.ok(run.error);assert.equal(run.result, undefined);if (behavior === 'ambiguous') assert.equal(run.error.code, 'LAYOUT_MUTATION_AMBIGUOUS');if (['refusal', 'network'].includes(behavior)) assert.equal(run.calls.length, 1) }
    semanticDispatchChecks++
  }
}
await verifySemanticDispatch(generationSource)
assert.equal(semanticDispatchChecks, 18)
for (const [from, to] of [
  [": semanticUpsertParams ? 'upsertSemanticElement'", ": semanticUpsertParams ? 'insertTextBox'"],
  ['(citedUpsertParams ?? semanticUpsertParams ?? params)', '(params)'],
  ['const semanticUpsertParams = buildSemanticUpsertParams(\n          params,\n          effectiveSlideIndex,\n          refineContext?.elementId,', 'const semanticUpsertParams = buildSemanticUpsertParams(\n          params,\n          effectiveSlideIndex,\n          undefined,'],
]) {
  assert.ok(generationSource.includes(from), 'negative probe source must match')
  await assert.rejects(() => verifySemanticDispatch(generationSource.replace(from, to)))
}
console.log('18 actual hook semantic dispatch/reconciliation cases and3 negative probes passed; offline only.')
assert.match(generationSource, /buildSemanticUpsertParams/)
assert.match(clientSource, /citationsUsed/)
assert.match(generationSource, /slot_name:/)

console.log('textbox role and Platinum geometry contract tests passed')
