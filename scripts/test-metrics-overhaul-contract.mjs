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
    Date,
    require: requireImplementation,
  })
  return mod.exports
}

const splitter = compile(new URL('../lib/grid-splitter.ts', import.meta.url))
const metricsLayout = compile(new URL('../lib/metrics-layout.ts', import.meta.url), id => {
  if (id === '@/lib/grid-splitter') return splitter
  throw new Error(`Unexpected layout dependency: ${id}`)
})
const metricsCardDesign = compile(new URL('../lib/metrics-card-design.ts', import.meta.url))

const wide = { start_col: 1, start_row: 3, position_width: 28, position_height: 6 }
const tall = { start_col: 4, start_row: 1, position_width: 8, position_height: 16 }
const square = { start_col: 2, start_row: 2, position_width: 12, position_height: 12 }

for (const count of [1, 2, 3, 4]) {
  const wideResult = metricsLayout.resolveMetricsLayout(wide, count, 'auto')
  const tallResult = metricsLayout.resolveMetricsLayout(tall, count, 'auto')
  const squareResult = metricsLayout.resolveMetricsLayout(square, count, 'auto')
  assert.equal(wideResult.boxes.length, count)
  assert.equal(tallResult.boxes.length, count)
  assert.equal(squareResult.boxes.length, count)
  assert.equal(wideResult.viable, true)
  assert.equal(tallResult.viable, true)
  assert.equal(squareResult.viable, true)
  if (count === 1) {
    assert.equal(wideResult.layout, 'horizontal')
    assert.equal(tallResult.layout, 'horizontal')
  } else if (count === 4) {
    assert.equal(wideResult.layout, 'grid')
    assert.equal(tallResult.layout, 'grid')
    assert.equal(squareResult.layout, 'grid')
  } else {
    assert.equal(wideResult.layout, 'horizontal')
    assert.equal(tallResult.layout, 'vertical')
  }
}

for (const layout of ['horizontal', 'vertical', 'grid']) {
  const result = metricsLayout.resolveMetricsLayout(square, 4, layout)
  assert.equal(result.layout, layout)
  assert.equal(result.boxes.length, 4)
  assert.equal(result.viable, true)
}
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsLayout.resolveMetricsLayout({ start_col: 2, start_row: 4, position_width: 25, position_height: 8 }, 3, 'horizontal').boxes.map(box => box.position_width))),
  [8.4, 8.4, 8.2],
)
assert.equal(metricsLayout.isMetricsLayoutViable({ start_col: 2, start_row: 4, position_width: 3, position_height: 3 }, 4, 'grid'), false)

assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch(undefined, 'blue'))),
  { color_scheme: 'solid', color_variant: 'blue' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('accent', 'blue'))),
  { color_scheme: 'accent', color_variant: 'blue' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('solid', 'yellow'))),
  { color_scheme: 'solid', color_variant: 'yellow' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('bordered', 'blue'))),
  { color_scheme: 'bordered', color_variant: 'blue' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('transparent', 'blue'))),
  { color_scheme: 'solid', color_variant: 'blue' },
)
assert.equal(
  metricsCardDesign.METRICS_CARD_COLOR_PRESETS.find(preset => preset.label === 'Gold').name,
  'yellow',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('solid', 'transparent'))),
  { color_scheme: 'transparent' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(metricsCardDesign.resolveMetricsCardColorPatch('transparent', 'auto'))),
  {},
)

const client = compile(new URL('../lib/textlabs-client.ts', import.meta.url), id => {
  if (id === '@/types/textlabs') return {
    INSERTION_METHOD_MAP: { METRICS: 'insertElement', TABLE: 'insertElement' },
    TEXT_LABS_ELEMENT_DEFAULTS: { METRICS: { width: 8, height: 5, zIndex: 1000 }, TEXT_BOX: { width: 10, height: 6, zIndex: 1000 } },
  }
  if (id === '@/lib/element-semantic-type') return { semanticTypeForInsertion: value => value }
  if (id === '@/lib/textlabs-theme-metadata') return { resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }) }
  if (id === '@/lib/element-provenance') return { parseThemeVariantSource: () => null, responseStyleOwner: () => 'text_service' }
  if (id === '@/lib/element-research-policy') return { isNonResearchVisualElement: () => false }
  throw new Error(`Unexpected client dependency: ${id}`)
})

const baseMetrics = {
  componentType: 'METRICS',
  prompt: 'Revenue and margin',
  count: 4,
  layout: 'grid',
  advancedModified: false,
  z_index: 1000,
  multiBoxColorMode: 'SAME',
  metricsFitMode: 'AUTO',
  metricsConfig: { layout: 'grid' },
  compose: true,
  positionConfig: { start_col: 2, start_row: 4, position_width: 24, position_height: 10, auto_position: false },
  elements: splitter.splitGridArea({ start_col: 2, start_row: 4, position_width: 24, position_height: 10 }, 4, 'grid', 2).map(grid_position => ({ grid_position })),
}
const autoOptions = client.buildApiPayload('session-1', baseMetrics).options
assert.equal(autoOptions.metricsFitMode, 'AUTO')
assert.equal(autoOptions.count, 4)
assert.equal(autoOptions.layout, 'grid')
assert.equal(autoOptions.elements.length, 4)
assert.deepEqual(JSON.parse(JSON.stringify(autoOptions.metricsConfig)), { layout: 'grid' })
assert.equal(autoOptions.manualMetricsOverrides, undefined)
assert.equal(autoOptions.paddingConfig, undefined)
assert.equal(autoOptions.multiBoxColorMode, 'SAME')

const multiColorOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  multiBoxColorMode: 'PRIMARY_ACCENTS',
}).options
assert.equal(multiColorOptions.multiBoxColorMode, 'PRIMARY_ACCENTS')

const containerPaddingOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  paddingConfig: { top: 8, right: 12, bottom: 8, left: 12 },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(containerPaddingOptions.paddingConfig)), {
  top: 8,
  right: 12,
  bottom: 8,
  left: 12,
})

const appearanceOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  themeBindings: {
    background: 'accent_1_500',
    accent: 'accent_1_500',
    corner_radius: 'corner_style',
    border_color: 'border_subtle',
    value_font: 'metric_value',
    description_font: 'body',
  },
  metricsConfig: { layout: 'grid', corners: 'square', border: false },
  elements: baseMetrics.elements.map(element => ({
    ...element,
    theme_bindings: {
      background: 'accent_1_500',
      corner_radius: 'corner_style',
      border_color: 'border_subtle',
      value_font: 'metric_value',
    },
  })),
}).options
assert.deepEqual(JSON.parse(JSON.stringify(appearanceOptions.metricsConfig)), { layout: 'grid', corners: 'square', border: false })
assert.equal(appearanceOptions.manualMetricsOverrides, undefined)
assert.deepEqual(JSON.parse(JSON.stringify(appearanceOptions.themeBindings)), {
  background: 'accent_1_500',
  accent: 'accent_1_500',
  value_font: 'metric_value',
  description_font: 'body',
})
assert.deepEqual(JSON.parse(JSON.stringify(appearanceOptions.elements[0].theme_bindings)), {
  background: 'accent_1_500',
  value_font: 'metric_value',
})

const surfaceOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  themeBindings: {
    background: 'accent_1_500',
    accent: 'accent_1_500',
    value_color: 'on_background',
    label_color: 'on_background',
    description_color: 'on_background',
    value_font: 'metric_value',
  },
  metricsConfig: { layout: 'grid', color_scheme: 'transparent' },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(surfaceOptions.themeBindings)), {
  accent: 'accent_1_500',
  value_font: 'metric_value',
})

const namedCardColorOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  metricsConfig: { layout: 'grid', color_scheme: 'solid', color_variant: 'blue' },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(namedCardColorOptions.metricsConfig)), {
  layout: 'grid',
  color_scheme: 'solid',
  color_variant: 'blue',
})

const goldCardColorOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  metricsConfig: { layout: 'grid', color_scheme: 'solid', color_variant: 'yellow' },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(goldCardColorOptions.metricsConfig)), {
  layout: 'grid',
  color_scheme: 'solid',
  color_variant: 'yellow',
})

const typographyOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  metricsFitMode: 'MANUAL',
  themeBindings: { background: 'accent_1_500', value_font: 'metric_value', label_font: 'slide_title' },
  metricsConfig: { layout: 'grid', value_font_size: '52px' },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(typographyOptions.themeBindings)), {
  background: 'accent_1_500',
  label_font: 'slide_title',
})

const manualOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  metricsFitMode: 'MANUAL',
  manualMetricsOverrides: { value_max_chars: 8, padding_px: 14, label_margin_bottom_px: 6 },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(manualOptions.manualMetricsOverrides)), {
  value_max_chars: 8,
  padding_px: 14,
  label_margin_bottom_px: 6,
})

const firstInsertion = client.buildInsertionParams('METRICS', {
  html: '<div class="metric"><strong>42%<sup data-citation-key="source-a">1</sup></strong></div>',
  component_type: 'METRICS',
  citations_used: [{ source_key: 'source-a' }],
  resolved_metrics_profile: { tier: 'regular', padding_px: 14, layout: 'grid' },
  metadata: { metrics_color_variant: '#547ea9' },
})

const emptyManualOptions = client.buildApiPayload('session-1', {
  ...baseMetrics,
  advancedModified: true,
  metricsFitMode: 'MANUAL',
  manualMetricsOverrides: {},
}).options
assert.deepEqual(JSON.parse(JSON.stringify(emptyManualOptions.manualMetricsOverrides)), {})
const secondInsertion = client.buildInsertionParams('METRICS', { html: '<div>17%</div>', component_type: 'METRICS' })
assert.notEqual(firstInsertion.params.elementId, secondInsertion.params.elementId, 'concurrent compose cards receive unique body identities')
assert.equal(firstInsertion.params.componentType, 'METRICS')
assert.equal(firstInsertion.params.citationsUsed[0].source_key, 'source-a')
assert.equal(firstInsertion.params.resolvedMetricsProfile.tier, 'regular')
assert.equal(firstInsertion.params.metricsColorVariant, '#547ea9')
const metricsGenerationConfig = {
  version: 1,
  componentType: 'METRICS',
  prompt: 'Revenue and margin',
  count: 4,
  metricsLayoutChoice: 'grid',
  layout: 'grid',
  multiBoxColorMode: 'PRIMARY_ACCENTS',
  metricsFitMode: 'AUTO',
  metricsConfig: { layout: 'grid' },
  showAdvanced: true,
}
const cachedInsertion = client.buildInsertionParams('METRICS', {
  html: '<div>42%</div>',
  component_type: 'METRICS',
  generation_config: metricsGenerationConfig,
})
assert.deepEqual(JSON.parse(JSON.stringify(cachedInsertion.params.generationConfig)), metricsGenerationConfig)

const formSource = fs.readFileSync(new URL('../components/generation-panel/forms/metrics-form.tsx', import.meta.url), 'utf8')
const researchSource = fs.readFileSync(new URL('../components/generation-panel/shared/research-controls.tsx', import.meta.url), 'utf8')
const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
const routerSource = fs.readFileSync(new URL('../lib/element-command-router.ts', import.meta.url), 'utf8')
const clientSource = fs.readFileSync(new URL('../lib/textlabs-client.ts', import.meta.url), 'utf8')
const toggleRowSource = fs.readFileSync(new URL('../components/generation-panel/shared/toggle-row.tsx', import.meta.url), 'utf8')
const panelSource = fs.readFileSync(new URL('../components/generation-panel/index.tsx', import.meta.url), 'utf8')
const panelHookSource = fs.readFileSync(new URL('../hooks/use-generation-panel.ts', import.meta.url), 'utf8')
const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(formSource, /fieldLabel:\s*['"]Color Scheme/)
assert.match(formSource, /registerMandatoryConfig\(null\)/)
assert.match(formSource, /value: 'gradient', label: 'Gradient'/)
assert.match(formSource, /PRIMARY_SURFACES\.map/)
assert.match(formSource, /ADVANCED_SURFACES\.map/)
assert.match(formSource, /const LIGHT_FONT_COLORS/)
assert.match(formSource, /const DARK_FONT_COLORS/)
assert.match(formSource, /Color presets/)
assert.match(formSource, /METRICS_CARD_COLOR_PRESETS/)
assert.match(formSource, /Card color: Transparent/)
assert.match(formSource, /selectCardColor\('transparent'\)/)
assert.match(formSource, /resolveMetricsCardColorPatch/)
assert.doesNotMatch(formSource, /disabled=\{!surfaceValue\}/)
assert.match(toggleRowSource, /type="button"/)
assert.match(toggleRowSource, /aria-pressed=\{value === option\.value\}/)
assert.match(toggleRowSource, /role="group"/)
assert.match(toggleRowSource, /aria-label=\{label\}/)
assert.match(formSource, /Metric count/)
assert.match(formSource, /Metric layout/)
assert.match(formSource, /Same color — default/)
assert.match(formSource, /Alternating theme colors/)
assert.match(formSource, /Primary color accents/)
assert.match(formSource, /Different theme colors/)
assert.match(formSource, /Auto fit/)
assert.match(formSource, /disabled=\{!fitIsManual\}/)
assert.match(formSource, /readSavedMetricsGenerationConfig/)
assert.match(formSource, /asRecord\(root\.formData\) \?\? root/)
assert.match(formSource, /draftGenerationConfig/)
assert.match(formSource, /savedGenerationConfig/)
assert.match(formSource, /setCount\(saved\?\.count \?\? 1\)/)
assert.match(formSource, /setMultiBoxColorMode\(saved\?\.multiBoxColorMode \?\? 'SAME'\)/)
assert.match(formSource, /sanitizeSavedMetricsConfig/)
assert.match(formSource, /const generationConfig = useMemo/)
assert.match(formSource, /generationConfig,/)
assert.match(formSource, /hasEffectiveVisualOverrides = useMemo/)
assert.match(formSource, /paddingModified && hasContainerPadding/)
assert.match(formSource, /showAdvanced &&/)
for (const section of ['Instances', 'Card Design', 'Value', 'Label', 'Description', 'Spacing & padding', 'Positioning', 'Container Padding']) {
  assert.match(formSource, new RegExp(`title="${section}"`), `restores the ${section} advanced section`)
}
assert.match(formSource, /<PaddingControl/)
assert.match(researchSource, /<Checkbox/)
assert.match(researchSource, /How research context is used/)
assert.match(researchSource, /current slide, then deck context/)
assert.equal((researchSource.match(/<Info /g) ?? []).length, 1, 'Research has one help icon')
assert.doesNotMatch(researchSource, /ResearchSourceSwitch/)
assert.match(generationSource, /\? 'upsertCitedElement'/)
assert.match(generationSource, /sendLayoutMutationWithReconciliation\([\s\S]*insertionAction/)
assert.match(generationSource, /componentType: params\.componentType/)
assert.match(generationSource, /resolvedMetricsProfile/)
assert.match(generationSource, /metricsColorVariant: params\.metricsColorVariant/)
assert.match(generationSource, /resumePanelForElement/)
assert.match(generationSource, /resolveMetricsLayout\([\s\S]*livePosition/)
assert.match(generationSource, /detachMetricsOverrideBindings/)
assert.match(generationSource, /live placeholder is too small/)
assert.match(generationSource, /including a[\s\S]*single card/)
assert.match(routerSource, /'upsertCitedElement'/)
assert.match(clientSource, /metricsFitMode: 'metrics_fit_mode'/)
assert.match(clientSource, /manualMetricsOverrides: 'manual_metrics_overrides'/)
assert.match(clientSource, /options\.multiBoxColorMode = formData\.multiBoxColorMode/)
assert.match(panelSource, /persistedGenerationDraft/)
assert.match(panelSource, /existingTextTarget\?\.generationConfig/)
assert.match(panelSource, /savedFormGenerationConfig\?\.showAdvanced/)
assert.match(panelSource, /<MetricsForm \{\.\.\.commonProps\} researchControls=\{researchControls\} existingTextTarget=\{existingTextTarget\} initialDraft=\{initialDraft\}/)
assert.match(panelHookSource, /setActivationId\(previous => previous \+ 1\)/)
assert.match(panelHookSource, /showAdvancedFromGenerationConfig/)
assert.doesNotMatch(panelHookSource, /reopenPanel|const openPanel =/)
assert.match(builderSource, /features\.useTextLabsGeneration && generationPanel\.isOpen/)
assert.doesNotMatch(builderSource, /generationPanel\.reopenPanel/)
assert.doesNotMatch(generationSource, /falling back to direct panel|generationPanel\.openPanel\(/)

console.log('metrics sparse fit, layout, research, and cited-upsert contract tests passed')
