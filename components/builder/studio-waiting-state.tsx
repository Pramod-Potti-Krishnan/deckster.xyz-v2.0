"use client"

import './studio-waiting-state.css'

const STUDIO_WAITING = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface StudioWaitingStateProps {
  message?: string
  scope?: 'screen' | 'canvas'
}

/** Pure native waiting presentation. The caller owns every loading/auth/session predicate. */
export function StudioWaitingState({ message = 'Loading builder...', scope = 'screen' }: StudioWaitingStateProps) {
  if (!STUDIO_WAITING) return null
  return (
    <div data-studio-v4-shell="true" data-studio-waiting="true" data-waiting-scope={scope} role="status" aria-live="polite" aria-atomic="true">
      <div>
        <div data-studio-waiting-spinner="true" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  )
}
