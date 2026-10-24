import './studio-thumbnail-last-good.css'
import { THUMBNAIL_LAG_TEXT, thumbnailLagLabel, thumbnailLagReason } from '@/lib/studio-thumbnail-last-good'

/**
 * NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (default off): the "May lag" cue on a rail card whose preview is the slide's last good image, not a fresh one.
 * The card draws it only for a row that carries `thumbnailLag` (set by lib/slide-rail-identity.ts with the flag on). A small badge over the preview's corner with no
 * pointer events (the card's click, drag and keyboard stay the button's); the accessible label says why: "Preview may not show recent edits" (content, and the
 * default) or "Preview shows the previous theme" (theme). Its colours are the rail's own tokens, so it follows light and dark with the rest of the card.
 */
export function StudioThumbnailLagCue({ reason }: { reason: unknown }) {
  const kind = thumbnailLagReason(reason)
  return (
    <span className="studio-thumbnail-lag-cue" data-studio-thumbnail-lag={kind} role="img" aria-label={thumbnailLagLabel(kind)}>
      <span aria-hidden="true">{THUMBNAIL_LAG_TEXT}</span>
    </span>
  )
}
