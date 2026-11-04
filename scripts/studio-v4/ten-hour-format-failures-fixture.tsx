'use client'

// Native leaf controls and native viewer command adapter, with synthetic targets.
// Root's capture replaces the iframe with a read-only, refusing local bridge.
import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { ElementFormatPanel } from '@/components/element-format-panel'
import { TextBoxFormatPanel } from '@/components/textbox-format-panel'
import { PresentationViewer } from '@/components/presentation-viewer'
import { ARRANGE_FIXTURE_PROPERTIES } from '@/scripts/studio-v4/ten-hour-arrange-fixture'
import '@/components/layout/studio-shell.css'

type ViewerApis = Parameters<NonNullable<ComponentProps<typeof PresentationViewer>['onApiReady']>>[0]

export default function LocalFormatFailuresFixture() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [apis, setApis] = useState<ViewerApis>(null)
  const onApiReady = useCallback((next: ViewerApis) => setApis(next), [])
  const [kind, setKind] = useState<'element' | 'text'>('element')
  const [target, setTarget] = useState(1)
  const [draft, setDraft] = useState('Retain this separate unsent sample draft.')
  const [commands, setCommands] = useState(0)
  const elementId = `synthetic-local-format-${target}`
  const send = useCallback(async (action: string, params: Record<string, unknown>) => {
    setCommands(count => count + 1)
    if (!apis) throw new Error('Native viewer adapter is not ready.')
    return kind === 'text'
      ? apis.sendTextBoxCommand(action, params)
      : apis.sendElementCommand(action, params)
  }, [apis, kind])

  return <div data-studio-v4-shell="true" data-studio-format-failure-fixture="true">
    <style>{`
      [data-studio-format-failure-fixture] { height:100dvh; padding:12px; display:flex; flex-direction:column; gap:10px; overflow:hidden; }
      [data-studio-format-failure-fixture] > header { flex-shrink:0; font-size:11px; line-height:17px; }
      [data-studio-format-failure-fixture] > header strong { display:block; font-size:13px; }
      [data-studio-format-failure-fixture] nav { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-block:8px; }
      [data-studio-format-failure-fixture] nav button { padding:5px 10px; border:1px solid var(--ss-line); border-radius:6px; }
      [data-studio-format-failure-fixture] button:focus-visible,[data-studio-format-failure-fixture] textarea:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
      [data-studio-format-failure-fixture] textarea { width:100%; height:42px; padding:6px; background:var(--ss-panel); border:1px solid var(--ss-line); border-radius:6px; }
      [data-studio-format-failure-fixture] main { display:grid; grid-template-columns:360px minmax(0,1fr); gap:12px; flex:1; min-height:0; }
      [data-studio-format-failure-fixture] main > section { position:relative; min-height:0; min-width:0; overflow:hidden; border:1px solid var(--ss-line); border-radius:10px; }
    `}</style>
    <header>
      <strong>Native formatting failure specimen · local-only</strong>
      Synthetic selection. Actual viewer command adapter receives refused iframe responses. No service, edit, save or selection acknowledgement.
      <nav aria-label="Local specimen controls">
        <button onClick={() => setKind('element')}>Element specimen</button>
        <button onClick={() => setKind('text')}>Text specimen</button>
        <button onClick={() => setTarget(value => value + 1)}>Switch synthetic target</button>
        <output aria-label="Native adapter readiness">{apis ? 'Native adapter ready' : 'Waiting for native adapter'}</output>
        <output aria-label="Attempted native command count">Commands attempted {commands}</output>
      </nav>
      <label>Separate sample draft<textarea aria-label="Separate sample draft" value={draft} onChange={event => setDraft(event.target.value)} /></label>
    </header>
    <main>
      <section aria-label="Actual format inspector">
        {kind === 'element' ? <ElementFormatPanel
          isOpen onClose={() => {}} elementId={elementId} elementType="hero"
          properties={{ ...ARRANGE_FIXTURE_PROPERTIES, elementId }}
          presentationId="studio-v4-local-renderer" slideIndex={0} onSendCommand={send}
        /> : <TextBoxFormatPanel
          isOpen onClose={() => {}} elementId={elementId}
          formatting={{ fontFamily: 'Arial', fontSize: '24pt', fontWeight: '400', color: '#27463b' }}
          presentationId="studio-v4-local-renderer" slideIndex={0} onSendCommand={send}
        />}
      </section>
      <section aria-label="Native viewer with refusing local bridge">
        {mounted && <PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
          presentationId="studio-v4-local-renderer" slideCount={2} showControls={false}
          isGenerating={false} onApiReady={onApiReady} className="h-full min-h-0" />}
      </section>
    </main>
  </div>
}
