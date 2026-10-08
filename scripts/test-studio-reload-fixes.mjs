import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, '..', 'lib', 'studio-reload-fixes.ts')
const source = readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

function loadModule(env = {}) {
  const sandbox = {
    module: { exports: {} },
    process: {
      env: { ...env },
    },
    console,
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled.outputText, sandbox)
  return sandbox.module.exports
}

console.log('--- Suite 1: Flag OFF (Baseline Identity) ---')
{
  const {
    isStudioReloadFixesEnabled,
    formatSlideThumbnailTitle,
    formatSlideStructureTitle,
    isActionRequestHistorical,
    reconcileRestoredAnsweredActions,
  } = loadModule({})

  // Flag must be off by default
  assert.equal(isStudioReloadFixesEnabled(), false, 'flag must be false by default')

  // R2: Baseline title behaviors preserved
  assert.equal(formatSlideThumbnailTitle('closing_slide', 7), 'closing_slide')
  assert.equal(formatSlideThumbnailTitle('title_slide', 1), 'title_slide')
  assert.equal(formatSlideThumbnailTitle('section_divider', 3), 'section_divider')
  assert.equal(formatSlideThumbnailTitle('Slide 2', 2), 'Slide 2')
  assert.equal(formatSlideThumbnailTitle('', 4), 'Slide 4')
  assert.equal(formatSlideThumbnailTitle(null, 5), 'Slide 5')
  assert.equal(formatSlideThumbnailTitle('Executive Summary', 2), 'Executive Summary')

  assert.equal(formatSlideStructureTitle(undefined, 'closing_slide', 7), 'closing_slide')
  assert.equal(formatSlideStructureTitle('closing_slide', 'closing_slide', 7), 'closing_slide')
  assert.equal(formatSlideStructureTitle('My Deck', 'title_slide', 1), 'My Deck')
  assert.equal(formatSlideStructureTitle(undefined, undefined, 3), 'Slide 3')

  // R1: Baseline action request handling
  assert.equal(isActionRequestHistorical(0, 5), false, 'flag-off must not consider action historical')
  assert.equal(isActionRequestHistorical(4, 5), false)

  const messages = [
    { id: 'act-1', messageType: 'action_request', timestamp: '2026-10-08T12:00:00Z' },
    { id: 'usr-1', messageType: 'user', text: 'answer', timestamp: '2026-10-08T12:01:00Z' },
  ]
  const answered = reconcileRestoredAnsweredActions(messages, { presentationUrl: 'https://cdn.test/p' })
  assert.equal(answered.size, 0, 'flag-off must return empty answered set')

  console.log('✅ Suite 1 passed (flag-off identity 100% verified)')
}

console.log('--- Suite 2: Flag ON (R1 + R2 Fixes Active) ---')
{
  const {
    isStudioReloadFixesEnabled,
    formatSlideThumbnailTitle,
    formatSlideStructureTitle,
    isActionRequestHistorical,
    reconcileRestoredAnsweredActions,
  } = loadModule({ NEXT_PUBLIC_STUDIO_RELOAD_FIXES_ENABLED: 'true' })

  // Flag is on
  assert.equal(isStudioReloadFixesEnabled(), true, 'flag must be true when env var set')

  // R2: Thumbnail strip labels humanized
  assert.equal(formatSlideThumbnailTitle('closing_slide', 7), 'Closing Slide', 'closing_slide -> Closing Slide')
  assert.equal(formatSlideThumbnailTitle('CLOSING_SLIDE', 7), 'Closing Slide', 'case-insensitive closing_slide')
  assert.equal(formatSlideThumbnailTitle('  closing_slide  ', 7), 'Closing Slide', 'trimmed closing_slide')
  assert.equal(formatSlideThumbnailTitle('title_slide', 1), 'Title Slide', 'title_slide -> Title Slide')
  assert.equal(formatSlideThumbnailTitle('section_divider', 3), 'Section Divider', 'section_divider -> Section Divider')
  assert.equal(formatSlideThumbnailTitle('Executive Summary', 2), 'Executive Summary', 'custom titles preserved')
  assert.equal(formatSlideThumbnailTitle('Financial Forecast', 3), 'Financial Forecast')
  assert.equal(formatSlideThumbnailTitle('Slide 6', 6), 'Slide 6')
  assert.equal(formatSlideThumbnailTitle('', 4), 'Slide 4')
  assert.equal(formatSlideThumbnailTitle(null, 5), 'Slide 5')

  // R2: SlideStructure title mapping
  assert.equal(formatSlideStructureTitle(undefined, 'closing_slide', 7), 'Closing Slide')
  assert.equal(formatSlideStructureTitle('closing_slide', 'closing_slide', 7), 'Closing Slide')
  assert.equal(formatSlideStructureTitle(undefined, 'title_slide', 1), 'Title Slide')
  assert.equal(formatSlideStructureTitle(undefined, 'section_divider', 4), 'Section Divider')
  assert.equal(formatSlideStructureTitle('Product Vision', 'content', 2), 'Product Vision')
  assert.equal(formatSlideStructureTitle('', 'content', 3), 'Slide 3')

  // R1: Historical action request detection
  assert.equal(isActionRequestHistorical(0, 4), true, 'index 0 of 4 has subsequent messages -> historical')
  assert.equal(isActionRequestHistorical(1, 4), true, 'index 1 of 4 has subsequent messages -> historical')
  assert.equal(isActionRequestHistorical(3, 4), false, 'index 3 of 4 is tail message -> active')

  // R1: Reconcile restored session messages with answered action
  const answeredSession = [
    { id: 'usr-0', messageType: 'user', text: 'Build a deck on widgets', timestamp: '2026-10-08T10:00:00Z' },
    { id: 'bot-1', messageType: 'action_request', timestamp: '2026-10-08T10:00:05Z' },
    { id: 'usr-2', messageType: 'user', text: 'Answers: 10 min · Technical', timestamp: '2026-10-08T10:01:00Z' },
    { id: 'bot-3', messageType: 'chat_message', timestamp: '2026-10-08T10:01:05Z' },
    { id: 'bot-4', messageType: 'presentation_url', timestamp: '2026-10-08T10:02:00Z' },
  ]
  const answeredSet = reconcileRestoredAnsweredActions(answeredSession, {
    presentationUrl: 'https://cdn.test/pres',
    slideCount: 7,
    currentStage: 6,
  })
  assert.equal(answeredSet.has('bot-1'), true, 'answered action_request must be marked answered')

  // R1: Active action request at tail of fresh session without subsequent messages or presentation
  const freshSession = [
    { id: 'usr-0', messageType: 'user', text: 'Build a deck on widgets', timestamp: '2026-10-08T10:00:00Z' },
    { id: 'bot-1', messageType: 'action_request', timestamp: '2026-10-08T10:00:05Z' },
  ]
  const freshSet = reconcileRestoredAnsweredActions(freshSession, {
    presentationUrl: null,
    slideCount: 0,
    currentStage: 1,
  })
  assert.equal(freshSet.has('bot-1'), false, 'unanswered tail action_request must remain active for input')

  console.log('✅ Suite 2 passed (R1 and R2 fixes verified)')
}

console.log('All Studio reload fixes tests passed successfully!')
