// PASS2B G38 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES, default off). Standalone and import-free: pure string work, no React, no clock, no network.
//
// A template uploaded to the composer library is stored under a long machine name:
//   "Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7ure0-0000-4000-8000-n0rthw1nd030]"
// (Director's stage-template router: file name + " — upload YYYY-MM-DD HH:MM UTC [template id]"). The accepted v4 mockup lists a template by a short
// name. `studioTemplateDisplayName` makes that name for DISPLAY ONLY: the stored name, the template id and every selection payload stay as they are,
// and the pickers keep the full name in a title (tooltip). Other code (the Save-as-Template dialog, for one) may import it.
//
// What it removes, in this order:
//   1. the upload suffix: " — upload <date>[ <time>][ UTC]" and, right after it, the template id in square brackets (an en dash or a spaced hyphen
//      is accepted for the em dash; a date is required, so a name that merely contains the word "upload" is left alone);
//   2. a presentation file extension at the end (.pptx .pptm .ppt .potx .potm .pot .ppsx .ppsm .pps .odp .key; other dots are part of the name);
//   3. underscores become spaces, runs of white space collapse, the ends are trimmed.
// A name with no such parts comes back unchanged apart from step 3's tidying, a bracket that is not the upload suffix's id is kept ("Board deck
// [draft]"), and the result is never empty: if everything would be removed, the original string is returned as it was given. A string over 1,000
// characters (a stored name is at most 255) is returned as given.

const UPLOAD_SUFFIX = /\s+[\u2014\u2013-]\s+upload\s+\d{4}-\d{2}-\d{2}[^\[\]]*?(?:\s*\[[^\[\]]*\])?\s*$/i
const MAX_NAME_LENGTH = 1000
const EXTENSION = /\.(?:pptx|pptm|ppt|potx|potm|pot|ppsx|ppsm|pps|odp|key)\s*$/i

export function studioTemplateDisplayName(name: string): string {
  if (typeof name !== 'string') return ''
  // A stored name is at most 255 characters (the router truncates it); anything far beyond that is not a name this was made for.
  if (name.length > MAX_NAME_LENGTH) return name
  const shown = name
    .replace(UPLOAD_SUFFIX, '')
    .replace(EXTENSION, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return shown || name
}

/** What a picker draws for a template name: the display name with the flag on, the stored name exactly as it was with it off. */
export function studioTemplateShownName(name: string, enabled: boolean): string {
  return enabled === true ? studioTemplateDisplayName(name) : name
}

/**
 * The tooltip that keeps the full stored name, as props to spread (`<span {...studioTemplateTitleProps(name, enabled)}>`): { title: name } only when the
 * flag is on and the shown name differs, otherwise {} so that nothing is added to the element (the flag-off tree has no `title` key at all).
 */
export function studioTemplateTitleProps(name: string, enabled: boolean): { title?: string } {
  return enabled === true && studioTemplateDisplayName(name) !== name ? { title: name } : {}
}
