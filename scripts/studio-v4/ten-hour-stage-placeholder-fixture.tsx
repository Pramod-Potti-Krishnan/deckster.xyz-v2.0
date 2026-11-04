'use client'

// Local leaf/gate specimen. No build, generated result, automatic walkthrough or write runs here.
import { useState } from 'react'
import { StagePlaceholder } from '@/components/build-narration/stage-placeholder'
import { PresentationViewer } from '@/components/presentation-viewer'
import { shouldShowBlankPlaceholder, type NarrationPhase } from '@/lib/build-narration-heuristics'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

const CASES = [
  { value: 'idle', label: 'Contentless URL · idle', phase: 'idle', enabled: true, authored: false },
  { value: 'planning', label: 'Contentless URL · planning gate only', phase: 'planning', enabled: true, authored: false },
  { value: 'standalone', label: 'No-URL standalone fallback leaf', phase: 'idle', enabled: true, authored: false },
  { value: 'authored', label: 'Authored structure · overlay suppressed', phase: 'idle', enabled: true, authored: true },
  { value: 'feature-off', label: 'Narration gate off · overlay suppressed', phase: 'idle', enabled: false, authored: false },
  { value: 'strawman', label: 'Strawman phase gate · overlay suppressed', phase: 'strawman', enabled: true, authored: false },
] as const
type SpecimenCase = typeof CASES[number]['value']

export default function LocalStagePlaceholderFixture() {
  const [selected, setSelected] = useState<SpecimenCase>('idle')
  const [dismissed, setDismissed] = useState(false)
  const current = CASES.find(item => item.value === selected) ?? CASES[0]
  const standalone = selected === 'standalone'
  const showOverlay = shouldShowBlankPlaceholder(current.enabled, {
    dismissed, hasSlideStructure: current.authored, isGenerating: false,
    phase: current.phase as NarrationPhase, hasPresentationUrl: !standalone,
  })

  return (
    <div
      data-studio-v4-shell="true"
      data-studio-stage-specimen="true"
      data-studio-stage-specimen-state={selected}
      data-studio-stage-specimen-phase={current.phase}
      data-studio-stage-specimen-dismissed={dismissed ? 'true' : 'false'}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ss-surface)', color: 'var(--ss-text)' }}
    >
      <header style={{ padding: '10px 16px', flexShrink: 0, fontSize: 12, lineHeight: 1.5, borderBottom: '1px solid var(--ss-line)' }}>
        <p style={{ margin: '0 0 6px' }}>Native blank-stage components · synthetic local props. Phase labels test the existing visibility gate; no build, generated result or service action runs.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
            Stage specimen
            <select
              data-studio-stage-specimen-selector="true"
              value={selected}
              onChange={event => { setSelected(event.target.value as SpecimenCase); setDismissed(false) }}
              style={{ minWidth: 0, maxWidth: '100%', background: 'var(--ss-panel)', color: 'var(--ss-text)', border: '1px solid var(--ss-line)', borderRadius: 6, padding: '4px 6px' }}
            >
              {CASES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" data-studio-stage-specimen-reset="true" onClick={() => setDismissed(false)} style={{ padding: '4px 8px', border: '1px solid var(--ss-line)', borderRadius: 6, background: 'var(--ss-panel)' }}>Reset local dismissal</button>
          <span role="status" data-studio-stage-specimen-status="true">{standalone ? 'Fallback leaf has no dismiss action.' : dismissed ? 'Manually dismissed; read-only supplied iframe revealed.' : showOverlay ? 'Native overlay visible.' : 'Native overlay suppressed by supplied gate inputs.'}</span>
        </div>
        {standalone && <p style={{ margin: '6px 0 0' }}>This is the no-URL narration fallback leaf. The current idle Studio entry normally shows its welcome surface instead.</p>}
      </header>
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {standalone ? (
          <section aria-label="Native standalone placeholder" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <StagePlaceholder mode="standalone" />
          </section>
        ) : (
          <PresentationViewer
            presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
            presentationId="studio-v4-local-renderer"
            slideCount={2}
            showControls={false}
            isGenerating={false}
            className="h-full min-h-0 flex-1"
            stageChrome={{ placeholder: showOverlay ? <StagePlaceholder mode="overlay" onDismiss={() => setDismissed(true)} /> : undefined }}
          />
        )}
      </main>
    </div>
  )
}
