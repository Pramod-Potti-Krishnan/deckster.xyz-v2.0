import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTypeScriptModule(path, stubs = {}) {
  const source = fs.readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    console,
    process,
    fetch,
    setTimeout,
    require: id => {
      if (id in stubs) return stubs[id]
      throw new Error(`Unexpected test import: ${id}`)
    },
  })
  return mod.exports
}

const catalogModule = loadTypeScriptModule(
  new URL('../lib/diagram-catalog.ts', import.meta.url),
)
const catalog = catalogModule.DIAGRAM_CATALOG_FALLBACK

assert.equal(catalog.catalog_version, '2.1.0')
assert.equal(catalog.endpoint_version, '1.11.0')
assert.equal(catalogModule.isCompatibleDiagramCatalog(catalog), true)
assert.equal(catalogModule.isCompatibleDiagramCatalogVersion('2.1.0'), true)
assert.equal(catalogModule.isCompatibleDiagramCatalogVersion('2.9.4'), true)
assert.equal(catalogModule.isCompatibleDiagramCatalogVersion('2.0.99'), false)
assert.equal(catalogModule.isCompatibleDiagramCatalogVersion('3.0.0'), false)
assert.equal(catalogModule.isCompatibleDiagramCatalog({
  ...catalog,
  orchestration: undefined,
}), false)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.geometry)),
  {
    columns: 32,
    rows: 18,
    step: 0.2,
    pixels_per_unit: 60,
    pixels_per_step: 12,
    coordinate_origin: 1,
    end_rule: 'start - 1 + size <= bound',
  },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.map(item => item.type))),
  [
    'CODE_DISPLAY',
    'KANBAN_BOARD',
    'GANTT_CHART',
    'CHEVRON_MATURITY',
    'IDEA_BOARD',
    'CLOUD_ARCHITECTURE',
    'LOGICAL_ARCHITECTURE',
    'DATA_ARCHITECTURE',
    'CUSTOM',
  ],
)
assert.equal(catalog.types.at(-1).experimental, true)
assert.equal(catalog.types.find(item => item.type === 'CODE_DISPLAY').research_capable, false)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'CODE_DISPLAY').config.color_theme.enum)),
  ['github_light', 'github_dark', 'monokai', 'solarized_dark', 'dracula'],
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'CODE_DISPLAY').config.language_mode)),
  {
    type: 'enum',
    enum: ['auto', 'manual', 'legacy'],
    default: 'auto',
    primary: true,
    advanced: false,
  },
)
assert.equal(
  catalog.types.find(item => item.type === 'CODE_DISPLAY').config.language.advanced,
  true,
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'KANBAN_BOARD').config.column_count.enum)),
  [3, 4, 5],
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'GANTT_CHART').config.time_unit.enum)),
  ['days', 'weeks', 'months'],
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'GANTT_CHART').config.task_column_width_px)),
  {
    type: 'integer',
    min: 270,
    max: 405,
    default: 270,
    advanced: true,
    primary: false,
  },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'CHEVRON_MATURITY').config.row_label_width_px)),
  {
    type: 'integer',
    min: 180,
    max: 270,
    default: 180,
    advanced: true,
    primary: false,
  },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalog.types.find(item => item.type === 'CLOUD_ARCHITECTURE').config.provider.enum)),
  ['auto', 'aws', 'gcp', 'azure', 'generic'],
)
assert.equal(
  catalog.types.find(item => item.type === 'CLOUD_ARCHITECTURE').config.provider.omit_when_auto,
  true,
)

assert.deepEqual(
  JSON.parse(JSON.stringify(catalogModule.normalizePersistedDiagramSettings(
    catalog,
    'CODE_DISPLAY',
    { color_theme: 'solarized', language: 'python', theme: 'dark' },
  ))),
  {
    language: 'python',
    color_theme: 'solarized_dark',
    text_size: 'medium',
    show_line_numbers: true,
    show_copy_button: true,
    corner_style: 'rounded',
  },
)
assert.equal(
  catalogModule.normalizePersistedDiagramSettings(
    catalog, 'CODE_DISPLAY', { color_theme: 'nord' },
  ).color_theme,
  'github_dark',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalogModule.normalizePersistedDiagramSettings(
    catalog,
    'GANTT_CHART',
    { time_unit: 'quarters', theme: 'dark' },
  ))),
  { time_unit: 'months' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalogModule.normalizePersistedDiagramSettings(
    catalog,
    'IDEA_BOARD',
    { axis_preset: 'impact_effort', theme: 'minimal' },
  ))),
  { axis_preset: 'effort_value' },
)
assert.equal(
  catalogModule.normalizePersistedDiagramSettings(
    catalog, 'CHEVRON_MATURITY', { num_stages: 9 },
  ).num_stages,
  6,
)
assert.equal(
  catalogModule.normalizePersistedDiagramSettings(
    catalog, 'KANBAN_BOARD', { column_count: 2 },
  ).column_count,
  3,
)
assert.equal(
  catalogModule.normalizePersistedDiagramSubtype('cloud_architecture'),
  'CLOUD_ARCHITECTURE',
)
assert.equal(
  catalogModule.normalizePersistedDiagramSubtype('gantt-chart'),
  'GANTT_CHART',
)
assert.equal(catalogModule.normalizePersistedDiagramSubtype('diagram'), null)
assert.deepEqual(
  JSON.parse(JSON.stringify(catalogModule.normalizePersistedDiagramSettings(
    catalog,
    'CLOUD_ARCHITECTURE',
    { provider: 'AWS', show_layers: false },
  ))),
  { show_layers: false, provider: 'aws' },
)

const source = fs.readFileSync(
  new URL('../components/generation-panel/forms/diagram-form.tsx', import.meta.url),
  'utf8',
)
assert.match(source, /provider !== 'auto' \? \{ provider \} : \{\}/)
assert.match(source, /providerConflictConfirmed/)
assert.match(source, /confirmed_manual_provider: provider/)
assert.match(source, /confirmed_prompt_provider: detectedProvider/)
assert.match(source, /confirmedKey === currentKey/)
assert.match(source, /diagram_generation_config_v1/)
assert.match(source, /const border = palette\.border/)
assert.match(source, /theme_palette: completeDiagramPalette\(themeOverrides\)/)
assert.match(source, /cleared_settings: clearedSettings/)
assert.doesNotMatch(source, /\bsolarized'\b/)
assert.doesNotMatch(source, /\bnord\b/i)
assert.match(source, /subtypeCatalog\.research_capable && researchControls/)
assert.match(source, /columnCount !== null \? \{ column_count: columnCount \} : \{\}/)
assert.match(source, /numStages !== null \? \{ num_stages: numStages \} : \{\}/)
assert.match(source, /columnCount === null \? 'auto' : String\(columnCount\)/)
assert.match(source, /numStages === null \? 'auto' : String\(numStages\)/)
assert.match(source, /settingsOwnerSubtype === 'KANBAN_BOARD' && \(selectionMode === 'auto' \|\| columnCount === null\)/)
assert.match(source, /settingsOwnerSubtype === 'CHEVRON_MATURITY' && \(selectionMode === 'auto' \|\| numStages === null\)/)

const catalogSource = fs.readFileSync(
  new URL('../lib/diagram-catalog.ts', import.meta.url),
  'utf8',
)
assert.match(catalogSource, /input\.column_count !== undefined && input\.column_count !== null/)
assert.match(catalogSource, /input\.num_stages !== undefined && input\.num_stages !== null/)

const semanticModule = loadTypeScriptModule(
  new URL('../lib/element-semantic-type.ts', import.meta.url),
)
assert.equal(semanticModule.normalizeSemanticComponentType('CUSTOM'), 'DIAGRAM')

const insertionMethods = Object.fromEntries(
  catalog.types.map(item => [item.type, 'insertDiagram']),
)
const clientModule = loadTypeScriptModule(
  new URL('../lib/textlabs-client.ts', import.meta.url),
  {
    '@/types/textlabs': {
      INSERTION_METHOD_MAP: { ...insertionMethods, DIAGRAM: 'insertDiagram' },
      TEXT_LABS_ELEMENT_DEFAULTS: { DIAGRAM: { width: 30, height: 14, zIndex: 1000 } },
    },
    '@/lib/element-semantic-type': {
      semanticTypeForInsertion: () => 'DIAGRAM',
    },
    '@/lib/textlabs-theme-metadata': {
      resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }),
    },
    '@/lib/element-provenance': {
      parseThemeVariantSource: value => value ?? null,
      responseStyleOwner: () => 'diagram_generator',
    },
    '@/lib/element-research-policy': {
      isNonResearchVisualElement: () => false,
    },
  },
)

const generationConfig = {
  version: 'diagram_generation_config_v1',
  diagram_type: 'CODE_DISPLAY',
  theme_source: 'deck',
  settings: { color_theme: 'github_light' },
}
const insertion = clientModule.buildInsertionParams('CODE_DISPLAY', {
  html: '<div class="github-light">code</div>',
  generation_config: generationConfig,
  citations_used: [{ source_key: 'code-doc' }],
  grid_position: {
    start_col: 2.2,
    start_row: 4.4,
    position_width: 12.6,
    position_height: 8.2,
  },
})
assert.equal(insertion.method, 'insertDiagram')
assert.equal(insertion.params.gridColumn, '2.2/14.8')
assert.equal(insertion.params.gridRow, '4.4/12.6')
assert.equal(insertion.params.diagramSubtype, 'CODE_DISPLAY')
assert.equal(insertion.params.generationConfig.settings.color_theme, 'github_light')
assert.equal(insertion.params.citationsUsed[0].source_key, 'code-doc')

const apiPayload = clientModule.buildApiPayload('session-1', {
  componentType: 'CODE_DISPLAY',
  prompt: 'Show a Python example',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  z_index: 1000,
  diagramConfig: { language: 'python', color_theme: 'github_light' },
  generationConfig,
})
assert.equal(apiPayload.options.textOnlyMode, false)
assert.equal(apiPayload.options.codeDisplayConfig.color_theme, 'github_light')
assert.equal(apiPayload.options.generationConfig.diagram_type, 'CODE_DISPLAY')
assert.equal(apiPayload.options.generationConfig.theme_source, 'deck')
assert.equal(apiPayload.options.serverSideInsert, false)

console.log('diagram contract tests passed')
