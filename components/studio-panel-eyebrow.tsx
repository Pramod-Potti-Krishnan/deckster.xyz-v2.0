import type { StudioPanelEyebrow as Words } from '@/lib/studio-panel-eyebrow'

/** PASS2B G29 + G33 (NEXT_PUBLIC_STUDIO_PANEL_EYEBROW, default off; the panels render this only with the flag on): the violet band over a generation panel's header. */
export function StudioPanelEyebrow({ label, detail }: Words) {
  return (
    <div data-studio-panel-eyebrow="true">
      <span>{label}</span>
      {detail ? <span>{detail}</span> : null}
    </div>
  )
}
