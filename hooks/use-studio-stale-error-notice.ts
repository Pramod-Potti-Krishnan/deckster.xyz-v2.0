"use client"

import { useRef } from 'react'
import { errorNoticeStaleAfterRetry, nextErrorNoticeBaseline, type ErrorNoticeBaseline } from '@/lib/studio-pass2b-chat'

/**
 * PASS2B J1-17 (flag NEXT_PUBLIC_STUDIO_CHAT_ERROR_CLEAR, Studio shell only, default off): true once the Director error notice the page is
 * showing is out of date, because the user has sent another turn since it was drawn and Director has answered. The page then stops drawing
 * the notice and the recovery card it feeds; the notice object in the Director hook is not touched.
 *
 * Presentation only. It keeps one ref (the counts when this notice was first seen), writes no state, sends nothing and adds no effect.
 * With `enabled` false it returns false without reading anything else.
 */
export function useStudioStaleErrorNotice(
  enabled: boolean,
  notice: object | null | undefined,
  userTurns: number,
  botMessages: number,
): boolean {
  const baseline = useRef<ErrorNoticeBaseline | null>(null)
  if (!enabled) return false
  baseline.current = nextErrorNoticeBaseline(baseline.current, notice, userTurns, botMessages)
  return errorNoticeStaleAfterRetry(baseline.current, userTurns, botMessages)
}
