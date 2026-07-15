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
assert.match(elementGeometrySource, /refreshElementThemeMetadata/)
assert.match(elementGeometrySource, /themeVariantSource: 'element_generation'/)
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

console.log('element generation context tests passed')
