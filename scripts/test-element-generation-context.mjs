import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTypeScriptModule(modulePath) {
  const compiled = ts.transpileModule(fs.readFileSync(modulePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })
  return mod.exports
}

const { buildElementGenerationContext, parseSlideGenerationContext } = loadTypeScriptModule(
  new URL('../lib/element-generation-context.ts', import.meta.url),
)
const {
  buildElementResearchPolicy,
  defaultElementResearchSelection,
  hasSelectedElementResearchSource,
} = loadTypeScriptModule(new URL('../lib/element-research-policy.ts', import.meta.url))

const liveSlide = parseSlideGenerationContext({
  success: true,
  slide_index: 2,
  slide_title: 'Current operating model',
  slide_summary: 'Live manually edited slide',
  target_element_id: 'blank-1',
  elements: [{
    element_id: 'metric-1',
    renderer_type: 'textbox',
    component_type: 'METRICS',
    position: { gridRow: '4/9', gridColumn: '2/10' },
    summary: '42% faster processing',
    properties: { label: 'Cycle time' },
    is_target: false,
  }],
}, 2)

assert.equal(liveSlide.slide_index, 2)
assert.equal(liveSlide.elements[0].component_type, 'METRICS')
assert.throws(
  () => parseSlideGenerationContext({ success: true, slide_index: 0, elements: [] }, 2),
  /different slide/,
)

const longPrompt = `Create the exact metric requested: ${'important detail '.repeat(300)}`
const context = buildElementGenerationContext(longPrompt, 'METRICS', liveSlide, {
  audience: 'Board',
  narrative: 'Transformation progress',
})
assert.equal(context.generation_intent.user_prompt, longPrompt, 'the core prompt must never be truncated')
assert.equal(context.reference_context.slide.slide_index, 2)
assert.equal(context.reference_context.deck.audience, 'Board')

const boundedContext = buildElementGenerationContext('Keep me exact', 'TEXT_BOX', {
  ...liveSlide,
  planned_context: { notes: 'x'.repeat(5000) },
})
assert.equal(boundedContext.generation_intent.user_prompt, 'Keep me exact')
assert.equal(boundedContext.reference_context.slide.planned_context.notes.length, 1600)

const researchCapabilities = {
  web: { available: true },
  uploaded_documents: {
    available: false,
    code: 'NO_UPLOADED_DOCUMENTS',
    reason: 'No uploaded documents are ready in this session.',
  },
  knowledge_graph: {
    available: false,
    code: 'KG_NOT_CONFIGURED',
    reason: 'Knowledge Graph is not configured in this environment.',
  },
}
assert.equal(
  JSON.stringify(defaultElementResearchSelection(true, researchCapabilities)),
  JSON.stringify({ web: true, uploadedDocuments: false, knowledgeGraph: false }),
  'turning Research on enables every currently available source',
)
const webOnlyPolicy = buildElementResearchPolicy({
  mode: 'on',
  selection: { web: true, uploadedDocuments: true, knowledgeGraph: true },
  capabilities: researchCapabilities,
  storeName: null,
  sessionId: 'session-1',
  userId: 'user-1',
})
assert.equal(webOnlyPolicy.web, true)
assert.equal(webOnlyPolicy.uploaded_docs, false)
assert.equal(webOnlyPolicy.use_knowledge_graph, false)
assert.equal(webOnlyPolicy.depth, 'standard')
assert.equal(hasSelectedElementResearchSource(webOnlyPolicy), true)

const allSourcesCapabilities = {
  web: { available: true },
  uploaded_documents: { available: true },
  knowledge_graph: { available: true },
}
const allSourcesPolicy = buildElementResearchPolicy({
  mode: 'on',
  selection: defaultElementResearchSelection(true, allSourcesCapabilities),
  capabilities: allSourcesCapabilities,
  storeName: 'research-corpus',
  sessionId: 'session-1',
  userId: 'user-1',
})
assert.equal(allSourcesPolicy.web, true)
assert.equal(allSourcesPolicy.uploaded_docs, true)
assert.equal(allSourcesPolicy.use_knowledge_graph, true)
assert.equal(allSourcesPolicy.user_id, 'user-1')

const hookSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
const contextSource = fs.readFileSync(
  new URL('../lib/element-generation-context.ts', import.meta.url),
  'utf8',
)
const themeVariantsSource = fs.readFileSync(
  new URL('../lib/element-theme-variants.ts', import.meta.url),
  'utf8',
)
const elementGeometrySource = fs.readFileSync(
  new URL('../lib/element-geometry.ts', import.meta.url),
  'utf8',
)
assert.match(hookSource, /getSlideGenerationContext/)
assert.match(hookSource, /buildElementResearchPolicy/)
assert.match(elementGeometrySource, /refreshElementThemeMetadata/)
assert.match(hookSource, /themeVariantSource: 'element_generation'/)
assert.match(hookSource, /themeVariantSource: refineContext\.themeVariantSource/)
assert.doesNotMatch(elementGeometrySource, /themeVariantSource: 'element_generation'/)
assert.match(hookSource, /formData\.slideIndex = generationSlideIndex/)
assert.match(contextSource, /generation_intent/)
assert.match(themeVariantsSource, /\['TEXT_BOX', 'METRICS'\]/)
assert.match(hookSource, /componentSupportsThemeVariants/)
assert.match(hookSource, /THEME_CHANGED_DURING_GENERATION/)
assert.match(hookSource, /\(!refineContext \|\| !refineElementDeleted\)/)
assert.ok(
  hookSource.indexOf("sendElementCommand('setElementGenerationState'") >
    hookSource.indexOf("sendElementCommand('getSlideGenerationContext'"),
  'the regeneration overlay must start only after live-context preflight succeeds',
)

const clientSource = fs.readFileSync(new URL('../lib/textlabs-client.ts', import.meta.url), 'utf8')
assert.match(clientSource, /slideIndex: 'slide_index'/)
assert.match(clientSource, /generationContext: 'generation_context'/)
assert.match(clientSource, /researchProvenance/)

const routerSource = fs.readFileSync(new URL('../lib/element-command-router.ts', import.meta.url), 'utf8')
assert.match(routerSource, /'getSlideGenerationContext'/)
assert.match(routerSource, /'refreshElementThemeMetadata'/)

const websocketSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
  'utf8',
)
assert.match(websocketSource, /presentation_id: presentationId/)

const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
assert.match(
  builderSource,
  /sendThemeSelection\(buildThemeSelection, requestId, effectivePresentationId\)/,
)

const generationPanelSource = fs.readFileSync(
  new URL('../components/generation-panel/index.tsx', import.meta.url),
  'utf8',
)
assert.match(generationPanelSource, /Enable research/)
assert.match(generationPanelSource, /Web Search/)
assert.match(generationPanelSource, /Uploaded Documents/)
assert.match(generationPanelSource, /Knowledge Graph/)
assert.doesNotMatch(generationPanelSource, /\(\['auto', 'on', 'off'\]/)

const kgSettingsRoute = fs.readFileSync(
  new URL('../app/api/knowledge-graph/settings/route.ts', import.meta.url),
  'utf8',
)
assert.match(kgSettingsRoute, /api\/v1\/kg\/capabilities/)
assert.match(kgSettingsRoute, /KG_SETTINGS_ROUTE_MISSING/)
assert.match(kgSettingsRoute, /KG_BACKEND_FAILURE/)

console.log('element generation context tests passed')
