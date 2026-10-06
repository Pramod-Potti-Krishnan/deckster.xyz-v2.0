'use client'

// Props-only localhost specimen. Root supplies the strict read-only viewer interceptor.
import { useEffect, useState } from 'react'
import { ThemePanel } from '@/components/theme-panel'
import { PresentationViewer } from '@/components/presentation-viewer'
import { themeSelectionFingerprint, type BuildThemeSelection } from '@/lib/theme-builder'
import type { ThemeSyncState, ThemeSyncStatus } from '@/lib/theme-sync'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export const THEME_PANEL_FIXTURE_SELECTION: BuildThemeSelection = { mode: 'auto' }
export const THEME_PANEL_FIXTURE_DRAFT = 'Retained local author draft while reviewing supplied theme states. This text is never sent or saved.'
export const THEME_PANEL_FIXTURE_ERROR = [
  'Synthetic supplied failure for the native ThemePanel. No theme request was made and no service response was received.',
  ...Array.from({ length: 12 }, (_, index) => `Local diagnostic passage ${index + 1}: Preserve the complete existing error text while reviewing the native failure notice with keyboard focus and scrolling. This synthetic diagnostic is component input only. It does not acknowledge a theme change, imply persisted state or replace Director and Layout authority.`),
  '[END OF LOCAL THEME FAILURE]',
].join('\n\n')

const PRESENTATION_ID = 'studio-v4-local-renderer'
const STATES: ThemeSyncStatus[] = ['idle', 'syncing', 'applied', 'failed']
const resolveStatus = (value?: string): ThemeSyncStatus => STATES.find(status => status === value) ?? 'idle'

export function themePanelFixtureSync(status: ThemeSyncStatus): ThemeSyncState {
  return {
    status,
    requestId: status === 'idle' ? null : `local-supplied-${status}`,
    presentationId: PRESENTATION_ID,
    themeFingerprint: themeSelectionFingerprint(THEME_PANEL_FIXTURE_SELECTION),
    error: status === 'failed' ? THEME_PANEL_FIXTURE_ERROR : null,
  }
}

export default function LocalThemePanelFixture({ state, initialOpen = true, initialLocked = false }: {
  state?: string; initialOpen?: boolean; initialLocked?: boolean
}) {
  const [status, setStatus] = useState<ThemeSyncStatus>(() => resolveStatus(state))
  const [locked, setLocked] = useState(initialLocked)
  const [open, setOpen] = useState(initialOpen)
  const [draft, setDraft] = useState(THEME_PANEL_FIXTURE_DRAFT)
  const [applyRefusals, setApplyRefusals] = useState(0)
  useEffect(() => { setStatus(resolveStatus(state)) }, [state])
  const sync = themePanelFixtureSync(status)

  return <div data-studio-v4-shell="true" data-studio-theme-fixture="true">
    <style>{`
      [data-studio-theme-fixture] { height:100dvh; min-height:0; display:flex; flex-direction:column; color:var(--ss-text); }
      [data-studio-theme-fixture] > header { flex-shrink:0; display:grid; grid-template-columns:minmax(0,1.6fr) minmax(240px,1fr); gap:10px 18px; padding:12px 16px; border-bottom:1px solid var(--ss-line); }
      [data-studio-theme-fixture] h1 { font-size:15px; font-weight:600; line-height:21px; margin:0 0 4px; }
      [data-studio-theme-fixture] > header p,[data-studio-theme-fixture] > header output { font-size:11px; line-height:16px; color:var(--ss-muted); margin:0; }
      [data-studio-theme-fixture] nav { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; }
      [data-studio-theme-fixture] nav button { padding:5px 9px; border:1px solid var(--ss-line); border-radius:6px; background:var(--ss-panel); color:var(--ss-text); font-size:11px; }
      [data-studio-theme-fixture] nav button[aria-pressed=true] { color:var(--ss-teal); border-color:var(--ss-teal); }
      [data-studio-theme-fixture] nav label { display:flex; align-items:center; gap:6px; font-size:11px; padding-inline:5px; }
      [data-studio-theme-fixture] [data-studio-theme-fixture-draft] { display:flex; flex-direction:column; gap:5px; font-size:11px; }
      [data-studio-theme-fixture] [data-studio-theme-fixture-draft] textarea { width:100%; min-height:52px; height:52px; resize:vertical; border:1px solid var(--ss-line); border-radius:7px; padding:7px 9px; font:inherit; color:var(--ss-text); background:var(--ss-panel); }
      [data-studio-theme-fixture] > main { position:relative; flex:1; min-height:0; min-width:0; }
      [data-studio-theme-fixture] > header :is(button,input,textarea):focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
      @media(max-width:700px) { [data-studio-theme-fixture] > header { grid-template-columns:minmax(0,1fr); padding:10px 12px; } }
    `}</style>
    <header>
      <section aria-label="Local theme fixture controls">
        <h1>Native Deck theme · supplied component states</h1>
        <p role="note">Idle, syncing, applied and failed are synthetic props, not a service acknowledgement. No theme hook or Apply transport runs here. Root intercepts the viewer read-only.</p>
        <nav aria-label="Supplied theme sync state">
          {STATES.map(value => <button type="button" key={value} aria-pressed={status === value} data-studio-theme-fixture-state={value} onClick={() => setStatus(value)}>{value}</button>)}
          <label><input type="checkbox" checked={locked} data-studio-theme-fixture-lock="true" onChange={event => setLocked(event.target.checked)} />Selection locked</label>
          <button type="button" aria-haspopup="dialog" data-studio-theme-fixture-open="true" onClick={() => setOpen(true)}>Open theme panel</button>
        </nav>
      </section>
      <div data-studio-theme-fixture-draft="true"><label htmlFor="local-theme-draft">Local retained draft</label><textarea id="local-theme-draft" value={draft} onChange={event => setDraft(event.target.value)} /><output data-studio-theme-fixture-refusals="true" role="status">Apply callbacks refused locally: {applyRefusals}. Selection stays Auto; no change is sent or acknowledged.</output></div>
    </header>
    <main data-studio-v4-viewer="true" data-studio-theme-fixture-viewer="true" aria-label="Native viewer with local read-only adapter">
      <PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId={PRESENTATION_ID} slideCount={6} showControls={false} isGenerating={false} buildThemeSelection={THEME_PANEL_FIXTURE_SELECTION} themeSync={sync} className="h-full min-h-0" />
      <ThemePanel isOpen={open} onClose={() => setOpen(false)} presentationId={PRESENTATION_ID} buildThemeSelection={THEME_PANEL_FIXTURE_SELECTION} themeSync={sync} selectionLocked={locked} onBuildThemeChange={() => setApplyRefusals(count => count + 1)} />
    </main>
  </div>
}
