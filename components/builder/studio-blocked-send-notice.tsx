"use client"

import type { BlockedSendNotice } from '@/lib/studio-blocked-send'

export interface StudioBlockedSendNoticeProps {
  /** Null (or absent) renders nothing. The page owns when a notice exists. */
  notice?: BlockedSendNotice | null
  /** Dismiss only hides this notice; it never touches the draft or the gate. */
  onDismiss?: () => void
  className?: string
}

const surfaceStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere' as const,
  whiteSpace: 'pre-wrap' as const,
  background: 'var(--ss-panel, #ffffff)',
  color: 'var(--ss-text, #243438)',
  borderColor: 'var(--ss-line, #dde5e2)',
}

/** A client-only line at the end of the chat: "this was not sent, and here is why".
 * Pure presentation: nothing here is sent to the Director, persisted, retried or
 * allowed to change a send gate. The text lives in the composer, untouched. */
export function StudioBlockedSendNotice({ notice, onDismiss, className = '' }: StudioBlockedSendNoticeProps) {
  if (!notice) return null
  return <div key={notice.id} data-studio-blocked-send-notice={notice.kind}
    role="alert" aria-atomic="true"
    className={`min-w-0 rounded-lg border px-3 py-3 text-xs leading-relaxed ${className}`}
    style={surfaceStyle}>
    <p data-studio-blocked-send-part="title" className="mb-1 font-semibold">{notice.title}</p>
    <p data-studio-blocked-send-part="text" style={{ minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', color: 'var(--ss-muted, #566965)' }}>{notice.text}</p>
    {onDismiss && <button type="button" data-studio-blocked-send-part="dismiss" onClick={onDismiss}
      className="mt-2 text-[11px] underline underline-offset-2"
      style={{ color: 'var(--ss-muted, #566965)' }}>Dismiss</button>}
  </div>
}
