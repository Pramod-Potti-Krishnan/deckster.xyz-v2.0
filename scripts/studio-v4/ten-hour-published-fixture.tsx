// Disposable localhost adapter for the actual client components. Never visit /p/[slug].
import { PublishedViewer } from '@/components/published-viewer'
import { PublishPasscodeGate } from '@/components/publish-passcode-gate'
import { PublishedQuestionView } from '@/components/published-question-view'

export default async function LocalPublishedFixture({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams
  const title = 'Quarterly strategy — priorities, evidence, and decisions for the leadership team'
  if (state === 'passcode') return <PublishPasscodeGate slug="fixture-shared-deck" title={title} />
  if (state === 'answer' || state === 'waiting') return <PublishedQuestionView slug="fixture-shared-deck" title={title} ownerName="Local reviewer" thread={{
    question: 'How do these priorities connect the supporting evidence to the next leadership decision?',
    answer: state === 'waiting' ? null : 'Start with the decision.\n\nKeep the full supporting passage readable, connect every reviewed priority to its evidence, and retain the next action and its owner. This is synthetic local content for the actual follow-up view.',
    citations: state === 'waiting' ? [] : [{ kind: 'slide', label: 'Complete priorities and supporting evidence', href: '/p/fixture-shared-deck#/2' }],
    provenanceLine: state === 'waiting' ? null : 'Local fixture answer · visual review only', answeredBy: state === 'waiting' ? null : 'Local reviewer',
  }} />
  return <PublishedViewer title={title} slug="fixture-shared-deck"
    layoutBaseUrl="https://layout-builder-v75-uat.up.railway.app"
    snapshotPresentationId="studio-v4-local-renderer" slideCount={2}
    allowPdf={true} allowPptx={state !== 'faq-only'} ownerName="Local reviewer"
    qaEnabled={state !== 'faq-only'} initialFaq={[{
      id: 'fixture-approved-answer', question: 'What decision does this presentation support?',
      answer: '**Align the next priorities.** This is a complete synthetic approved answer for the local component review; no published data was loaded.',
      citations: [{ kind: 'slide', label: 'Priorities and evidence', slideNumber: 2 }],
      provenanceLine: 'Local fixture answer · visual review only', approvedBy: 'Local reviewer', approvedAt: '2026-10-02T12:00:00Z',
    }]} />
}
