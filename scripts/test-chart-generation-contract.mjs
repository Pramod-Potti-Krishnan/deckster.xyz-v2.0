import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const moduleCache = new Map()

function moduleUrl(relativePath) {
  return new URL(relativePath, import.meta.url)
}

function loadTypeScriptModule(url) {
  const key = url.href
  if (moduleCache.has(key)) return moduleCache.get(key)
  const compiled = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const mod = { exports: {} }
  moduleCache.set(key, mod.exports)
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    process: { env: {} },
    fetch: () => { throw new Error('Unexpected fetch') },
    FormData,
    require: id => {
      const aliases = {
        '@/types/textlabs': '../types/textlabs.ts',
        '@/lib/element-semantic-type': '../lib/element-semantic-type.ts',
        '@/lib/textlabs-theme-metadata': '../lib/textlabs-theme-metadata.ts',
        '@/lib/element-provenance': '../lib/element-provenance.ts',
        '@/lib/element-research-policy': '../lib/element-research-policy.ts',
      }
      if (!aliases[id]) throw new Error(`Unexpected test import: ${id}`)
      return loadTypeScriptModule(moduleUrl(aliases[id]))
    },
  })
  moduleCache.set(key, mod.exports)
  return mod.exports
}

const {
  buildChartPanelGenerationConfig,
  chartAxisInputMode,
  chartDataTemplate,
  chartDataRequiresAxes,
  mergeChartPanelGenerationConfig,
  normalizeResolvedChartMetadata,
  parseChartDataJson,
  researchedChartRecoveryMessage,
  resolveChartFormDataFromGenerationConfig,
  resolveChartPanelDraft,
  resolveChartSubmissionAxisLabels,
  resolveChartTitleOverride,
  resolveCustomChartAxisLabels,
  synchronizeChartPanelGenerationConfig,
  validateChartData,
} = loadTypeScriptModule(moduleUrl('../lib/chart-data-contract.ts'))
const { buildApiPayload, buildInsertionParams } = loadTypeScriptModule(moduleUrl('../lib/textlabs-client.ts'))
const { resolveDraftThemeSource } = loadTypeScriptModule(moduleUrl('../lib/visual-form-draft.ts'))

const simple = [{ label: 'Q1', value: 100 }, { label: 'Q2', value: 125 }]
const scatter = [{ label: 'A', x: 1, y: 2 }, { label: 'B', x: 3, y: 5 }]
const bubble = [{ label: 'A', x: 1, y: 2, r: 4 }, { label: 'B', x: 3, y: 5, r: 7 }]
const multiSeries = {
  labels: ['Q1', 'Q2'],
  datasets: [
    { label: 'Revenue', data: [100, 125] },
    { label: 'Costs', data: [60, 72] },
  ],
}

for (const data of [simple, scatter, bubble, multiSeries]) {
  const result = validateChartData(data)
  assert.equal(result.valid, true, `canonical chart shape should validate: ${JSON.stringify(data)}`)
}
assert.equal(parseChartDataJson(JSON.stringify(multiSeries)).valid, true, 'labels/datasets JSON is accepted')
assert.equal(chartDataRequiresAxes(scatter), true)
assert.equal(chartDataRequiresAxes(simple), false)
assert.equal(chartAxisInputMode('scatter', scatter), 'required')
assert.equal(chartAxisInputMode('line', simple), 'optional')
assert.equal(chartAxisInputMode('bar_grouped', multiSeries), 'optional')
assert.equal(chartAxisInputMode('auto', null), 'optional', 'Auto exposes optional axis intent in Advanced')
for (const type of ['pie', 'doughnut', 'radar', 'polar_area']) {
  assert.equal(chartAxisInputMode(type, simple), 'hidden', `${type} hides Cartesian axis controls`)
}
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveCustomChartAxisLabels('scatter', scatter, '', ''))),
  {
    requiresAxes: true,
    xAxisLabel: null,
    yAxisLabel: null,
    error: 'Scatter and bubble data require meaningful X-axis and Y-axis labels (for example, Investment and Revenue).',
  },
  'canonical custom x/y data requires user-owned semantics instead of fabricating labels',
)
assert.equal(
  resolveCustomChartAxisLabels('scatter', scatter, 'Revenue', 'Revenue').error,
  'Scatter and bubble data require distinct X-axis and Y-axis labels.',
)
assert.match(
  resolveCustomChartAxisLabels('scatter', scatter, 'X value', 'Y value').error,
  /meaningful axis labels/i,
  'generic UI placeholders are rejected as chart semantics',
)
assert.match(
  resolveCustomChartAxisLabels('scatter', scatter, 'X-axis value', 'Y label').error,
  /meaningful axis labels/i,
  'punctuated generic axis variants are also rejected',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveCustomChartAxisLabels('scatter', scatter, 'Investment', 'Revenue'))),
  {
    requiresAxes: true,
    xAxisLabel: 'Investment',
    yAxisLabel: 'Revenue',
    error: null,
  },
  'custom scatter accepts meaningful distinct axis labels',
)
assert.equal(
  resolveCustomChartAxisLabels('scatter', scatter, 'Revenue ($)', 'Revenue (%)').error,
  null,
  'different units remain valid distinct axis semantics',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveCustomChartAxisLabels('line', simple, 'Quarter', 'Revenue'))),
  {
    requiresAxes: false,
    xAxisLabel: 'Quarter',
    yAxisLabel: 'Revenue',
    error: null,
  },
  'category Cartesian data preserves optional meaningful axes',
)
assert.equal(
  resolveCustomChartAxisLabels('line', simple, '', '').error,
  null,
  'category Cartesian axes remain optional',
)
assert.equal(
  resolveCustomChartAxisLabels('line', simple, 'Revenue', 'Revenue').error,
  'X-axis and Y-axis labels must be distinct.',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveCustomChartAxisLabels('bar_grouped', multiSeries, '', 'Revenue ($)'))),
  {
    requiresAxes: false,
    xAxisLabel: null,
    yAxisLabel: 'Revenue ($)',
    error: null,
  },
  'multi-series Cartesian data allows either optional axis label',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveCustomChartAxisLabels('doughnut', simple, 'Segment', 'Share'))),
  {
    requiresAxes: false,
    xAxisLabel: null,
    yAxisLabel: null,
    error: null,
  },
  'part-to-whole charts never serialize Cartesian axes',
)
for (const mode of ['auto', 'illustrative']) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(resolveChartSubmissionAxisLabels(mode, 'scatter', scatter, 'Investment', 'Revenue'))),
    {
      requiresAxes: false,
      xAxisLabel: null,
      yAxisLabel: null,
      error: null,
    },
    `${mode} submissions cannot leak custom axis labels`,
  )
}
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveChartSubmissionAxisLabels('custom', 'bubble', bubble, 'Investment', 'Revenue'))),
  {
    requiresAxes: true,
    xAxisLabel: 'Investment',
    yAxisLabel: 'Revenue',
    error: null,
  },
  'custom bubble submissions preserve meaningful axes',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveChartSubmissionAxisLabels(
    'custom',
    'bubble',
    bubble,
    '',
    '',
    'auto',
  ))),
  {
    requiresAxes: false,
    xAxisLabel: null,
    yAxisLabel: null,
    error: null,
  },
  'Auto axis semantics defer custom scatter/bubble meaning to Text Labs',
)
assert.equal(resolveChartTitleOverride('auto', 'stale custom title').chartTitle, null)
assert.match(resolveChartTitleOverride('custom', '').error, /chart heading/i)
assert.equal(resolveChartTitleOverride('custom', '  Revenue Growth  ').chartTitle, 'Revenue Growth')
assert.match(
  resolveChartSubmissionAxisLabels('auto', 'line', null, '', '', 'custom').error,
  /at least one meaningful axis label/i,
  'an explicit Custom axis mode cannot masquerade as an empty Auto request',
)
assert.equal(
  resolveChartSubmissionAxisLabels('custom', 'line', simple, '', '').error,
  null,
  'legacy callers without an explicit metadata mode retain optional blank category axes',
)

const hydratedDraft = resolveChartPanelDraft({
  componentType: 'CHART',
  prompt: 'Compare quarterly performance',
  count: 1,
  layout: 'horizontal',
  advancedModified: true,
  z_index: 42,
  useDeckTheme: false,
  chartConfig: {
    chart_type: 'bar_grouped',
    requested_data_source_mode: 'custom',
    requested_title_mode: 'custom',
    requested_axis_label_mode: 'custom',
    include_insights: true,
    series_names: ['Revenue', 'Costs'],
    placeholder_mode: false,
    data: multiSeries,
    chart_title: 'Regional Revenue',
    x_axis_label: 'Quarter',
    y_axis_label: 'USD millions',
    color_mode: 'same',
  },
  positionConfig: {
    start_col: 4,
    start_row: 5,
    position_width: 18,
    position_height: 9,
    auto_position: false,
  },
  generationConfig: {
    customDataInput: '{ "labels": ["Q1", "Q2"], "datasets": [] }',
  },
})
assert.equal(hydratedDraft.chartType, 'bar_grouped')
assert.equal(hydratedDraft.dataSource, 'custom')
assert.equal(hydratedDraft.customDataInput, '{ "labels": ["Q1", "Q2"], "datasets": [] }')
assert.equal(hydratedDraft.titleMode, 'custom')
assert.equal(hydratedDraft.chartTitle, 'Regional Revenue')
assert.equal(hydratedDraft.axisLabelMode, 'custom')
assert.equal(hydratedDraft.xAxisLabel, 'Quarter')
assert.equal(hydratedDraft.yAxisLabel, 'USD millions')
assert.equal(hydratedDraft.includeInsights, true)
assert.equal(hydratedDraft.seriesNamesInput, 'Revenue, Costs')
assert.equal(hydratedDraft.advancedModified, true)
assert.equal(hydratedDraft.zIndex, 42)
assert.equal(hydratedDraft.positionConfig.auto_position, false)
assert.equal(hydratedDraft.preservedChartConfig.color_mode, 'same')
const persistedPanelConfig = buildChartPanelGenerationConfig({
  componentType: 'CHART',
  prompt: 'Restore this chart',
  count: 1,
  layout: 'horizontal',
  advancedModified: true,
  chartConfig: {
    chart_type: 'scatter',
    requested_data_source_mode: 'custom',
    requested_title_mode: 'custom',
    requested_axis_label_mode: 'custom',
    include_insights: true,
    series_names: [],
    placeholder_mode: false,
    data: scatter,
    chart_title: 'Investment vs Revenue',
    x_axis_label: 'Investment',
    y_axis_label: 'Revenue',
  },
}, '[{"x":1,"y":2},{"x":3,"y":4}]', true)
assert.equal(persistedPanelConfig.customDataInput, '[{"x":1,"y":2},{"x":3,"y":4}]')
assert.equal(persistedPanelConfig.formData.chartConfig.x_axis_label, 'Investment')
assert.equal(persistedPanelConfig.formData.chartConfig.chart_title, 'Investment vs Revenue')
assert.equal(persistedPanelConfig.formData.generationConfig.customDataInput, persistedPanelConfig.customDataInput)
assert.equal(
  persistedPanelConfig.formData.generationConfig.formData,
  undefined,
  'persisted form snapshot stops after one generationConfig level',
)
assert.doesNotThrow(
  () => JSON.stringify(persistedPanelConfig),
  'persisted chart draft remains serializable',
)
const synchronizedPanelConfig = synchronizeChartPanelGenerationConfig(
  persistedPanelConfig,
  {
    ...persistedPanelConfig.formData,
    useDeckTheme: false,
    themeOverrides: {
      primary: '#4F46E5',
      secondary: '#64748B',
      surface: '#F8FAFC',
      border: '#CBD5E1',
      accents: ['#4F46E5', '#0284C7'],
      text: '#0F172A',
      background: '#FFFFFF',
    },
    positionConfig: {
      start_col: 7,
      start_row: 8,
      position_width: 12,
      position_height: 6,
      auto_position: false,
    },
  },
)
assert.equal(synchronizedPanelConfig.formData.useDeckTheme, false)
assert.equal(synchronizedPanelConfig.formData.themeOverrides.primary, '#4F46E5')
assert.equal(synchronizedPanelConfig.formData.positionConfig.start_col, 7)
assert.equal(synchronizedPanelConfig.formData.chartConfig.x_axis_label, 'Investment')
assert.equal(
  resolveDraftThemeSource('presentation-1', synchronizedPanelConfig.formData).mode,
  'another',
  'reopening a neutral-fallback chart hydrates its authoritative fallback theme instead of the stale deck theme',
)
assert.equal(
  synchronizedPanelConfig.formData.generationConfig.formData,
  undefined,
  'runtime synchronization keeps the chart reopen snapshot nonrecursive',
)
assert.doesNotThrow(() => JSON.stringify(synchronizedPanelConfig))
const resolvedMetadata = normalizeResolvedChartMetadata({
  title: 'Investment Efficiency',
  x_axis: 'Investment ($m)',
  y_axis: 'Revenue ($m)',
  metric: 'Revenue',
  unit: '$m',
  value_format: 'currency',
  title_mode: 'auto',
  axis_label_mode: 'auto',
  resolution_source: 'deterministic',
  confidence: 0.93,
})
assert.equal(resolvedMetadata.title, 'Investment Efficiency')
const partialResolvedMetadata = normalizeResolvedChartMetadata({
  title: 'Legacy saved title',
  x_axis: 'Month',
  y_axis: 'Revenue',
})
assert.equal(partialResolvedMetadata.title, 'Legacy saved title')
assert.equal(partialResolvedMetadata.resolution_source, 'fallback')
assert.equal(partialResolvedMetadata.confidence, 0)
const flatSavedChart = resolveChartFormDataFromGenerationConfig({
  prompt: 'Monthly recurring revenue',
  chart_type: 'line',
  requested_data_source_mode: 'custom',
  requested_title_mode: 'auto',
  requested_axis_label_mode: 'custom',
  data: simple,
  x_axis_label: 'Quarter',
  y_axis_label: 'Revenue ($k)',
  include_insights: true,
  showAdvanced: true,
  resolved_chart_metadata: partialResolvedMetadata,
})
assert.equal(flatSavedChart.componentType, 'CHART')
assert.equal(flatSavedChart.prompt, 'Monthly recurring revenue')
assert.equal(flatSavedChart.chartConfig.chart_type, 'line')
assert.equal(flatSavedChart.chartConfig.requested_data_source_mode, 'custom')
assert.equal(flatSavedChart.chartConfig.requested_title_mode, 'auto')
assert.equal(flatSavedChart.chartConfig.requested_axis_label_mode, 'custom')
assert.deepEqual(JSON.parse(JSON.stringify(flatSavedChart.chartConfig.data)), simple)
assert.equal(flatSavedChart.generationConfig.resolved_chart_metadata.title, 'Legacy saved title')
const mergedPanelConfig = mergeChartPanelGenerationConfig(
  persistedPanelConfig,
  {
    renderer: 'chartjs',
    formData: {
      componentType: 'CHART',
      chartConfig: { chart_type: 'line', chart_title: 'backend rewrite' },
    },
  },
  resolvedMetadata,
)
assert.equal(mergedPanelConfig.renderer, 'chartjs', 'renderer-owned generation details are retained')
assert.equal(
  mergedPanelConfig.formData.chartConfig.chart_type,
  'scatter',
  'submitted user controls win when hydrating Refine',
)
assert.equal(mergedPanelConfig.formData.chartConfig.chart_title, 'Investment vs Revenue')
assert.equal(mergedPanelConfig.resolved_chart_metadata.title, 'Investment Efficiency')
assert.equal(
  mergedPanelConfig.formData.generationConfig.resolved_chart_metadata.x_axis,
  'Investment ($m)',
)
assert.doesNotThrow(() => JSON.stringify(mergedPanelConfig))
assert.equal(validateChartData([{ x: 1, y: 2, r: 0 }]).valid, false, 'bubble radii must be positive')
assert.equal(validateChartData([{ label: 'Only', value: 1 }]).valid, false, 'canonical charts require at least two points')
assert.equal(validateChartData([{ x: 1, y: 2 }]).valid, false, 'scatter charts require at least two points')
assert.equal(validateChartData({ labels: ['Q1'], datasets: [{ label: 'Revenue', data: [1, 2] }] }).valid, false)
assert.equal(parseChartDataJson('{ broken').valid, false)
assert.match(researchedChartRecoveryMessage('No comparable values found.'), /Data Source → Illustrative/)
assert.match(chartDataTemplate('waterfall'), /"label"/)
assert.doesNotMatch(chartDataTemplate('waterfall'), /"datasets"/)

assert.doesNotMatch(
  [chartDataTemplate('auto'), chartDataTemplate('doughnut')].join('\n'),
  /\b(?:DMT|Slide|Title|Subtitle|IMAGE|Logo|Content|Footer)\b/i,
  'frontend templates never seed slide-shell labels',
)

function chartForm(chartType, requestedDataSourceMode, data = null, researchMode = 'off') {
  const needsAxes = Array.isArray(data) && data.every(point => point && typeof point === 'object' && 'x' in point && 'y' in point)
  return {
    componentType: 'CHART',
    prompt: 'Show the requested comparison',
    count: 1,
    layout: 'horizontal',
    advancedModified: false,
    z_index: 10,
    chartConfig: {
      chart_type: chartType,
      requested_data_source_mode: requestedDataSourceMode,
      requested_title_mode: 'auto',
      requested_axis_label_mode: needsAxes ? 'custom' : 'auto',
      include_insights: false,
      series_names: [],
      placeholder_mode: false,
      data,
      x_axis_label: needsAxes ? 'Investment' : null,
      y_axis_label: needsAxes ? 'Revenue' : null,
    },
    research: { mode: researchMode, web: researchMode === 'on' },
    positionConfig: {
      start_col: 2,
      start_row: 4,
      position_width: 20,
      position_height: 10,
      auto_position: false,
    },
  }
}

for (const [chartType, mode, data, research] of [
  ['auto', 'auto', null, 'on'],
  ['auto', 'auto', null, 'off'],
  ['doughnut', 'auto', null, 'on'],
  ['line', 'auto', null, 'off'],
  ['bar_grouped', 'auto', null, 'off'],
  ['bar_stacked', 'auto', null, 'off'],
  ['scatter', 'custom', scatter, 'off'],
  ['bubble', 'custom', bubble, 'off'],
  ['pie', 'custom', simple, 'off'],
  ['bar_grouped', 'custom', multiSeries, 'off'],
  ['bar_vertical', 'illustrative', null, 'off'],
]) {
  const { options } = buildApiPayload('session-1', chartForm(chartType, mode, data, research))
  assert.equal(options.chartConfig.chart_type, chartType)
  assert.equal(options.chartConfig.requested_data_source_mode, mode)
  assert.equal(options.chartConfig.requested_title_mode, 'auto')
  assert.equal(options.chartConfig.requested_axis_label_mode, ['scatter', 'bubble'].includes(chartType) ? 'custom' : 'auto')
  assert.deepEqual(JSON.parse(JSON.stringify(options.chartConfig.data)), data)
  if (['scatter', 'bubble'].includes(chartType)) {
    assert.equal(options.chartConfig.x_axis_label, 'Investment')
    assert.equal(options.chartConfig.y_axis_label, 'Revenue')
  }
  assert.equal(options.research.mode, research)
}

const citation = { source_key: 'source-1', title: 'Annual Report', url: 'https://example.com/report' }
const insertion = buildInsertionParams('CHART', {
  element_id: 'chart-persisted-id',
  html: '<canvas id="chart"></canvas>',
  grid_position: { start_col: 7.2, start_row: 5.4, position_width: 18.6, position_height: 9.2 },
  requested_data_source_mode: 'auto',
  resolved_chart_metadata: resolvedMetadata,
  source_provenance: 'research_sourced',
  source_citation: citation,
  research_provenance: { source_count: 1 },
  citations_used: [citation],
}, {
  start_col: 2,
  start_row: 4,
  position_width: 20,
  position_height: 10,
  auto_position: false,
}, undefined, 10, 3)

assert.equal(insertion.method, 'insertChart')
assert.equal(insertion.params.elementId, 'chart-persisted-id', 'Analytics chart ID remains authoritative for editing and persistence')
assert.equal(insertion.params.gridColumn, '7.2/25.8', 'authoritative live element geometry wins over form defaults')
assert.equal(insertion.params.gridRow, '5.4/14.6')
assert.equal(insertion.params.sourceProvenance, 'research_sourced')
assert.equal(insertion.params.requestedDataSourceMode, 'auto')
assert.equal(insertion.params.resolvedChartMetadata.title, 'Investment Efficiency')
assert.deepEqual(JSON.parse(JSON.stringify(insertion.params.sourceCitation)), citation)
assert.deepEqual(JSON.parse(JSON.stringify(insertion.params.citationsUsed)), [citation])
assert.deepEqual(JSON.parse(JSON.stringify(insertion.params.researchProvenance)), { source_count: 1 })

for (const provenance of ['illustrative', 'user_provided']) {
  const ungrounded = buildInsertionParams('CHART', {
    html: '<canvas></canvas>',
    source_provenance: provenance,
  })
  assert.equal(ungrounded.params.sourceProvenance, provenance)
  assert.equal(ungrounded.params.citationsUsed, undefined, `${provenance} data does not invent Sources entries`)
}

const chartFormSource = fs.readFileSync(moduleUrl('../components/generation-panel/forms/chart-form.tsx'), 'utf8')
const generationSource = fs.readFileSync(moduleUrl('../hooks/use-textlabs-generation.ts'), 'utf8')
const generationPanelHookSource = fs.readFileSync(moduleUrl('../hooks/use-generation-panel.ts'), 'utf8')
const panelSource = fs.readFileSync(moduleUrl('../components/generation-panel/index.tsx'), 'utf8')
const chartFormCompilation = ts.transpileModule(chartFormSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  reportDiagnostics: true,
})
assert.deepEqual(
  chartFormCompilation.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ?? [],
  [],
  'chart form remains syntactically valid TSX',
)
assert.match(chartFormSource, /aria-label="Chart Type"/)
for (const group of [
  'Recommended', 'Basic', 'Correlation', 'Radial', 'Time Series', 'Comparison', 'Financial',
]) assert.match(chartFormSource, new RegExp(`group: '${group}'`), `${group} chart group is visible`)
for (const chartType of [
  'auto', 'line', 'bar_vertical', 'bar_horizontal', 'pie', 'doughnut',
  'scatter', 'bubble', 'radar', 'polar_area', 'area', 'area_stacked',
  'bar_grouped', 'bar_stacked', 'waterfall',
]) assert.match(chartFormSource, new RegExp(`value: '${chartType}'`), `${chartType} is visible in the selector`)
assert.doesNotMatch(chartFormSource, /Content Source/)
assert.match(chartFormSource, /customRender:/, 'the grouped chart selector renders in the chat toolbar')
assert.match(chartFormSource, /<PositionPresets/, 'advanced chart settings restore full position controls')
assert.match(chartFormSource, /CollapsibleSection title="Position"/)
assert.match(chartFormSource, /auto_position: true/, 'chart positioning defaults to the live canvas')
assert.match(chartFormSource, /if \(!previous\.auto_position\) return previous/, 'canvas refreshes cannot reset an explicit Manual position')
assert.match(chartFormSource, /next\.auto_position[\s\S]*liveStartCol !== undefined/, 'returning to Auto restores live canvas geometry in the controls')
assert.match(panelSource, /elementContext && elementType !== 'CHART'/, 'the redundant chart position banner does not displace the chat controls')
assert.match(chartFormSource, /X-axis label/)
assert.match(chartFormSource, /Y-axis label/)
assert.match(chartFormSource, /Chart heading/)
assert.match(chartFormSource, /Axis labels/)
assert.match(chartFormSource, /requested_title_mode/)
assert.match(chartFormSource, /requested_axis_label_mode/)
assert.match(chartFormSource, /titleMode === 'custom'/)
assert.match(chartFormSource, /axisLabelMode === 'custom'/)
assert.match(chartFormSource, /Ambiguous scatter or bubble semantics return a recoverable error/)
assert.match(chartFormSource, /resolveChartSubmissionAxisLabels/)
assert.doesNotMatch(chartFormSource, /setXAxisLabel\(current => current\.trim\(\) \|\| 'X value'\)/)
assert.doesNotMatch(chartFormSource, /setYAxisLabel\(current => current\.trim\(\) \|\| 'Y value'\)/)
assert.match(chartFormSource, /initialDraft\?: GenerationPanelDraft/)
assert.match(chartFormSource, /resolveChartPanelDraft\(initialFormData\)/)
assert.match(chartFormSource, /onDraftChange\?\.\(\{ formData: draftFormData \}\)/)
assert.match(chartFormSource, /buildChartPanelGenerationConfig\([\s\S]*baseFormData,[\s\S]*customDataInput,[\s\S]*showAdvanced/)
assert.doesNotMatch(
  chartFormSource,
  /\[elementContext\?\.elementId\]/,
  'placeholder ID remaps within one activation never clear chart retry state',
)
assert.match(
  panelSource,
  /<ChartForm \{\.\.\.commonProps\} initialDraft=\{initialDraft\} onDraftChange=\{onDraftChange\}/,
  'ChartForm participates in the panel draft hydration lifecycle',
)
assert.match(
  panelSource,
  /elementType === 'CHART'[\s\S]*resolveChartFormDataFromGenerationConfig\(savedConfig\)/,
  'flat Layout chart snapshots are upgraded into a complete refine draft after reload',
)
const resumePanelLifecycle = generationPanelHookSource.slice(
  generationPanelHookSource.indexOf('const resumePanelForElement'),
  generationPanelHookSource.indexOf('/** Open panel in edit mode'),
)
assert.match(resumePanelLifecycle, /draftsRef\.current\.set\(nextDraftKey, draft\)/)
assert.match(resumePanelLifecycle, /setDraftKey\(nextDraftKey\)/)
assert.doesNotMatch(
  resumePanelLifecycle,
  /setActivationId/,
  'placeholder remaps keep the mounted ChartForm and its retry state',
)
assert.match(chartFormSource, /axisInputMode !== 'hidden'/)
assert.match(chartFormSource, /axisInputMode === 'required'/)
assert.match(
  chartFormSource,
  /temporary mode switch[\s\S]*independent Axis labels control decides/,
  'data-source changes preserve axis drafts while the explicit Auto/Custom mode owns submission',
)
assert.match(
  chartFormSource,
  /previous\.start_col === liveStartCol[\s\S]*return previous/,
  'unchanged live geometry must not churn persisted chart drafts',
)
assert.doesNotMatch(
  chartFormSource,
  /useEffect\(\(\) => \{[\s\S]*setPositionConfig[\s\S]*\}, \[elementContext\]\)/,
  'draft persistence must not depend on an unstable elementContext object identity',
)
assert.match(chartFormSource, /placeholder="e\.g\., Investment"/)
assert.match(chartFormSource, /placeholder="e\.g\., Revenue"/)
assert.match(generationSource, /const manuallyPositionedChart = formData\.componentType === 'CHART'/)
assert.match(generationSource, /manuallyPositionedChart && formData\.positionConfig \? \{/)
assert.match(generationSource, /\} : currentBlankInfo && formData\.count <= 1 \? \{/, 'Auto still preserves dragged placeholder geometry')
assert.match(generationSource, /source_provenance: element\.source_provenance \?\? response\.source_provenance/)
assert.match(generationSource, /mergeChartPanelGenerationConfig/)
assert.match(generationSource, /resolved_chart_metadata: resolvedChartMetadata/)
assert.match(
  generationSource,
  /element\.metadata\?\.generation_config[\s\S]*response\.generationConfig/,
  'renderer-owned generation metadata is retained from every supported response alias',
)
assert.match(generationSource, /researchedChartRecoveryMessage/)
const synchronizeDraftIndex = generationSource.indexOf('synchronizeChartPanelGenerationConfig(')
const buildPayloadIndex = generationSource.indexOf('buildApiPayload(sessionId, formData)')
assert.ok(synchronizeDraftIndex >= 0, 'chart runtime synchronizes its persisted panel snapshot')
assert.ok(
  synchronizeDraftIndex < buildPayloadIndex,
  'chart snapshot synchronization occurs before the request and Layout persistence',
)
assert.match(generationSource, /method === 'insertChart'/)
assert.match(generationSource, /insertedElementId === refineContext\.elementId/)
assert.match(generationSource, /refineElementDeleted = true/)

console.log('chart generation contract tests passed')
