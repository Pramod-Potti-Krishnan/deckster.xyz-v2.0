// PASS2D T (flag NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES, default off). Standalone and import-free: pure string work, no React, no clock, no network.
//
// An uploaded template starts a session that is titled with the stored upload name, e.g.
//   "Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7ure0-0000-4000-8000-n0rthw1nd030]"   or just   "Q3_report_final_v2.pptx"
// and the deck list drew that string as the deck's title. PASS2B G38 (lib/studio-template-display-name.ts, flag NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES)
// already has the cleaner that turns such a name into "Deck03 Northwind QBR"; it was used for the template pickers only. This module decides WHEN a deck
// title is an upload name and applies the caller's cleaner to it, so the cleaner is reused, not copied (the caller passes it in; nothing is imported here).
//
// A title is an upload name when it ends in a presentation file extension, or carries the router's " — upload <date>" suffix (the same two marks the cleaner
// removes). Any other title ("Quarterly Review", "Q3_plan" with no extension, "Why upload speed matters") is returned exactly as it was: a deck the user or
// Director named is never reworded. The cleaner's own never-empty rule is kept (an empty or non-string result falls back to the stored title).

const PRESENTATION_EXTENSION = /\.(?:pptx|pptm|ppt|potx|potm|pot|ppsx|ppsm|pps|odp|key)\s*$/i
const UPLOAD_SUFFIX = /\s+[—–-]\s+upload\s+\d{4}-\d{2}-\d{2}/i
const MAX_TITLE_LENGTH = 1000

/** True for a stored upload name: a presentation extension at the end, or the " — upload <date>" suffix. */
export function isUploadDeckTitle(title: string): boolean {
  if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH) return false
  return PRESENTATION_EXTENSION.test(title) || UPLOAD_SUFFIX.test(title)
}

/** What the deck list draws as a deck's title: the cleaned name for an upload name, the stored title (same string) for anything else. */
export function studioDeckShownTitle(title: string, clean: (name: string) => string): string {
  if (!isUploadDeckTitle(title)) return title
  let shown: unknown
  try { shown = clean(title) } catch { return title }
  return typeof shown === 'string' && shown.trim() !== '' ? shown : title
}

/**
 * The tooltip that keeps the full stored title, as props to spread: { title } only when the shown title differs from it, otherwise {} so the flag-off element
 * has no `title` key at all.
 */
export function studioDeckTitleProps(stored: string, shown: string): { title?: string } {
  return typeof stored === 'string' && typeof shown === 'string' && shown !== stored ? { title: stored } : {}
}
