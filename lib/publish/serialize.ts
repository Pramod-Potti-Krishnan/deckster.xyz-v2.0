// Shared wire shape for PublishedDeck records returned to the owner's
// browser. Never expose passcodeHash — clients only get hasPasscode.

import type { PublishedDeck } from '@prisma/client'

export const PUBLISH_VISIBILITIES = ['public', 'unlisted', 'restricted'] as const
export type PublishVisibility = (typeof PUBLISH_VISIBILITIES)[number]

export function isPublishVisibility(value: unknown): value is PublishVisibility {
  return typeof value === 'string' && (PUBLISH_VISIBILITIES as readonly string[]).includes(value)
}

export function getPublicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://deckster.xyz'
}

export function publicUrlForSlug(slug: string): string {
  return `${getPublicAppUrl()}/p/${slug}`
}

export interface SerializedPublishedDeck {
  id: string
  slug: string
  sessionId: string
  sourcePresentationId: string
  snapshotPresentationId: string
  title: string
  slideCount: number
  visibility: string
  hasPasscode: boolean
  allowPdf: boolean
  allowPptx: boolean
  viewCount: number
  publishedAt: string
  republishedAt: string | null
  revokedAt: string | null
  publicUrl: string
}

export function serializePublishedDeck(deck: PublishedDeck): SerializedPublishedDeck {
  return {
    id: deck.id,
    slug: deck.slug,
    sessionId: deck.sessionId,
    sourcePresentationId: deck.sourcePresentationId,
    snapshotPresentationId: deck.snapshotPresentationId,
    title: deck.title,
    slideCount: deck.slideCount,
    visibility: deck.visibility,
    hasPasscode: Boolean(deck.passcodeHash),
    allowPdf: deck.allowPdf,
    allowPptx: deck.allowPptx,
    viewCount: deck.viewCount,
    publishedAt: deck.publishedAt.toISOString(),
    republishedAt: deck.republishedAt ? deck.republishedAt.toISOString() : null,
    revokedAt: deck.revokedAt ? deck.revokedAt.toISOString() : null,
    publicUrl: publicUrlForSlug(deck.slug),
  }
}
