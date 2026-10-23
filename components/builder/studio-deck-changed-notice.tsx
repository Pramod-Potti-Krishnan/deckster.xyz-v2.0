"use client"

import { useEffect, useState } from 'react'
import type { DeckChangedNotice } from '@/lib/studio-deck-changed-notice'

export interface StudioDeckChangedNoticeProps {
  /** Null (or absent) renders nothing. The page hook owns when a notice exists. */
  notice?: DeckChangedNotice | null
  /** This tab has edits Layout has not confirmed saved: Reload deck then asks first. */
  unsaved?: boolean
  /** The user chose to reload the deck. Never called by this component on its own. */
  onReload: () => void
  onDismiss: () => void
  className?: string
}

const barStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  justifyContent: 'center',
  columnGap: 8,
  rowGap: 2,
  minWidth: 0,
  padding: '6px 12px',
  fontSize: 12,
  lineHeight: 1.5,
  background: 'var(--ss-panel, #ffffff)',
  color: 'var(--ss-text, #243438)',
  borderBottom: '1px solid var(--ss-line, #dde5e2)',
}

const actionStyle = {
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--ss-teal, #1f6f72)',
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

const quietStyle = { ...actionStyle, fontWeight: 400, color: 'var(--ss-muted, #566965)' }

/** A calm one-line strip above the canvas: "This deck changed in another tab · Reload deck".
 * Pure presentation: it reloads nothing by itself, and with unsaved edits in this tab it asks once before Reload deck proceeds. */
export function StudioDeckChangedNotice({ notice, unsaved = false, onReload, onDismiss, className = '' }: StudioDeckChangedNoticeProps) {
  const [confirming, setConfirming] = useState(false)
  const noticeId = notice?.id ?? null
  useEffect(() => { setConfirming(false) }, [noticeId])
  if (!notice) return null

  const needsConfirm = unsaved && !confirming
  return <div data-studio-deck-changed-notice={notice.source} role="status" aria-live="polite" aria-atomic="true"
    className={className} style={barStyle}>
    {!confirming && <>
      <span data-studio-deck-changed-part="text">{notice.source === 'reconnect' ? 'This deck changed while you were reconnecting' : 'This deck changed in another tab'}</span>
      <span aria-hidden="true" style={{ color: 'var(--ss-muted, #566965)' }}>·</span>
      <button type="button" data-studio-deck-changed-part="reload" style={actionStyle}
        onClick={() => { if (needsConfirm) setConfirming(true); else onReload() }}>Reload deck</button>
      <button type="button" data-studio-deck-changed-part="dismiss" aria-label="Dismiss this notice" style={quietStyle}
        onClick={onDismiss}>Dismiss</button>
    </>}
    {confirming && <>
      <span data-studio-deck-changed-part="unsaved">This tab has changes that are not saved yet. Reloading drops them.</span>
      <button type="button" data-studio-deck-changed-part="reload-anyway" style={actionStyle} onClick={onReload}>Reload anyway</button>
      <button type="button" data-studio-deck-changed-part="keep" style={quietStyle} onClick={() => setConfirming(false)}>Keep editing</button>
    </>}
  </div>
}
