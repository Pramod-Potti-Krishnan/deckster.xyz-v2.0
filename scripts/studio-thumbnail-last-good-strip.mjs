// FRONTEND-2 (THUMBNAILS-BLANK-UAT, the "never blank" contract; the Studio half): a rail card with no fresh preview shows its own slide's last good one with a "May lag" cue, and the Publish preview widens #495's
// fresh-only rule to slide 0's last good image (NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD, default off).
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back (stripThumbnailLastGood(rel, text)), the way the other
// *-strip.mjs files do. scripts/test-studio-thumbnail-last-good.mjs proves that stripping gives back BASE_COMMIT's files byte for byte. Every piece is context-free (its text occurs once and needs no
// neighbour): the insertions are removed on their own and the one swapped line (the publish inventory's row type) goes back to its base line. Each entry is [text this change has, text the base has].
// New files (no base text to put back): THUMBNAIL_LAST_GOOD_NEW_FILES below.

export const BASE_COMMIT = '5794d38ad51bcd288b49b6faa17145f862efde10' // frontend2/duplicate-copy-title (#497), which stacks on #496 (900d1276), #495 (419be980) and studio ae0885e8; the base's .env.example already holds all three blocks

const ENV_BLOCK = `# THUMBNAIL LAST GOOD (FRONTEND-2, THUMBNAILS-BLANK-UAT "never blank"; the Studio half of Layout's LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED). On for the exact value "true"; default off, and then nothing changes: every rail card and the Publish
# preview are exactly as before. Build-time value: change it on Vercel and redeploy. Layout adds two keys to each row of GET /api/presentations/{id}/slides/inventory: last_good_thumbnail_url (the slide's last registered preview, fresh or
# stale) and thumbnail_stale_reason ("content" or "theme"); with Layout's flag off both are absent and read as null here. On: (1) the slide rail, which needs NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED to read the inventory, shows a slide
# with no fresh preview as ITS OWN last good image (never another slide's) with a small "May lag" badge and the label "Preview may not show recent edits" (the slide changed since the capture; also the label for no reason or an unknown one) or
# "Preview shows the previous theme" (the deck's theme changed); a fresh preview shows alone, as before, and a slide with no image at all keeps the loading or "No preview" card; (2) the Publish preview, ONLY when
# NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED is on too, falls back to slide 1's last good image when it has no fresh one, so "Deck preview unavailable" shows only when no image exists at all (its caption already says "Preview image can
# lag recent edits"); with only that flag on, the Publish preview still shows a fresh image only. No new request is made and nothing is written.
NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD="false"

`

const RAIL_FLAG = `/** THUMBNAILS-BLANK-UAT "never blank" (NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD, exact 'true', default off): with Layout's LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED each row also carries \`last_good_thumbnail_url\` (the slide's last registered
 *  preview, fresh or stale, else null) and \`thumbnail_stale_reason\` (content | theme | null); absent keys read as null. A slide with no fresh preview then shows ITS OWN last good one, marked as possibly lagging (SlideRailRow.thumbnailLag).
 *  Off, rows are exactly as before. This module stays import-free. */
const THUMBNAIL_LAST_GOOD = process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD === 'true'

`

const RAIL_ROW_FIELDS = `  /** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD only (absent otherwise): the slide's last registered preview, fresh or stale; null when there is none. */
  lastGoodThumbnailUrl?: string | null
  /** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD only (absent otherwise): why a stale row is stale; null when fresh, not given or not a known reason. */
  thumbnailStaleReason?: 'content' | 'theme' | null
`

const RAIL_LAG_FIELD = `  /** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD only: set when \`thumbnailUrl\` is this slide's last good preview and not a fresh one (the card adds its "may lag" cue); the reason says why it is not fresh. */
  thumbnailLag?: 'content' | 'theme'
`

const RAIL_LAST_GOOD_FIELDS = `/** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD: a row's two optional keys. An absent or unusable URL is null (only http(s) is kept, as for \`thumbnail_url\`); a reason other than content or theme is null. */
function lastGoodFields(slide: Record<string, unknown>): Pick<SlideInventoryRow, 'lastGoodThumbnailUrl' | 'thumbnailStaleReason'> {
  const reason = slide.thumbnail_stale_reason
  return { lastGoodThumbnailUrl: safeThumbnailUrl(slide.last_good_thumbnail_url), thumbnailStaleReason: reason === 'content' || reason === 'theme' ? reason : null }
}

`

const RAIL_PARSE_SPREAD = `      ...(THUMBNAIL_LAST_GOOD ? lastGoodFields(slide) : {}),
`

const RAIL_SAME_INVENTORY = `      && row.lastGoodThumbnailUrl === other.lastGoodThumbnailUrl && row.thumbnailStaleReason === other.thumbnailStaleReason
`

const RAIL_BUILD_ROWS = `    // NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD: no fresh preview but a last good one of THIS row (its own, never a neighbour's): show it, marked as possibly lagging. A fresh preview always wins.
    ...(THUMBNAIL_LAST_GOOD && !row.thumbnailUrl && row.lastGoodThumbnailUrl ? { thumbnailUrl: row.lastGoodThumbnailUrl, thumbnailLag: row.thumbnailStaleReason === 'theme' ? 'theme' as const : 'content' as const } : {}),
`

const STRIP_IMPORT = `import { StudioThumbnailLagCue } from './studio-thumbnail-lag-cue' // NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (default off): the "May lag" cue on a card that shows its slide's last good preview
`

const STRIP_FIELD = `  thumbnailLag?: 'content' | 'theme' // NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD: set only when \`thumbnailUrl\` is the slide's last good preview and not a fresh one; the card adds a "may lag" cue (content: edits since the capture, theme: a new deck theme)
`

const STRIP_CUE = `        {STUDIO_THUMBNAILS && slide.thumbnailLag && thumbnailUrl && !isRefining && <StudioThumbnailLagCue reason={slide.thumbnailLag} />}{/* NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (default off): "May lag" over a preview that is the slide's last good one; a sibling of the button, over the preview's corner, no pointer events */}
`

const PUBLISH_FLAG = `/** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (exact "true", default off): THUMBNAILS-BLANK-UAT "never blank". With BOTH this flag and the one above on, slide 0 with no fresh image shows its \`lastGoodThumbnailUrl\` (Layout's last registered preview of
 * that slide, fresh or stale; the rows carry it only with this flag on, lib/slide-rail-identity.ts), so "Deck preview unavailable" shows only when no image exists at all. With only the flag above on, the fresh-only rule is exactly as before; with only this
 * one on, no inventory read is made (the request above needs the flag above). The caption "Preview image can lag recent edits" already says what a stale image is. */
const THUMBNAIL_LAST_GOOD = process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD === 'true'

`

const PUBLISH_TYPE = `  slides: ReadonlyArray<{ thumbnailUrl: string | null; thumbnailStale: boolean; lastGoodThumbnailUrl?: string | null }>
`

const PUBLISH_TYPE_BASE = `  slides: ReadonlyArray<{ thumbnailUrl: string | null; thumbnailStale: boolean }>
`

const PUBLISH_FALLBACK = `  // NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (default off): with both flags on, no fresh image falls back to slide 0's own last good one (else null, as below). Only the first row, and only this presentation's.
  if (first && THUMBNAIL_LAST_GOOD && STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED && (first.thumbnailStale || !first.thumbnailUrl)) return nonempty(first.lastGoodThumbnailUrl)
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'lib/slide-rail-identity.ts': [
    [RAIL_FLAG, ''],
    [RAIL_ROW_FIELDS, ''],
    [RAIL_LAG_FIELD, ''],
    [RAIL_LAST_GOOD_FIELDS, ''],
    [RAIL_PARSE_SPREAD, ''],
    [RAIL_SAME_INVENTORY, ''],
    [RAIL_BUILD_ROWS, ''],
  ],
  'components/slide-thumbnail-strip.tsx': [
    [STRIP_IMPORT, ''],
    [STRIP_FIELD, ''],
    [STRIP_CUE, ''],
  ],
  'lib/studio-publish-preview-inventory.ts': [
    [PUBLISH_FLAG, ''],
    [PUBLISH_TYPE, PUBLISH_TYPE_BASE],
    [PUBLISH_FALLBACK, ''],
  ],
}

export const THUMBNAIL_LAST_GOOD_FILES = Object.keys(CHANGES)
export const THUMBNAIL_LAST_GOOD_NEW_FILES = ['lib/studio-thumbnail-last-good.ts', 'components/studio-thumbnail-lag-cue.tsx', 'components/studio-thumbnail-last-good.css',
  'scripts/studio-thumbnail-last-good-strip.mjs', 'scripts/test-studio-thumbnail-last-good.mjs',
  'scripts/fixtures/thumbnail-last-good/inventory-lg-nothing-registered.json', 'scripts/fixtures/thumbnail-last-good/inventory-lg-registered.json', 'scripts/fixtures/thumbnail-last-good/inventory-lg-stale-content.json',
  'scripts/fixtures/thumbnail-last-good/inventory-lg-off-registered.json', 'scripts/fixtures/thumbnail-last-good/inventory-lg-off-stale.json']
// The earlier tests this change teaches about its strip and .env.example block (tests only, added lines): the six stacked ones, the three FRONTEND-2 pins that read through the stacked strips, and the three rail pins
// that hold the strip or the inventory lib to a base commit.
export const THUMBNAIL_LAST_GOOD_PIN_FILES = ['scripts/test-studio-publish-review-fit.mjs', 'scripts/test-studio-version-history-deck-only.mjs', 'scripts/test-studio-compose-entitlement.mjs', 'scripts/test-studio-publish-preview-inventory.mjs',
  'scripts/test-studio-payments-open-soon.mjs', 'scripts/test-studio-duplicate-copy-title.mjs', 'scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs',
  'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/test-studio-rail-add-slide.mjs', 'scripts/test-stage-f-thumbnail-recovery.mjs']
export const THUMBNAIL_LAST_GOOD_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripThumbnailLastGood(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
