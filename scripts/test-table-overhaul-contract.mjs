import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(file, requireImplementation = () => ({}), extraContext = {}) {
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
    ...extraContext,
  })
  return mod.exports
}

const clientDependencies = id => {
  if (id === '@/types/textlabs') return {
    INSERTION_METHOD_MAP: { TABLE: 'insertElement' },
    TEXT_LABS_ELEMENT_DEFAULTS: { TABLE: { width: 18, height: 8, zIndex: 1000 } },
  }
  if (id === '@/lib/element-semantic-type') return { semanticTypeForInsertion: value => value }
  if (id === '@/lib/textlabs-theme-metadata') return { resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }) }
  if (id === '@/lib/element-provenance') return { parseThemeVariantSource: () => null, responseStyleOwner: () => 'text_service' }
  throw new Error(`Unexpected client dependency: ${id}`)
}

const client = compile(new URL('../lib/textlabs-client.ts', import.meta.url), clientDependencies)

const baseTable = {
  componentType: 'TABLE',
  prompt: 'Compare cloud providers',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  z_index: 1000,
  tableConfig: { structure_mode: 'AUTO' },
  positionConfig: { start_col: 2, start_row: 4, position_width: 14, position_height: 7, auto_position: false },
}

const autoOptions = client.buildApiPayload('session-table', baseTable).options
assert.deepEqual(JSON.parse(JSON.stringify(autoOptions.tableConfig)), { structure_mode: 'AUTO' })
assert.equal(autoOptions.tableConfig.rows, undefined)
assert.equal(autoOptions.tableConfig.columns, undefined)
assert.equal(autoOptions.tableConfig.column_widths, undefined)
assert.equal(autoOptions.tableConfig.cell_max_chars, undefined)
assert.equal(autoOptions.tableConfig.header_font_size, undefined)

const sparseAutoOptions = client.buildApiPayload('session-table', {
  componentType: 'TABLE',
  prompt: 'Compare cloud providers',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  tableConfig: { structure_mode: 'AUTO' },
}).options
assert.equal(sparseAutoOptions.positionConfig, undefined)
assert.equal(sparseAutoOptions.zIndex, undefined)

const appearanceOptions = client.buildApiPayload('session-table', {
  ...baseTable,
  advancedModified: true,
  tableConfig: {
    structure_mode: 'AUTO',
    stripe_rows: false,
    corners: 'square',
    border_style: 'none',
    header_color: '#4F46E5',
    header_font_color: '#FFFFFF',
    cell_font_color: '#334155',
    row_background: '#FFFFFF',
    row_alt_background: '#F8FAFC',
    first_column_bold: true,
    show_mark_legend: true,
  },
}).options
assert.deepEqual(JSON.parse(JSON.stringify(appearanceOptions.tableConfig)), {
  structure_mode: 'AUTO',
  stripe_rows: false,
  corners: 'square',
  border_style: 'none',
  header_color: '#4F46E5',
  header_font_color: '#FFFFFF',
  cell_font_color: '#334155',
  row_background: '#FFFFFF',
  row_alt_background: '#F8FAFC',
  first_column_bold: true,
  show_mark_legend: true,
})

const manualOptions = client.buildApiPayload('session-table', {
  ...baseTable,
  advancedModified: true,
  tableConfig: {
    structure_mode: 'MANUAL', rows: 5, columns: 4,
    column_brief: [{ index: 1, name: 'Provider', kind: 'label', detail: 'Provider name', target_len: 'short', width_share: 0.3 }],
  },
}).options
assert.equal(manualOptions.tableConfig.rows, 5)
assert.equal(manualOptions.tableConfig.columns, 4)
assert.equal(manualOptions.tableConfig.header_min_chars, undefined)

const insertion = client.buildInsertionParams('TABLE', {
  html: '<table><tbody><tr><td>A</td><td>42<sup data-citation-key="source-a">1</sup></td></tr></tbody></table>',
  component_type: 'TABLE',
  citations_used: [{ source_key: 'source-a' }],
  resolved_table_profile: { rows: 1, columns: 2, structure_mode: 'AUTO', tier: 'compact' },
})
assert.equal(insertion.params.componentType, 'TABLE')
assert.equal(insertion.params.citationsUsed.length, 1)
assert.equal(insertion.params.resolvedTableProfile.rows, 1)

const failedClient = compile(new URL('../lib/textlabs-client.ts', import.meta.url), clientDependencies, {
  fetch: async () => ({
    ok: true,
    json: async () => ({
      success: false,
      response_text: 'Web Search returned no factual findings.',
      error_code: 'WEB_NO_FACTS_RETURNED',
      retryable: true,
    }),
  }),
})
await assert.rejects(
  () => failedClient.sendMessage('session-table', 'Generate researched table', {
    componentType: 'TABLE',
    tableConfig: { structure_mode: 'AUTO' },
  }),
  /Web Search returned no factual findings\./,
)

const formSource = fs.readFileSync(new URL('../components/generation-panel/forms/table-form.tsx', import.meta.url), 'utf8')
const panelSource = fs.readFileSync(new URL('../components/generation-panel/index.tsx', import.meta.url), 'utf8')
const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
const researchSource = fs.readFileSync(new URL('../components/generation-panel/shared/research-controls.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(formSource, /Header Style[\s\S]*mandatory|fieldLabel:\s*['"]Header Style/)
assert.match(formSource, /registerMandatoryConfig\(null\)/)
assert.match(formSource, /Table structure/)
assert.match(formSource, /Manual · \$\{rows\} rows × \$\{columns\} columns/)
assert.match(formSource, /data-testid="table-structure-status"/)
assert.match(formSource, /Header/)
assert.match(formSource, /Stripe/)
assert.match(formSource, /Corners/)
assert.match(formSource, /Border/)
assert.match(formSource, /Table count/)
assert.match(formSource, /Columns & semantics/)
assert.match(formSource, /Column rendering/)
assert.match(formSource, /Totals, alignment & cell marks/)
assert.match(formSource, /Theme & typography/)
assert.match(formSource, /Container padding/)
assert.match(formSource, /Header color/)
assert.match(formSource, /Header text/)
assert.match(formSource, /Cell text/)
assert.match(formSource, /Row bg/)
assert.match(formSource, /Alt row bg/)
assert.match(formSource, /Total fill/)
assert.match(formSource, /Total rule/)
assert.match(formSource, /First col bold/)
assert.match(formSource, /Last col bold/)
assert.match(formSource, /Mark legend/)
assert.match(formSource, /Cell mark style/)
assert.match(formSource, /\{researchControls\}/)
assert.match(formSource, /grid grid-cols-2 gap-2/, 'compact controls retain a two-column responsive grid')
assert.match(formSource, /min-w-0/, 'labels and column controls may shrink instead of overlapping')
assert.match(researchSource, /flex flex-wrap/, 'source checkboxes wrap on narrow panels')
assert.match(researchSource, /<Checkbox/, 'compact source controls use checkboxes')
assert.match(panelSource, /elementType !== 'TABLE'/)
assert.match(panelSource, /elementType === 'TABLE'/)
assert.match(generationSource, /insertionComponentType === 'TABLE'/)
assert.match(
  generationSource,
  /usesCitedUpsert = insertionComponentType === 'TABLE'/,
  'every TABLE insert uses the generalized atomic cited-element path',
)
assert.match(generationSource, /resolvedTableProfile/)
assert.match(generationSource, /150_000/, 'researched table generation timeout allows Researcher bounded retries')
assert.match(formSource, /z_index: zIndexModified \? zIndex : undefined/)
assert.match(formSource, /positionConfig: positionModified \? positionConfig : undefined/)
assert.doesNotMatch(formSource, /chars"[^>]*min=\{1\}/, 'character-limit controls match the backend minimum')

console.log('table sparse Auto/Manual, compact panel, research, and cited-upsert contract tests passed')
