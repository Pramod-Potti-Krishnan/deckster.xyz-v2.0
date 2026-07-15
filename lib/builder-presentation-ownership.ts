export type BuilderDeckVersion = 'blank' | 'strawman' | 'final'

export interface LocalPresentationOverride {
  presentationUrl: string | null
  presentationId: string | null
  slideCount: number | null
  refreshToken: number
}

export interface EffectivePresentation {
  presentationUrl: string | null
  presentationId: string | null
  slideCount: number | null
  refreshToken: number
  usesOverride: boolean
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

export function presentationIdFromViewerUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const marker = parts.lastIndexOf('p')
    return marker >= 0 && parts[marker + 1] ? decodeURIComponent(parts[marker + 1]) : null
  } catch {
    return null
  }
}

function presentationIdentity(id: string | null | undefined, url: string | null | undefined): string | null {
  return normalize(id) ?? presentationIdFromViewerUrl(url)
}

/**
 * A live Director presentation owns the viewer. A local Slide Composer override
 * may only decorate that presentation (refresh token/count/URL) when both refer
 * to the same Layout record. It is a fallback only while Director has no deck.
 */
export function resolveEffectivePresentation(input: {
  livePresentationUrl: string | null
  livePresentationId: string | null
  liveSlideCount: number | null
  override: LocalPresentationOverride | null
}): EffectivePresentation {
  const liveIdentity = presentationIdentity(input.livePresentationId, input.livePresentationUrl)
  const overrideIdentity = presentationIdentity(input.override?.presentationId, input.override?.presentationUrl)
  const canUseOverride = Boolean(
    input.override && (!liveIdentity || (overrideIdentity && overrideIdentity === liveIdentity)),
  )

  if (canUseOverride && input.override) {
    return {
      presentationUrl: input.override.presentationUrl ?? input.livePresentationUrl,
      presentationId: input.livePresentationId ?? input.override.presentationId,
      slideCount: input.override.slideCount ?? input.liveSlideCount,
      refreshToken: input.override.refreshToken,
      usesOverride: true,
    }
  }

  return {
    presentationUrl: input.livePresentationUrl,
    presentationId: input.livePresentationId,
    slideCount: input.liveSlideCount,
    refreshToken: 0,
    usesOverride: false,
  }
}

export function isPresentationCallbackCurrent(input: {
  callbackPresentationId: string | null | undefined
  livePresentationId: string | null | undefined
}): boolean {
  const callbackId = normalize(input.callbackPresentationId)
  const liveId = normalize(input.livePresentationId)
  return !callbackId || !liveId || callbackId === liveId
}

export function deriveBuilderStage(input: {
  activeVersion: BuilderDeckVersion
  presentationUrl: string | null
  slideCount: number | null
  hasSlideStructure: boolean
}): number {
  if (input.activeVersion === 'blank' && input.presentationUrl) return 0
  if (input.activeVersion === 'strawman' && (input.presentationUrl || input.hasSlideStructure)) return 4
  if (input.activeVersion === 'final' && input.presentationUrl) return 6
  if ((input.slideCount ?? 0) > 0) return 5
  if (input.hasSlideStructure) return 4
  return 3
}
