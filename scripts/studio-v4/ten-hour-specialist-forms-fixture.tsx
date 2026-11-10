'use client'

// Local component specimen only. This does not prove Add Element insertion or service generation.
import { useCallback, useState } from 'react'
import { GenerationPanel } from '@/components/generation-panel'
import { PresentationViewer } from '@/components/presentation-viewer'
import type { GenerationPanelProps } from '@/components/generation-panel/types'
import type { ElementResearchCapabilities, TextLabsComponentType } from '@/types/textlabs'
import '@/app/builder/studio-v4.css'
import '@/app/builder/studio-v4-type.css'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-panels.css'
import '@/components/builder/studio-canvas.css'

const TYPES: ReadonlyArray<{ value: TextLabsComponentType; label: string }> = [
  { value: 'TABLE', label: 'Table' },
  { value: 'METRICS', label: 'Metrics' },
  { value: 'CHART', label: 'Chart' },
  { value: 'DIAGRAM', label: 'Diagram' },
  { value: 'SHAPE', label: 'Shape' },
  { value: 'ICON_LABEL', label: 'Icon label' },
  { value: 'TEXT_BOX', label: 'Text box' },
  { value: 'INFOGRAPHIC', label: 'Infographic' },
  { value: 'IMAGE', label: 'Image' },
]

// Exact synthetic read catalogue already supplied by capture-next.py's SLOTS.
const SLOT_CATALOG = {
  canvas_type: 'standard',
  template_id: 'C1-text',
  slots: [{
    slot_name: 'body', label: 'Body text', role: 'BODY_TEXT', kind: 'body', single_instance: false,
    geometry: { start_col: 3, start_row: 4, position_width: 26, position_height: 12 },
  }],
}
const ELEMENT_CONTEXT = { startCol: 3, startRow: 4, width: 26, height: 12 }
const UNAVAILABLE = { available: false, reason: 'Research is unavailable in this local component specimen.' }
const RESEARCH_CAPABILITIES: ElementResearchCapabilities = {
  web: UNAVAILABLE, uploaded_documents: UNAVAILABLE, knowledge_graph: UNAVAILABLE,
}
const refuseResearchChange = () => {}

export default function LocalSpecialistFormsFixture() {
  const [elementType, setElementType] = useState<TextLabsComponentType>('TABLE')
  const [activationId, setActivationId] = useState(1)
  const [isOpen, setIsOpen] = useState(true)
  const [draft, setDraft] = useState('Local unsent draft. This text remains here while reviewing the native form controls.')
  const [error, setError] = useState<string | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const [feedbackMode, setFeedbackMode] = useState<'none' | 'retry' | 'fresh' | 'update'>('none')
  const suppliedDiagnostic = ['Synthetic local diagnostic. No generation or service request was attempted.', ...Array.from({length: 8}, (_, index) => `Local diagnostic ${index + 1}: Preserve the complete explanation and the native retry guidance while inspecting the remaining form fields. This supplied text is not an acknowledgement or an actual generation failure. ${'long-local-token-'.repeat(18)}`), 'End of the complete supplied generation diagnostic.'].join('\n\n')

  const selectType = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    setActivationId(previous => previous + 1)
    setIsOpen(true)
    setError(null)
    setFeedbackMode('none')
  }, [])
  const getTemplateSlotCatalog = useCallback(async () => SLOT_CATALOG, [])
  const refuseGeneration = useCallback<GenerationPanelProps['onGenerate']>(async () => {
    setAttemptCount(previous => previous + 1)
    setError('Local component specimen refuses generation. No request, insertion or success acknowledgement occurred.')
  }, [])

  return (
    <div
      data-studio-v4-shell="true"
      data-studio-specialist-specimen="true"
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ss-surface)', color: 'var(--ss-text)' }}
    >
      <header style={{ padding: '10px 16px', borderBottom: '1px solid var(--ss-line)', flexShrink: 0, fontSize: 12, lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 6px' }}>Native specialist forms · synthetic local props and read-only slide fixture. No Add Element acknowledgement, generation or research runs here.</p>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Review form
          <select
            data-studio-specialist-specimen-type="true"
            value={elementType}
            onChange={event => selectType(event.target.value as TextLabsComponentType)}
            style={{ background: 'var(--ss-panel)', color: 'var(--ss-text)', border: '1px solid var(--ss-line)', borderRadius: 6, padding: '4px 8px' }}
          >
            {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
          Supplied feedback
          <select data-studio-specialist-feedback-case="true" value={feedbackMode} onChange={event => setFeedbackMode(event.target.value as typeof feedbackMode)} style={{background:'var(--ss-panel)',color:'var(--ss-text)',border:'1px solid var(--ss-line)',borderRadius:6,padding:'4px 8px'}}>
            <option value="none">No supplied diagnostic</option><option value="retry">Resume existing attempt</option><option value="fresh">Fresh attempt guidance</option><option value="update">Update request guidance</option>
          </select>
        </label>
        <span data-studio-specialist-specimen-attempts="true" role="status" style={{ marginLeft: 12 }}>
          Refused generation attempts: {attemptCount}
        </span>
      </header>
      <main style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }} aria-label="Read-only slide and local draft">
          <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <PresentationViewer
              presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
              presentationId="studio-v4-local-renderer"
              slideCount={2}
              showControls={false}
              isGenerating={false}
              className="h-full min-h-0"
            />
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--ss-line)', flexShrink: 0, fontSize: 12 }}>
            Local unsent draft · browser state only
            <textarea
              data-studio-specialist-specimen-draft="true"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              rows={2}
              style={{ width: '100%', minWidth: 0, resize: 'none', background: 'var(--ss-panel)', color: 'var(--ss-text)', border: '1px solid var(--ss-line)', borderRadius: 6, padding: 8 }}
            />
          </label>
        </section>
        <aside
          data-studio-specialist-specimen-panel="true"
          data-studio-specialist-specimen-activation={activationId}
          aria-label="Native generation inspector with synthetic inputs"
          style={{ width: 400, maxWidth: '100%', flexShrink: 0, minWidth: 0, minHeight: 0, position: 'relative', borderLeft: '1px solid var(--ss-line)' }}
        >
          {!isOpen && <button onClick={() => setIsOpen(true)} style={{ margin: 16 }}>Reopen native inspector</button>}
          <GenerationPanel
            isOpen={isOpen}
            activationId={activationId}
            elementType={elementType}
            mode="generate"
            onClose={() => setIsOpen(false)}
            onElementTypeChange={selectType}
            onGenerate={refuseGeneration}
            isGenerating={false}
            error={feedbackMode === 'none' ? error : suppliedDiagnostic}
            retryStrategy={feedbackMode === 'retry' ? 'resume_same_attempt' : feedbackMode === 'fresh' ? 'start_fresh_attempt' : feedbackMode === 'update' ? 'do_not_retry' : undefined}
            slideIndex={0}
            presentationId="studio-v4-local-renderer"
            elementContext={ELEMENT_CONTEXT}
            getTemplateSlotCatalog={getTemplateSlotCatalog}
            researchMode="off"
            researchWeb={false}
            researchUploadedDocs={false}
            researchKnowledgeGraph={false}
            researchCapabilities={RESEARCH_CAPABILITIES}
            onResearchModeChange={refuseResearchChange}
            onResearchWebChange={refuseResearchChange}
            onResearchUploadedDocsChange={refuseResearchChange}
            onResearchKnowledgeGraphChange={refuseResearchChange}
          />
        </aside>
      </main>
    </div>
  )
}
