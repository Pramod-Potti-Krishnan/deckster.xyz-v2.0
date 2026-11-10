"use client"

import type {
  DirectorHandoffRequestStatus,
  DirectorTransportNotice,
} from '@/hooks/use-deckster-websocket-v2'

export interface StudioDirectorNoticeProps {
  /** The caller filters these metadata receipts by their current owner. */
  notice?: DirectorTransportNotice | null
  handoffStatus?: DirectorHandoffRequestStatus | null
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

const reasonStyle = {
  minWidth: 0,
  overflowWrap: 'anywhere' as const,
  whiteSpace: 'pre-wrap' as const,
  color: 'var(--ss-muted, #566965)',
}

const hasText = (value?: string) => Boolean(value?.trim())

/** Transport/request metadata stays separate from the durable conversation.
 * Pure presentation: no resend, retry, mutation, approval or readiness gate. */
export function StudioDirectorNotice({ notice, handoffStatus, className = '' }: StudioDirectorNoticeProps) {
  if (!notice && !handoffStatus) return null

  const requiresResend = Boolean(notice && (notice.type === 'auth_expired' || notice.requiresResend))
  const transportAlert = Boolean(notice && notice.type !== 'auth_refreshed')
  const quietRefresh = notice?.type === 'auth_refreshed' && !requiresResend
  const title = notice?.type === 'auth_expired' ? 'Your last input needs to be resent'
    : notice?.type === 'auth_refreshed' ? 'Connection refreshed'
    : notice?.type === 'auth_refresh_failed' ? 'Connection refresh failed'
    : 'Director reported an error'
  const handoffCopy = handoffStatus?.status === 'processing'
    ? { title: 'Request in progress', text: 'Director is processing this request.' }
    : handoffStatus?.status === 'already_processing'
      ? { title: 'Request already in progress', text: 'Director is already processing this request.' }
      : handoffStatus?.status === 'already_completed'
        ? { title: 'Request already processed', text: 'Director reports this request was already completed. The canvas reports deck readiness separately.' }
        : { title: 'Request failed', text: 'Director reported that this request failed.' }

  return <section aria-label="Director connection and request updates"
    data-studio-director-notice="true" className={`flex min-w-0 flex-col gap-2 ${className}`}>
    {notice && <div data-studio-director-transport-notice={notice.type}
      role={transportAlert ? 'alert' : 'status'} aria-atomic="true"
      className={quietRefresh ? 'min-w-0 rounded-md border px-3 py-2 text-xs leading-relaxed' : 'min-w-0 rounded-lg border px-3 py-3 text-xs leading-relaxed'}
      style={surfaceStyle}>
      {!quietRefresh && <p className="mb-1 font-semibold" style={{ color: 'var(--ss-text, #243438)' }}>{title}</p>}
      {hasText(notice.message) && <p data-studio-director-notice-part="message" style={reasonStyle}>{notice.message}</p>}
      {hasText(notice.detail) && <p data-studio-director-notice-part="detail" className="mt-1" style={reasonStyle}>{notice.detail}</p>}
      {requiresResend && <p data-studio-director-notice-part="resend-guidance" className="mt-2 font-medium">
        {notice.type === 'auth_expired'
          ? 'Your last input was discarded when the connection expired. Restore the connection, then use the chat box to resend it yourself.'
          : 'Your earlier input was discarded. Use the chat box to resend it yourself when the connection is ready.'}
      </p>}
      {quietRefresh && !hasText(notice.message) && <p>Secure connection refreshed.</p>}
    </div>}
    {handoffStatus && <div data-studio-director-handoff-status={handoffStatus.status}
      role={handoffStatus.status === 'failed' ? 'alert' : 'status'} aria-atomic="true"
      className="min-w-0 rounded-lg border px-3 py-3 text-xs leading-relaxed" style={surfaceStyle}>
      <p className="mb-1 font-semibold">{handoffCopy.title}</p>
      <p style={reasonStyle}>{handoffCopy.text}</p>
      {hasText(handoffStatus.error) && <p data-studio-director-notice-part="handoff-error" className="mt-1" style={reasonStyle}>{handoffStatus.error}</p>}
    </div>}
  </section>
}
