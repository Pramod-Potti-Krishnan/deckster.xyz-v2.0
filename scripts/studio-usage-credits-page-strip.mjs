// FRONTEND-2 (B63): the credits view of B62 (#589, components/studio-usage-credits.tsx) on FRONTEND-1's Usage page (#585, app/(app)/usage/page.tsx). NO new flag: <StudioUsageCredits /> returns null unless #589's NEXT_PUBLIC_STUDIO_USAGE_CREDITS is exactly
// "true" (default off), and the page itself is a 404 unless FRONTEND-1's NEXT_PUBLIC_STUDIO_USAGE_PAGE is on. With the credits flag off the page renders exactly as it does today (no wrapper is left behind: the className lands on the view's own root).
// FRONTEND-1 owns the page. Their OK (6 Nov, 16:28Z) covers ONLY these two lines, "as written", on two conditions: (1) before anything in ANY of their proofs changes they are sent the exact lines, and if one of their proofs fails this change STOPS and
// reports the 1-2 line edit (none of their files is edited here); (2) the screen shows credits only: no USD or provider cost, no tokens, no model names (the view already does this; the proof renders every state and the page, and proves it).
// Every line this change adds to an EXISTING app file carries the marker USAGE-CREDITS (a WHOLE token, the one #589 named for them). Strip the two lines and the page is dev's, byte for byte (stripUsageCreditsPage(rel, text)).
// The older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits of BASE..HEAD for their own commits' subjects get one more inserted line each, for "Usage credits page:", as #567 / #568 /
// #589 / B61 did. The subject is "Usage credits page:" and NOT "Usage credits:": #589's proof names the page as a foreign file for commits with its own subject.
// How the older pins reach it: this change REGISTERS its files and its strip (scripts/studio-later-changes.mjs, two lines; no .env.example block, because there is no new flag). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eff9ad41a5b475d586186d657cff5c1550862577' // Studio dev (6 Nov), the merge of #593
/** No new flag: this is #589's. */
export const USAGE_CREDITS_PAGE_FLAG = 'NEXT_PUBLIC_STUDIO_USAGE_CREDITS'
export const USAGE_CREDITS_PAGE_MARKER = 'USAGE-CREDITS'
/** The marker as a WHOLE token: USAGE-CREDITS is this change's (and #589's); USAGE-CREDITS-X, X-USAGE-CREDITS and any other prefix or suffix are not. */
export const USAGE_CREDITS_PAGE_MARKER_RE = /(?<![\w-])USAGE-CREDITS(?![\w-])/
/** The subject prefix of this change's own commits. Not "Usage credits:" (that is #589's, and its proof refuses the page as a foreign file for commits with that subject). */
export const USAGE_CREDITS_PAGE_SUBJECT = 'Usage credits page:'

/** The one existing app file that gets marked lines: FRONTEND-1's Usage page. */
export const USAGE_CREDITS_PAGE_FILE = 'app/(app)/usage/page.tsx'
/** The two lines, byte for byte. The import goes right after the import of "@/lib/studio-billing-usage"; the JSX line is the last child of <main> in the loaded return, right after `) : null}`. */
export const USAGE_CREDITS_PAGE_IMPORT = 'import { StudioUsageCredits } from "@/components/studio-usage-credits" // USAGE-CREDITS'
export const USAGE_CREDITS_PAGE_JSX = '      <StudioUsageCredits className="mt-6" />{/* USAGE-CREDITS */}'
/** The lines they go after (both are in the base page, the way FRONTEND-1 wrote it). */
export const USAGE_CREDITS_PAGE_IMPORT_AFTER = 'import { formatCredits, isStudioQuotaScreensOn, isStudioUsagePageOn, refusalCopy, usageView, utcMonthPeriod, type UsageView } from "@/lib/studio-billing-usage"'
export const USAGE_CREDITS_PAGE_JSX_AFTER = '      ) : null}'

/** The older proofs this change teaches, and the page: [text the file has now, text the base commit's file has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line a taught proof has now carries USAGE_CREDITS_PAGE_PIN_MARK. */
export const USAGE_CREDITS_PAGE_PIN_MARK = '// LATER-CHANGES: registry read (USAGE-CREDITS-PAGE)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Usage credits page:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (USAGE-CREDITS-PAGE): on a branch stacked after this change (the usage credits page lines), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const USAGE_CREDITS_PAGE_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}
/** Where each taught line goes: right after the last subject filter the base proof has, B61's "Chat caps:" (the line that starts with this text). */
export const USAGE_CREDITS_PAGE_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat caps:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-CAPS-META)"
/** Every [has, was] pair this change makes, by file: the page (both lines, was = ''), then each taught proof. */
export const USAGE_CREDITS_PAGE_EDITS = {
  [USAGE_CREDITS_PAGE_FILE]: [[`${USAGE_CREDITS_PAGE_IMPORT}\n`, ''], [`${USAGE_CREDITS_PAGE_JSX}\n`, '']],
  ...USAGE_CREDITS_PAGE_PIN_EDITS,
}

/** The older proofs this change teaches. */
export const USAGE_CREDITS_PAGE_PIN_FILES = Object.keys(USAGE_CREDITS_PAGE_PIN_EDITS)

/** New files (no base text to put back). */
export const USAGE_CREDITS_PAGE_NEW_FILES = ['scripts/studio-usage-credits-page-strip.mjs', 'scripts/test-studio-usage-credits-page.mjs']

/** Files this change edits that are not app code: the registry (two lines: its files, its strip; none in the env list) and the older proofs it teaches. */
export const USAGE_CREDITS_PAGE_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...USAGE_CREDITS_PAGE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const USAGE_CREDITS_PAGE_SCOPE_FILES = new Set([USAGE_CREDITS_PAGE_FILE, ...USAGE_CREDITS_PAGE_NEW_FILES, ...USAGE_CREDITS_PAGE_OWN_EDITS])

/** `text` with one whole line taken out: `has` is the line with its newline, and it counts only at the start of a line (it must be a whole line, never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: the page loses its two marked lines, an older proof this change taught gets its base text back. Any other file is returned as it is. Idempotent: a file that has none of the lines comes back as it is. */
export function stripUsageCreditsPage(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(USAGE_CREDITS_PAGE_EDITS, rel)) return text
  return USAGE_CREDITS_PAGE_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
