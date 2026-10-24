// Studio theme Dark persistence (flag NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST): the lines this change adds to app/builder/page.tsx and
// lib/studio-theme-restore.ts, which other pins hold to a base commit ("without the added lines the file is <base>'s"). Sibling pins call
// stripDarkPersist(rel, text) first and then do what they always did, the way they already strip the J2-04 status lines
// (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-theme-dark-persist.mjs proves the strip against the merge parent of #422 (9f49e94, the merge of #421) and that
// every addition is inert with the flag off.

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

export const PAGE = 'app/builder/page.tsx'
export const RESTORE = 'lib/studio-theme-restore.ts'

const PAGE_ADDITIONS = [
  ["import { carryPaletteMode, presetPaletteModeField } from '@/lib/studio-theme-dark-toggle'\n", ''],
  ['...presetPaletteModeField(raw), ', ''],
  [`    // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST: a pick (preset chip, brand colour, saved theme) that names no Light / Dark keeps the one chosen in the theme panel,
    // and the active saved theme then holds the same payload, so it still matches. Flag off, \`carried\` is \`next\` itself and nothing below differs.
    const carried = carryPaletteMode(next, buildThemeSelectionRef.current)
    setActiveBuildThemeProfile(current => (
      buildThemeProfileMatchesSelection(current, next) ? (current && carried !== next ? { ...current, theme_payload: carried } : current) : null
    ))
    themeSelectionChangedLocallyRef.current = true
    setBuildThemeSelection(carried)
`, `    setActiveBuildThemeProfile(current => (
      buildThemeProfileMatchesSelection(current, next) ? current : null
    ))
    themeSelectionChangedLocallyRef.current = true
    setBuildThemeSelection(next)
`],
]

const RESTORE_ADDITIONS = [
  ["import { presetPaletteModeField } from '@/lib/studio-theme-dark-toggle'\n", ''],
  [` * A preset keeps its palette_mode 'light' | 'dark' only with NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST (presetPaletteModeField); off, it comes back without it.\n`, ''],
  ['      ...presetPaletteModeField(theme),\n', ''],
]

/** `text` of repo file `rel` without this change's additions (any other file comes back as it is). */
export function stripDarkPersist(rel, text) {
  const additions = rel === PAGE ? PAGE_ADDITIONS : rel === RESTORE ? RESTORE_ADDITIONS : null
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): that flag's import and gated element come out first (scripts/studio-duplicate-deck-strip.mjs).
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_ELEMENT_REFINE): that flag's gated lines come out first (scripts/studio-chat-element-refine-strip.mjs).
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_THEME_CHANGE / NEXT_PUBLIC_CHAT_EXPORT): those flags' gated lines come out first (scripts/studio-chat-theme-export-strip.mjs).
  return additions ? additions.reduce((out, [from, to]) => out.replace(from, () => to), stripDuplicateDeck(rel, stripChatElementRefine(rel, stripChatThemeExport(rel, stripReconnectResync(rel, stripJobLedger(rel, stripComposeEntitlement(rel, stripNewDeckHandoffSend(rel, stripPublishReviewFit(rel, stripVersionHistoryDeckOnly(rel, stripPublishPreviewInventory(rel, text))))))))))) : text
}
