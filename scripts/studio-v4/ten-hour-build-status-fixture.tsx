// Disposable localhost specimen: actual native status components, synthetic props only.
import { PresentationViewer } from '@/components/presentation-viewer'
import '@/components/builder/studio-canvas.css'
import { QAPill } from '@/components/build-narration/qa-pill'
import { StageRibbon } from '@/components/build-narration/stage-ribbon'
import { StageProgressFooter } from '@/components/build-narration/stage-progress-footer'
import { SlideContextCard } from '@/components/build-narration/slide-context-card'
import { initialNarrationState, type NarrationState, type NarrationPhase, type NarrationEvent } from '@/lib/build-narration-heuristics'
import '@/components/layout/studio-shell.css'

const LABELS: Record<string, string> = {
  qa: 'Reviewing the presentation quality and preserving the complete typed reasons',
  planning: 'Planning the presentation around the audience, decision and supporting evidence',
  building: 'Building slides from the approved direction and reviewed content',
  awaiting_user: 'Waiting for your direction before the next stage continues',
  paused: 'Build paused',
  error: 'This build needs attention before continuing',
  complete: 'Presentation complete',
}

export default async function LocalBuildStatusFixture({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state: requested } = await searchParams
  const phase: NarrationPhase = requested && requested in LABELS ? requested as NarrationPhase : 'building'
  const error = phase === 'error'
  const complete = phase === 'complete'
  const event = (id: string, stage: string, status: NarrationEvent['status'], text: string, detail?: string): NarrationEvent => ({ id, scope: 'deck', stage, status, text, detail, seq: 1, ts: 0 })
  const errorText = 'Local specimen: the renderer could not finish this slide. Keep the full diagnostic and current stage visible so the author can decide how to continue.'
  const n: NarrationState = {
    ...initialNarrationState(), active: true, source: 'typed', buildId: 'local-component-specimen',
    phase, phaseLabel: LABELS[phase], slideCount: phase === 'qa' ? 17 : 6, slidesDone: complete ? 6 : 2,
    focusSlide: 2, control: phase === 'paused' ? 'paused' : 'running',
    deckEvents: [
      event('local-1', 'framing', 'done', 'The audience and decision are defined for this local component specimen.'),
      event('local-2', 'research', 'progress', 'Reviewing the source context and the supporting evidence for the selected slide.'),
      event('local-3', phase === 'qa' ? 'qa' : error ? 'render' : 'plan', error ? 'error' : complete ? 'done' : 'progress', error ? errorText : 'Connect each priority to its evidence and make the next decision visible.', 'This complete detail remains readable in the native progress region; the specimen does not run a build or contact a service.'),
    ],
    qaVerdicts: phase === 'qa' ? { 0: 'green', 1: 'amber' } : {},
    qaSkipped: phase === 'qa' ? Object.fromEntries(Array.from({length: 15}, (_, index) => [index + 2, 'Local typed reason: this slide has incomplete supplied evidence and requires the full diagnostic to remain readable. The fixture runs no quality service or generation.'])) : {},
    slideStates: { 2: complete ? 'built' : error ? 'error' : 'building' },
    slideEvents: { 2: [
      { ...event('plan', 'plan', 'done', 'The local slide plan is defined.'), scope: 'slide', slideIndex: 2 },
      { ...event('validate', 'validate', complete || error ? 'done' : 'progress', 'Checking the slide structure and all supplied content.'), scope: 'slide', slideIndex: 2 },
      ...(error || complete ? [{ ...event('render', 'render', error ? 'error' : 'done', error ? errorText : 'Local completed-state specimen.'), scope: 'slide' as const, slideIndex: 2 }] : []),
    ] },
  }
  return <div data-studio-v4-shell="true" data-studio-build-specimen="true" style={{ minHeight: '100dvh', padding: 12 }}>
    <header style={{ maxWidth: 980, margin: '0 auto 12px', fontSize: 12, lineHeight: 1.6 }}>Native build-status components · synthetic local state. No build, control request or service action runs here.</header>
    <main style={{ maxWidth: 980, margin: 'auto', border: '1px solid var(--ss-line)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, height: 'calc(100dvh - 96px)' }}>
      <PresentationViewer
        presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
        presentationId="studio-v4-local-renderer" slideCount={phase === 'qa' ? 17 : 6} showControls={false} isGenerating={false}
        className="h-full min-h-0" stageChrome={{
          frame: phase === 'qa' ? <QAPill narration={n} /> : undefined,
          ribbon: <StageRibbon narration={n} />,
          footer: <StageProgressFooter narration={n} researchCard={<SlideContextCard slideIndex={2} context={{
        slide_index: 2, narrative_role: 'supporting_evidence', key_message: 'Connect all reviewed priorities to the evidence behind the next leadership decision.',
        research_ready: complete, research_status: error ? 'needs_review' : complete ? 'ready' : 'in_progress', citation_count: 4,
        source_types: ['local specimen'], research_issues: error ? ['Local specimen evidence needs review; no research service is contacted.'] : [],
      }} />} />,
        }} />
    </main>
  </div>
}
