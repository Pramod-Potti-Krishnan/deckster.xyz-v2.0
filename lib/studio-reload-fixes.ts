/**
 * Studio Reload Fixes (P1-STUDIO-RELOAD — RUN-1 J1 R1+R2).
 *
 * Gated behind NEXT_PUBLIC_STUDIO_RELOAD_FIXES_ENABLED (default false).
 * Flag-off: 100% byte-for-byte baseline identity.
 * Flag-on:
 *   - R1: Quick questions / action requests answered prior to reload
 *     do not reactivate upon session restore.
 *   - R2: Closing slide thumbnail label displays formatted "Closing Slide"
 *     instead of raw backend identifier "closing_slide".
 */

export function isStudioReloadFixesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_RELOAD_FIXES_ENABLED === 'true'
}

/**
 * Humanizes slide titles for display in the thumbnail strip (R2).
 * Maps snake_case identifiers like 'closing_slide' to 'Closing Slide'.
 */
export function formatSlideThumbnailTitle(
  title: string | undefined | null,
  visualNumber?: number,
  forceEnabled?: boolean,
): string {
  const enabled = forceEnabled ?? isStudioReloadFixesEnabled()
  if (!enabled) {
    if (!title || /^Slide \d+$/i.test(title)) {
      return visualNumber !== undefined ? `Slide ${visualNumber}` : (title || '')
    }
    return title
  }

  if (!title) {
    return visualNumber !== undefined ? `Slide ${visualNumber}` : ''
  }

  const trimmed = title.trim()
  if (/^Slide \d+$/i.test(trimmed)) {
    return visualNumber !== undefined ? `Slide ${visualNumber}` : trimmed
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'closing_slide') {
    return 'Closing Slide'
  }
  if (lower === 'title_slide') {
    return 'Title Slide'
  }
  if (lower === 'section_divider') {
    return 'Section Divider'
  }

  return trimmed
}

/**
 * Resolves slide title from slideStructure payload for presentation viewer (R2).
 */
export function formatSlideStructureTitle(
  title: string | undefined | null,
  slideType: string | undefined | null,
  defaultSlideNumber: number,
  forceEnabled?: boolean,
): string {
  const enabled = forceEnabled ?? isStudioReloadFixesEnabled()
  const raw = title || slideType || `Slide ${defaultSlideNumber}`
  if (!enabled) {
    return raw
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const lower = trimmed.toLowerCase()
    if (lower === 'closing_slide') {
      return 'Closing Slide'
    }
    if (lower === 'title_slide') {
      return 'Title Slide'
    }
    if (lower === 'section_divider') {
      return 'Section Divider'
    }
    if (lower === 'content' || lower === 'hero') {
      return `Slide ${defaultSlideNumber}`
    }
    return trimmed
  }

  return raw
}

/**
 * Checks whether an action request is historical and was followed by
 * subsequent conversation messages (R1).
 */
export function isActionRequestHistorical(
  indexInList: number,
  totalMessages: number,
  forceEnabled?: boolean,
): boolean {
  const enabled = forceEnabled ?? isStudioReloadFixesEnabled()
  if (!enabled) {
    return false
  }
  return indexInList < totalMessages - 1
}

/**
 * Scans restored session messages and reconciles answered action_request IDs (R1).
 */
export function reconcileRestoredAnsweredActions(
  messages: Array<any>,
  sessionState?: any,
  forceEnabled?: boolean,
): Set<string> {
  const answered = new Set<string>()
  const enabled = forceEnabled ?? isStudioReloadFixesEnabled()
  if (!enabled || !Array.isArray(messages) || messages.length === 0) {
    return answered
  }

  const hasDeckProgress = Boolean(
    sessionState?.presentationUrl ||
    sessionState?.finalPresentationUrl ||
    sessionState?.strawmanPreviewUrl ||
    (sessionState?.slideCount && sessionState.slideCount > 0) ||
    (sessionState?.currentStage && sessionState.currentStage > 1) ||
    (sessionState?.slideStructure && Array.isArray(sessionState.slideStructure?.slides) && sessionState.slideStructure.slides.length > 0)
  )

  messages.forEach((msg, idx) => {
    const type = msg.messageType || msg.type
    if (type === 'action_request') {
      const msgId = msg.id || msg.message_id
      const hasSubsequent = idx < messages.length - 1
      if (msgId && (hasSubsequent || hasDeckProgress)) {
        answered.add(msgId)
      }
    }
  })

  return answered
}
