// Studio session open read-only (flag NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY): the lines this change adds to app/builder/page.tsx, which other pins hold to a base commit
// ("without the added lines the file is <base>'s"). Sibling pins call stripOpenReadOnly(rel, text) first and then do what they always did, the way they already strip the
// J2-04 status lines (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-open-read-only.mjs proves the strip and that every addition is inert with the flag off.

import { stripDuplicateDeck } from './studio-duplicate-deck-strip.mjs'
import { stripChatElementRefine } from './studio-chat-element-refine-strip.mjs'
import { stripChatThemeExport } from './studio-chat-theme-export-strip.mjs'
import { stripReconnectResync } from './studio-reconnect-resync-strip.mjs' // P3-4 slice A (stacked)
import { stripJobLedger } from './studio-job-ledger-strip.mjs' // P3-4 slice C (stacked)
import { stripNewDeckHandoffSend } from './studio-new-deck-handoff-send-strip.mjs' // new-deck handoff send (stacked)
import { stripPublishReviewFit } from './studio-publish-review-fit-strip.mjs' // publish review fit (stacked)
import { stripVersionHistoryDeckOnly } from './studio-version-history-deck-only-strip.mjs' // version history deck only (stacked)
import { stripComposeEntitlement } from './studio-compose-entitlement-strip.mjs' // Add Slide compose signs its user (stacked on #475)
import { stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs' // Publish preview from Layout's inventory (stacked)
import { stripPaymentsOpenSoon } from './studio-payments-open-soon-strip.mjs' // payments open soon (stacked)
import { stripDuplicateCopyTitle } from './studio-duplicate-copy-title-strip.mjs' // duplicate copy title (stacked)
import { stripThumbnailLastGood } from './studio-thumbnail-last-good-strip.mjs' // thumbnail last good (stacked)

export const PAGE = 'app/builder/page.tsx'

import { DECK_MUTATION_DEDUPE_PAGE_ADDITION } from './studio-deck-mutation-dedupe-strip.mjs'
const PAGE_ADDITIONS = [
  ["persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame\n", 'persistenceRef.current.updateMetadata(updates)\n'],
  ["persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: the page's own count reconcile\n", 'persistenceRef.current.updateMetadata(updates)\n'],
  DECK_MUTATION_DEDUPE_PAGE_ADDITION, // FRONTEND-2 #469 (NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE): its page lines come out too (scripts/studio-deck-mutation-dedupe-strip.mjs)
]

/** `text` is the file at `rel`; only app/builder/page.tsx has lines of this change, any other file is returned as it is. */
export function stripOpenReadOnly(rel, text) {
  if (rel !== PAGE) return text
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): that flag's import and gated element come out too (scripts/studio-duplicate-deck-strip.mjs), so a pin that holds the page to a base commit with this strip alone still sees the base.
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_ELEMENT_REFINE): that flag's gated lines come out too (scripts/studio-chat-element-refine-strip.mjs), so a pin that holds the page to a base commit with this strip alone still sees the base.
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_THEME_CHANGE / NEXT_PUBLIC_CHAT_EXPORT): those flags' gated lines come out first (scripts/studio-chat-theme-export-strip.mjs).
  return PAGE_ADDITIONS.reduce((result, [added, original]) => result.replace(added, original), stripDuplicateDeck(rel, stripChatElementRefine(rel, stripChatThemeExport(rel, stripReconnectResync(rel, stripJobLedger(rel, stripComposeEntitlement(rel, stripNewDeckHandoffSend(rel, stripPublishReviewFit(rel, stripVersionHistoryDeckOnly(rel, stripPublishPreviewInventory(rel, stripPaymentsOpenSoon(rel, stripDuplicateCopyTitle(rel, stripThumbnailLastGood(rel, text))))))))))))))
}
