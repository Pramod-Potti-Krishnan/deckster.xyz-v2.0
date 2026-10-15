"use client"

import { SUPERSEDED_NOTICE_TEXT, SUPERSEDED_USE_HERE_LABEL } from '@/lib/studio-one-live-tab'

export interface StudioSupersededNoticeProps {
  /** The page passes true only while NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB is on and the Director socket reports `superseded`. Otherwise nothing renders. */
  active?: boolean
  /** The existing explicit connect(): this tab opens a new socket, Director closes the other tab's, and that tab shows this notice. */
  onUseHere?: () => void
  className?: string
}

const surfaceStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere' as const,
  background: 'var(--ss-panel, #ffffff)',
  color: 'var(--ss-text, #243438)',
  borderColor: 'var(--ss-line, #dde5e2)',
}

/**
 * NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB: "this session is open in another tab". Director keeps one live socket per session; the tab it
 * handed over to another tab is paused (nothing reconnects by itself), and this says so with one way back. Pure presentation: the
 * only action is the page's own connect().
 */
export function StudioSupersededNotice({ active = false, onUseHere, className = '' }: StudioSupersededNoticeProps) {
  if (!active) return null
  return <div data-studio-superseded-notice="true" role="status" aria-atomic="true"
    className={`flex min-w-0 flex-col items-start gap-2 rounded-lg border px-3 py-3 text-xs leading-relaxed ${className}`}
    style={surfaceStyle}>
    <p data-studio-superseded-part="text" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{SUPERSEDED_NOTICE_TEXT}</p>
    {onUseHere && <button type="button" data-studio-superseded-part="use-here" onClick={() => onUseHere()}
      className="rounded-md border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: 'var(--ss-line, #dde5e2)', background: 'var(--ss-surface, #f6f9f8)', color: 'var(--ss-text, #243438)' }}>{SUPERSEDED_USE_HERE_LABEL}</button>}
  </div>
}
