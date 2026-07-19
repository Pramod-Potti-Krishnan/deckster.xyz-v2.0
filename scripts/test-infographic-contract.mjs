import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(file, requireImplementation = () => ({}), globals = {}) {
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
    ...globals,
  })
  return mod.exports
}

const configModule = compile(new URL('../lib/infographic-config.ts', import.meta.url))
const geometry = { start_col: 2, start_row: 4, width: 16, height: 9 }

const automatic = configModule.buildSparseInfographicConfig({ mode: 'v2', geometry })
assert.deepEqual(
  JSON.parse(JSON.stringify(automatic)),
  {
    mode: 'v2',
    grid_row: '4/13',
    grid_column: '2/18',
    start_col: 2,
    start_row: 4,
    width: 16,
    height: 9,
  },
  'automatic structured requests contain routing intent and geometry only',
)
assert.doesNotMatch(JSON.stringify(automatic), /auto/i)
assert.equal(automatic.segments, undefined)
assert.equal(automatic.segment_count, undefined)
assert.equal(automatic.content_mode, undefined)

for (const count of [2, 3, 4, 5, 6, 7, 8]) {
  const counted = configModule.buildSparseInfographicConfig({
    mode: 'v2',
    geometry,
    segmentCount: count,
  })
  assert.equal(counted.segment_count, count)
  assert.equal(counted.segments, undefined)
}

const manualSegments = [
  { label: 'Hypothesis', sublabel: 'Frame a testable question', description: 'Define the proposed mechanism.', icon_hint: 'lightbulb' },
  { label: 'Validation', sublabel: 'Test before human use', description: 'Evaluate preclinical evidence.', icon_hint: 'microscope' },
]
assert.equal(configModule.validateManualInfographicSegments(manualSegments), null)
const manual = configModule.buildSparseInfographicConfig({
  mode: 'v2',
  geometry,
  segmentCount: 8,
  contentMode: 'manual',
  manualSegments,
})
assert.equal(manual.content_mode, 'manual')
assert.equal(manual.segment_count, undefined, 'manual content takes precedence over explicit count')
assert.deepEqual(JSON.parse(JSON.stringify(manual.segments)), manualSegments)
assert.match(
  configModule.validateManualInfographicSegments([
    { label: 'Segment 1', sublabel: 'Generic', icon_hint: 'circle' },
    manualSegments[1],
  ]),
  /meaningful heading/,
)
assert.match(
  configModule.validateManualInfographicSegments([
    manualSegments[0],
    { ...manualSegments[0] },
  ]),
  /unique/,
)
assert.match(
  configModule.validateManualInfographicSegments([
    { label: 'One', sublabel: 'Only one', icon_hint: 'one' },
  ]),
  /between 2 and 8/,
)
assert.match(
  configModule.validateManualInfographicSegments([
    { label: 'One', sublabel: 'Useful line', description: '', icon_hint: 'one' },
    manualSegments[1],
  ]),
  /supporting description/,
)
assert.match(
  configModule.validateManualInfographicSegments([
    manualSegments[0],
    { ...manualSegments[1], icon_hint: manualSegments[0].icon_hint },
  ]),
  /icon hints must be unique/,
)
assert.match(
  configModule.validateManualInfographicSegments([
    { ...manualSegments[0], icon_hint: 'microscope icon' },
    { ...manualSegments[1], icon_hint: 'icon microscope symbol' },
  ]),
  /icon hints must be unique/,
)

assert.equal(configModule.inferExistingInfographicMode({ rendererType: 'diagram' }), 'v2')
assert.equal(configModule.inferExistingInfographicMode({ rendererType: 'image' }), 'v1')
assert.equal(
  configModule.inferExistingInfographicMode({ rendererType: 'image', content: '<img src="data:image/png;base64,abc">' }),
  'v1',
)
assert.equal(
  configModule.inferExistingInfographicMode({ content: '<img src="https://example.test/creative.png">' }),
  'v1',
)
assert.equal(
  configModule.inferExistingInfographicMode({ metadata: { renderer: 'v1' }, content: '<section>Wrapper</section>' }),
  'v1',
)
assert.equal(
  configModule.inferExistingInfographicMode({ metadata: { renderer: 'html_v2' } }),
  'v2',
)
assert.equal(configModule.inferExistingInfographicMode({ content: '<section>Structured</section>' }), 'v2')
assert.equal(
  configModule.inferExistingInfographicMode({ rendererType: 'image', metadata: { generation_mode: 'v2' } }),
  'v2',
)
assert.equal(
  configModule.inferExistingInfographicMode({
    rendererType: 'image',
    generationConfig: {
      mode: 'v2',
      infographic: { mode: 'v2' },
    },
  }),
  'v2',
  'persisted infographic generation config outranks stale renderer metadata',
)

let multipartRequest
let chatResponsePayload
const clientModule = compile(
  new URL('../lib/textlabs-client.ts', import.meta.url),
  id => {
    if (id === '@/types/textlabs') return {
      INSERTION_METHOD_MAP: { INFOGRAPHIC: 'insertImage' },
      TEXT_LABS_ELEMENT_DEFAULTS: {
        INFOGRAPHIC: { width: 16, height: 9, zIndex: 1000 },
      },
    }
    if (id === '@/lib/element-semantic-type') return {
      semanticTypeForInsertion: value => value,
    }
    if (id === '@/lib/textlabs-theme-metadata') return {
      resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }),
    }
    if (id === '@/lib/element-provenance') return {
      parseThemeVariantSource: () => null,
      responseStyleOwner: () => null,
    }
    if (id === '@/lib/element-research-policy') return {
      isNonResearchVisualElement: componentType => componentType === 'INFOGRAPHIC',
    }
    throw new Error(`Unexpected dependency: ${id}`)
  },
  {
    FormData,
    fetch: async (url, request) => {
      if (String(url).includes('/api/chat/message')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => chatResponsePayload,
        }
      }
      multipartRequest = { url, request }
      return { ok: true, json: async () => ({ success: true }) }
    },
  },
)

const staleResearchForm = {
  componentType: 'INFOGRAPHIC',
  prompt: 'Five-stage clinical research process',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  z_index: 1000,
  infographicConfig: automatic,
  research: {
    mode: 'on',
    web: true,
    uploaded_docs: true,
    use_knowledge_graph: true,
  },
}
const apiPayload = clientModule.buildApiPayload('session-1', staleResearchForm).options
assert.equal(apiPayload.research, undefined, 'stale INFOGRAPHIC research state is omitted')
assert.equal(apiPayload.infographicConfig.mode, 'v2', 'mode travels without Advanced overrides')
assert.equal(apiPayload.infographicConfig.segments, undefined)
const infographicRefinePayload = clientModule.buildApiPayload('session-1', {
  ...staleResearchForm,
  refine: true,
  generationConfig: {
    mode: 'v2',
    infographic: { mode: 'v2' },
  },
  existingElement: {
    component_type: 'INFOGRAPHIC',
    generation_config: {
      mode: 'v2',
      infographic: { mode: 'v2' },
    },
  },
}).options
assert.equal(
  infographicRefinePayload.generationConfig,
  undefined,
  'infographic metadata must not enter the strict diagram generation_config field',
)
assert.equal(
  infographicRefinePayload.existingElement.generation_config.mode,
  'v2',
)

await clientModule.generateInfographic(
  'session-1',
  'Recreate this infographic',
  new Blob(['image'], { type: 'image/png' }),
  { mode: 'v1', ...geometry },
  {
    presentationId: 'presentation-1',
    generationContext: { generation_intent: { user_prompt: 'exact prompt' } },
  },
)
assert.equal(multipartRequest.request.body.get('research'), null)
assert.equal(JSON.parse(multipartRequest.request.body.get('infographic_config')).mode, 'v1')

const structuredInsertion = clientModule.buildInsertionParams('INFOGRAPHIC', {
  component_type: 'INFOGRAPHIC',
  mode: 'v2',
  html: '<section>Structured</section>',
  metadata: {
    structured_plan: { segment_count: 5 },
  },
  generation_config: {
    version: 'infographic_generation_config_v1',
    mode: 'v2',
    infographic: {
      mode: 'v2',
      structured_plan: {
        segment_count: 5,
        segments: manualSegments,
      },
    },
  },
})
assert.equal(structuredInsertion.method, 'insertDiagram')
assert.equal(structuredInsertion.params.htmlContent, '<section>Structured</section>')
assert.deepEqual(
  JSON.parse(JSON.stringify(structuredInsertion.params.structuredPlan)),
  { segment_count: 5 },
)
assert.equal(structuredInsertion.params.generationConfig.mode, 'v2')
assert.equal(
  structuredInsertion.params.generationConfig.infographic.structured_plan.segments.length,
  2,
)
const requestError = new clientModule.TextLabsRequestError('safe failure', {
  kind: 'application',
  errorCode: 'STRUCTURED_INFOGRAPHIC_PLANNING_FAILED',
  retryable: true,
  retryStrategy: 'start_fresh_attempt',
})
assert.equal(requestError.errorCode, 'STRUCTURED_INFOGRAPHIC_PLANNING_FAILED')
assert.equal(requestError.retryStrategy, 'start_fresh_attempt')
chatResponsePayload = {
  success: false,
  error: "We couldn't create reliable infographic content. Nothing was added.",
  error_code: 'STRUCTURED_INFOGRAPHIC_PLANNING_FAILED',
  retryable: true,
  retry_strategy: 'start_fresh_attempt',
}
await assert.rejects(
  () => clientModule.sendMessage(
    'session-1',
    'Create a structured infographic',
    { componentType: 'INFOGRAPHIC' },
  ),
  error => (
    error instanceof clientModule.TextLabsRequestError
    && error.errorCode === 'STRUCTURED_INFOGRAPHIC_PLANNING_FAILED'
    && error.retryStrategy === 'start_fresh_attempt'
  ),
)
const creativeInsertion = clientModule.buildInsertionParams('INFOGRAPHIC', {
  component_type: 'INFOGRAPHIC',
  mode: 'v1',
  image_data_url: 'data:image/png;base64,abc',
})
assert.equal(creativeInsertion.method, 'insertImage')
const explicitCreativeHtmlInsertion = clientModule.buildInsertionParams('INFOGRAPHIC', {
  component_type: 'INFOGRAPHIC',
  mode: 'v1',
  renderer_type: 'image',
  html: '<img src="https://example.test/creative.png">',
})
assert.equal(
  explicitCreativeHtmlInsertion.method,
  'insertImage',
  'explicit V1/image metadata wins over the HTML fallback heuristic',
)
assert.equal(
  explicitCreativeHtmlInsertion.params.imageUrl,
  'https://example.test/creative.png',
  'creative HTML fallback extracts the actual image source',
)

const formSource = fs.readFileSync(
  new URL('../components/generation-panel/forms/infographic-form.tsx', import.meta.url),
  'utf8',
)
const panelSource = fs.readFileSync(
  new URL('../components/generation-panel/index.tsx', import.meta.url),
  'utf8',
)
const stateSource = fs.readFileSync(
  new URL('../hooks/use-generation-panel.ts', import.meta.url),
  'utf8',
)
const researchPolicySource = fs.readFileSync(
  new URL('../lib/element-research-policy.ts', import.meta.url),
  'utf8',
)
const generationSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(formSource, /label:\s*['"`]Segment \d/)
assert.doesNotMatch(formSource, /label:\s*['"`]Step \d/)
assert.match(formSource, /Choose the generation path\. Creative is the default\./)
assert.match(formSource, /Reset to Auto/)
assert.match(formSource, /Manual rows are authoritative/)
assert.match(formSource, /draftFormData\?\.infographicConfig/)
assert.match(formSource, /setSegmentRows\(draftSegments\)/)
assert.match(formSource, /hydratedTargetRef\.current/)
assert.match(formSource, /mode: 'another', overrides: draftFormData\.themeOverrides/)
assert.match(formSource, /setMode\('v1'\)/)
assert.match(formSource, /option value="content">Content/)
assert.doesNotMatch(formSource, /option value="rectangle"/)
assert.match(panelSource, /supportsResearch = !isNonResearchVisualElement\(elementType\)/)
assert.doesNotMatch(panelSource, /if \(isOpen\) setShowAdvanced\(false\)/)
assert.match(stateSource, /isNonResearchVisualElement\(type\)/)
assert.match(stateSource, /setResearchMode\('off'\)/)
assert.match(researchPolicySource, /'INFOGRAPHIC'/)
assert.match(generationSource, /const nonResearchVisual = isNonResearchVisualElement\(/)
assert.match(generationSource, /delete formData\.research/)
assert.match(generationSource, /infographicConfig\.grid_row/)
assert.match(generationSource, /resolveElementGenerationTimeoutMs\(/)
assert.match(generationSource, /properties: params\.structuredPlan/)
assert.match(generationSource, /errorRetryStrategy = err\.retryStrategy/)
assert.doesNotMatch(
  formSource,
  /const advancedModified = mode === 'v2'/,
  'Structured is a primary Design choice and must not mark Advanced as modified',
)
assert.match(
  generationSource,
  /expectedThemeSource === 'director'/,
  'theme authority distinguishes Director acknowledgement from persisted Layout readiness',
)

console.log('infographic frontend contract tests passed')
