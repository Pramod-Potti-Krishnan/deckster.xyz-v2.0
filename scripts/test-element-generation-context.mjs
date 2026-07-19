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
const earlyOverlayStartIndex = hookSource.indexOf("label: 'Regenerating…'")
assert.notEqual(earlyOverlayStartIndex, -1)
assert.ok(
  earlyOverlayStartIndex <
    hookSource.indexOf('await ensureThemeReady(requestedThemePresentationId)'),
  'the visible generation overlay starts before theme readiness',
)
assert.ok(
  earlyOverlayStartIndex <
    hookSource.indexOf('readElementGenerationSnapshot({'),
  'the visible generation overlay starts before live geometry preflight',
)
assert.ok(
  earlyOverlayStartIndex <
    hookSource.indexOf("sendElementCommand('getSlideGenerationContext'"),
  'the visible generation overlay starts before live-context preflight',
)
const earlyOverlaySource = hookSource.slice(
  hookSource.indexOf('// Start visible progress immediately after the presentation + element'),
  hookSource.indexOf('const requestedThemePresentationId ='),
)
assert.match(
  earlyOverlaySource,
  /assertLayoutCommandSucceeded\(overlayResponse, 'Regeneration overlay'\)/,
  'refinement never proceeds when Layout negatively acknowledges the visible progress overlay',
)
assert.match(earlyOverlaySource, /assertLayoutCommandSucceeded\(overlayResponse, 'Generation overlay'\)/)
assert.match(earlyOverlaySource, /generationPanel\.setError/)
assert.match(earlyOverlaySource, /return/)
assert.doesNotMatch(
  earlyOverlaySource,
  /deleteElement|insertTextBox/,
  'starting blank generation must not replace the authoritative placeholder',
)
const lifecycleCleanupSource = hookSource.slice(
  hookSource.indexOf('const cleanupGenerationLifecycle = async () =>'),
  hookSource.indexOf('const requestedThemePresentationId ='),
)
assert.match(lifecycleCleanupSource, /generating: false/)
assert.match(lifecycleCleanupSource, /generationPanel\.setIsGenerating\(false\)/)
assert.match(lifecycleCleanupSource, /activeGenerationKeysRef\.current\.delete\(generationKey\)/)
assert.match(
  hookSource,
  /\}\s*finally\s*\{\s*await cleanupGenerationLifecycle\(\)/,
  'one outer lifecycle finally clears overlays and the duplicate-generation lock on every exit',
)
assert.doesNotMatch(hookSource, /function buildSpinnerHtml/)
const blankDeleteSource = hookSource.slice(
  hookSource.indexOf('// Delete blank placeholder before inserting generated content'),
  hookSource.indexOf('// Insert each element into the canvas'),
)
assert.match(blankDeleteSource, /sendLayoutMutationWithReconciliation/)
assert.ok(
  blankDeleteSource.indexOf('sendLayoutMutationWithReconciliation') <
    blankDeleteSource.indexOf('blankElements.removeElement(currentBlankId)'),
  'placeholder tracking changes only after a confirmed successful Layout deletion receipt',
)
assert.match(
  hookSource,
  /currentBlankInfo &&\s+blankTrackingWasRemoved &&\s+layoutServiceApis/,
  'placeholder reconstruction is reserved for failures after the original was removed',
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

const viewerSource = fs.readFileSync(
  new URL('../components/presentation-viewer.tsx', import.meta.url),
  'utf8',
)
assert.match(
  viewerSource,
  /setElementGenerationState: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS/,
  'generation overlay acknowledgements use the bounded mutating-command timeout',
)

const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
assert.match(
  builderSource,
  /sendThemeSelection\(target\.selection, requestId, targetPresentationId\)/,
)
assert.match(builderSource, /waitForAuthoritativeTheme/)
assert.doesNotMatch(
  builderSource,
  /generationPanel\.openPanelForEdit/,
  'ordinary element selection must not open the Text Labs drawer; only explicit Regenerate should',
)

const presentationViewerSource = fs.readFileSync(
  new URL('../components/presentation-viewer.tsx', import.meta.url),
  'utf8',
)
assert.match(presentationViewerSource, /LAYOUT_ELEMENT_COMMAND_TIMEOUTS/)
assert.match(
  presentationViewerSource,
  /upsertSemanticElement:\s*CITED_UPSERT_LAYOUT_COMMAND_TIMEOUT_MS/,
  'semantic text upserts must not use the generic 5s postMessage timeout',
)
assert.match(
  presentationViewerSource,
  /upsertCitedElement:\s*CITED_UPSERT_LAYOUT_COMMAND_TIMEOUT_MS/,
  'cited text/table/metrics upserts must allow source-registry rebuild and save',
)
assert.match(
  presentationViewerSource,
  /insertTextBox:\s*MUTATING_LAYOUT_COMMAND_TIMEOUT_MS/,
  'blank placeholder replacement must allow Layout insertion acknowledgement beyond 5s',
)
assert.match(
  presentationViewerSource,
  /deleteElement:\s*MUTATING_LAYOUT_COMMAND_TIMEOUT_MS/,
  'blank placeholder cleanup must allow Layout deletion acknowledgement beyond 5s',
)

const generationPanelSource = fs.readFileSync(
  new URL('../components/generation-panel/shared/research-controls.tsx', import.meta.url),
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
