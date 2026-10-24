import type { RefObject } from 'react'
import './studio-deck-card-thumbnail.css'
import { THUMBNAIL_LAG_TEXT, thumbnailLagLabel, type ThumbnailLagReason } from '@/lib/studio-deck-card-thumbnail'

/**
 * NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED (default off; lib/studio-deck-card-thumbnail.ts, hooks/use-studio-deck-card-thumbnail.tsx): what a Decks-page card draws in its
 * preview area instead of the live viewer. Only these two pieces are new markup; the card's title, menu and meta are untouched.
 */

/** The preview box before the card has been seen (and while its one read is in flight): empty, the card's own slate background shows. No viewer is loaded. */
export function StudioDeckCardThumbnailPending({ boxRef }: { boxRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={boxRef} className="h-full w-full" data-studio-deck-card-thumbnail="pending" aria-hidden="true" />
}

/**
 * The first-slide image, used as-is (lazy, async-decoded, alt = the deck's title as the viewer frame's title is). `lag` non-null = it is the last good image: a small "May lag"
 * badge over its corner, with an accessible label saying why ("Preview may not show recent edits" or "Preview shows the previous theme"). A fresh image has no cue.
 * If the image does not load, `onError` lets the card fall back to today's preview.
 */
export function StudioDeckCardThumbnailImage({ url, title, lag, onError }: { url: string; title: string; lag: ThumbnailLagReason | null; onError: () => void }) {
  return (
    <div className="relative h-full w-full" data-studio-deck-card-thumbnail="image">
      <img src={url} alt={title} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={onError} />
      {lag ? (
        <span className="studio-deck-card-lag-cue" data-studio-deck-card-lag={lag} role="img" aria-label={thumbnailLagLabel(lag)}>
          <span aria-hidden="true">{THUMBNAIL_LAG_TEXT}</span>
        </span>
      ) : null}
    </div>
  )
}
