// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR E, stacked on the prompt-text PR #509, which carries PR D on PR C on PR B; PR A is merged). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as the
// others, PR A's lib/studio-pass3-polish.ts (it also needs NEXT_PUBLIC_STUDIO_V4_SHELL). PR E puts right two phone side effects of PR A's section 2 (text controls are 16px on a phone): the Director prompt's empty hint wrapped and the
// composer toolbar covered its second line, and the Intelligence page's five task selects ran their value under the chevron. It is CSS only, in a stylesheet of its own (components/studio-pass3-polish/studio-pass3-polish-e.css,
// every rule scoped to <html data-studio-pass3-polish="true">); PR A's stylesheet and every older test are left as they are.
// Where PR A's stylesheet comes in (hooks/use-studio-pass3-polish.ts) cannot take the import: PR A's proof loads that hook in a vm whose only stand-ins are PR A's own imports, so a new import there fails it. The two app files
// that draw the hook take it instead, one line each: app/builder/page.tsx (the Builder) and app/(app)/layout.tsx (the account pages: Intelligence, Decks, Templates ...). NOTHING IS CHANGED OR REMOVED IN A BASE LINE: each added line
// carries the marker PASS3-POLISH-E (its own; PR A's is PASS3-POLISH, B's PASS3-POLISH-B, C's PASS3-POLISH-C, D's PASS3-POLISH-D; a marker is matched as a WHOLE token, so no strip takes another's), so the strip is one rule: a line
// with the marker goes (stripPass3PolishE(rel, text)).
// How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR A's), and stripBulkEditUndo calls the registry first, innermost.
// scripts/test-studio-pass3-polish-e.mjs proves that the two files without this change's lines are BASE_COMMIT's files byte for byte. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '75a88520088ab45bcd340f143233e3ee16d831cd' // the prompt-text PR's head (#509, which contains #506 to #508), this change is cut from
export const PASS3_POLISH_E_MARKER = 'PASS3-POLISH-E'
/** The marker as a WHOLE token: PASS3-POLISH-E is this change's; PASS3-POLISH, PASS3-POLISH-B, -C, -D and any other suffix are not. */
export const PASS3_POLISH_E_MARKER_RE = /(?<![\w-])PASS3-POLISH-E(?![\w-])/
export const PASS3_POLISH_E_BUILDER = 'app/builder/page.tsx'
export const PASS3_POLISH_E_LAYOUT = 'app/(app)/layout.tsx'
export const PASS3_POLISH_E_CSS = 'components/studio-pass3-polish/studio-pass3-polish-e.css'

/** The two app files whose existing lines are held to a base commit: only one marked line, the stylesheet import, is added to each. */
export const PASS3_POLISH_E_FILES = [PASS3_POLISH_E_BUILDER, PASS3_POLISH_E_LAYOUT]

/** New files (no base text to put back). */
export const PASS3_POLISH_E_NEW_FILES = [
  PASS3_POLISH_E_CSS,
  'scripts/studio-pass3-polish-e-strip.mjs',
  'scripts/test-studio-pass3-polish-e.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). No older test is edited. */
export const PASS3_POLISH_E_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_E_SCOPE_FILES = new Set([...PASS3_POLISH_E_FILES, ...PASS3_POLISH_E_NEW_FILES, ...PASS3_POLISH_E_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishE(rel, text) {
  if (!PASS3_POLISH_E_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !PASS3_POLISH_E_MARKER_RE.test(line)).join('\n')
}
