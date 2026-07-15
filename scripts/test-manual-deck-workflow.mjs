import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/manual-deck-workflow.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })

const {
  buildSessionHandoffRequest,
  clearPendingHandoff,
  createManualDeckContext,
  inspectManualDeck,
  readPendingHandoff,
  savePendingHandoff,
} = mod.exports

const blank = {
  title: 'Untitled Presentation',
  theme_config: { source_theme_id: 'vibrant' },
  slides: [{
    layout: 'H1-structured',
    content: { slide_title: '', slide_subtitle: '', hero_content: '<p><br></p>' },
    metadata: { is_blank: true },
    text_boxes: [], images: [], charts: [], infographics: [], diagrams: [], contents: [],
    background_color: null,
    background_image: null,
  }],
}
assert.equal(inspectManualDeck(blank).hasMeaningfulWork, false, 'theme-only blank must not prompt')

const twoSlides = structuredClone(blank)
twoSlides.slides.push(structuredClone(blank.slides[0]))
assert.equal(inspectManualDeck(twoSlides).hasMeaningfulWork, true)
assert.equal(inspectManualDeck(twoSlides).summary.reasons[0], 'additional_slides')

const withElement = structuredClone(blank)
withElement.slides[0].text_boxes.push({ id: 'textbox-1', content: 'Manual work' })
const elementInspection = inspectManualDeck(withElement)
assert.equal(elementInspection.hasMeaningfulWork, true)
assert.equal(elementInspection.summary.element_count, 1)
assert.equal(elementInspection.summary.customized_slide_count, 1)

const withContent = structuredClone(blank)
withContent.slides[0].content.slide_title = 'My retained slide'
withContent.slides[0].content.purpose = 'Customer onboarding narrative'
withContent.slides[0].speaker_notes = '<p>Emphasize the launch sequence.</p>'
const contentInspection = inspectManualDeck(withContent)
assert.equal(contentInspection.hasMeaningfulWork, true)
assert.equal(contentInspection.summary.slide_titles[0], 'My retained slide')
assert.equal(contentInspection.summary.slides[0].content.purpose, 'Customer onboarding narrative')
assert.equal(contentInspection.summary.slides[0].notes, 'Emphasize the launch sequence.')
assert.equal(contentInspection.summary.slides[0].intent, 'Customer onboarding narrative')

const withLayout = structuredClone(blank)
withLayout.slides[0].layout = 'C1-text'
assert.equal(inspectManualDeck(withLayout).summary.reasons.includes('layout'), true)

const manualContext = createManualDeckContext({
  presentationId: 'manual-deck-1',
  presentationUrl: 'https://layout.example/p/manual-deck-1',
  summary: elementInspection.summary,
  operationId: 'build-request-1',
})
assert.equal(manualContext.policy, 'prepend_generated')
assert.equal(manualContext.source_presentation_id, 'manual-deck-1')
assert.equal(manualContext.operation_id, 'build-request-1')

const handoff = buildSessionHandoffRequest({
  userId: 'user-1',
  idempotencyKey: 'handoff-key-1',
  pendingRequest: 'Build a deck about safe AI',
  theme: { mode: 'preset', preset_id: 'vibrant' },
  templateMode: false,
  deepResearch: true,
  webSearch: false,
  useKnowledgeGraph: true,
  storeName: 'files/store-1',
  manualDeckSummary: elementInspection.summary,
})
assert.equal(handoff.pending_request, 'Build a deck about safe AI')
assert.equal(handoff.idempotency_key, 'handoff-key-1')
assert.equal(handoff.attachment_store_references[0].store_name, 'files/store-1')
assert.equal(handoff.manual_deck_summary.element_count, 1)

const values = new Map()
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
}
const pending = {
  version: 1,
  source_session_id: 'session-old',
  new_session_id: 'session-new',
  idempotency_key: 'handoff-key-1',
  text: 'Build a deck about safe AI',
  store_name: 'files/store-1',
  file_count: 2,
  deep_research: true,
  web_search: false,
  extended_generation: true,
  use_knowledge_graph: true,
  theme: { mode: 'preset', preset_id: 'vibrant' },
  template_mode: false,
  template_id: null,
}
savePendingHandoff(storage, pending)
assert.equal(readPendingHandoff(storage, 'session-new').idempotency_key, 'handoff-key-1')
clearPendingHandoff(storage, 'session-new')
assert.equal(readPendingHandoff(storage, 'session-new'), null, 'successful send is consumed once')

console.log('manual deck workflow tests passed')
