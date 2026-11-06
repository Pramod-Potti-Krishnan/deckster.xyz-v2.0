// COMPOSER-2 (PROGRAM-1 "thumbnails instead of live viewers in the deck list"): a Decks-page card shows its first-slide image instead of the live viewer
// (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED, exact "true", default off). The lines this change adds to app/(app)/dashboard/page.tsx, which twelve older pins hold to a base
// commit ("without the added lines the file is <base>'s"). Every line this change adds to the page carries the marker DECK-CARD-THUMBNAIL and NO base line is changed or removed, so
// the strip is one rule: a line with the marker goes. scripts/test-studio-deck-card-thumbnail.mjs proves that the page without them is BASE_COMMIT's file, byte for byte.
// Plain node, no imports, nothing read from disk or git here; the same shape as the other *-strip.mjs files: stripDeckCardThumbnail(rel, text), any other file comes back as it is.

export const BASE_COMMIT = 'f9218b4f466a18eff3b7a81bdab8a5cf28350e96' // studio dev head this change is cut from
export const DECK_CARD_THUMBNAIL_MARKER = 'DECK-CARD-THUMBNAIL'
export const DASHBOARD_PAGE = 'app/(app)/dashboard/page.tsx'

/** The one file whose existing lines other pins hold to a base commit. */
export const DECK_CARD_THUMBNAIL_FILES = [DASHBOARD_PAGE]

/** New files (no base text to put back). */
export const DECK_CARD_THUMBNAIL_NEW_FILES = [
  'components/studio-deck-card-thumbnail.css',
  'components/studio-deck-card-thumbnail.tsx',
  'hooks/use-studio-deck-card-thumbnail.tsx',
  'lib/studio-deck-card-thumbnail.ts',
  'scripts/studio-deck-card-thumbnail-strip.mjs',
  'scripts/test-studio-deck-card-thumbnail.mjs',
  'scripts/test-studio-deck-card-thumbnail-cards.mjs',
]

/** Every file this change touches (for a scope registry such as FRONTEND-2's scripts/studio-later-changes.mjs LATER_CHANGE_FILES): its code, its new files and the pins it taught. */
export const DECK_CARD_THUMBNAIL_SCOPE_FILES = [
  ...DECK_CARD_THUMBNAIL_FILES,
  ...DECK_CARD_THUMBNAIL_NEW_FILES,
  'scripts/test-studio-create-word.mjs',
  'scripts/test-studio-deck-card-count.mjs',
  'scripts/test-studio-deck-cards-v2.mjs',
  'scripts/test-studio-deck-grid-4.mjs',
  'scripts/test-studio-deck-title.mjs',
  'scripts/test-studio-plain-nav-labels.mjs',
]

/**
 * The .env.example block this change will get when it is registered (the flag is documented there once it is merged; this change leaves .env.example alone, because the
 * pins that hold it to a base commit would each need teaching). The text is the whole block: its comment, its line and the blank line after it.
 */
export const DECK_CARD_THUMBNAIL_ENV_BLOCK = `# DECK CARD THUMBNAILS (COMPOSER-2, the Decks page's deck cards; PROGRAM-1 "thumbnails instead of live viewers in the deck list"). On for the exact value "true"; default off, and
# then nothing changes: every card is the live viewer frame as before and no inventory read is made. Build-time value: change it on Vercel and redeploy. On: a card whose viewer URL is
# allowed (and on the configured Layout) shows its deck's first-slide image instead of the viewer. ONE read per deck, on the card's first visibility and never while it is off-screen, of
# Layout's slide inventory (GET {layout}/api/presentations/{id}/slides/inventory, the rail's own route): slide 1's thumbnail_url, else last_good_thumbnail_url (additive; absent unless
# Layout's LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED is on) with a small "May lag" cue. A failed or slow read (8 s), a row without an image, or an image that does not load keeps today's card.
NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED="false"

`

/** The page without this change's lines: every line that carries the marker is taken out, every other byte stays. Any other file is returned as it is. */
export function stripDeckCardThumbnail(rel, text) {
  if (rel !== DASHBOARD_PAGE || typeof text !== 'string') return text
  return text.split('\n').filter(line => !line.includes(DECK_CARD_THUMBNAIL_MARKER)).join('\n')
}
