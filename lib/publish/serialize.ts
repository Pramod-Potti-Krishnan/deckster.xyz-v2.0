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
  /** SOURCE deck's Layout updated_at at the last publish/republish/rotate */
  sourceUpdatedAt: string | null
  publicUrl: string
  // --- Q&A (rung 1). Owner-facing settings; none of this reaches /p/{slug}.
  qaEnabled: boolean
  qaCorpusStatus: string
  qaDailyCap: number
  qaMonthlyCap: number
  qaTonePreset: string
  qaToneInstruction: string | null
  qaCiteWebSources: boolean
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
    sourceUpdatedAt: deck.sourceUpdatedAt ?? null,
    publicUrl: publicUrlForSlug(deck.slug),
    qaEnabled: deck.qaEnabled,
    qaCorpusStatus: deck.qaCorpusStatus,
    qaDailyCap: deck.qaDailyCap,
    qaMonthlyCap: deck.qaMonthlyCap,
    qaTonePreset: deck.qaTonePreset,
    qaToneInstruction: deck.qaToneInstruction ?? null,
    qaCiteWebSources: deck.qaCiteWebSources,
  }
}
