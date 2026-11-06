// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR D, accessibility, stacked on PR C on PR B on PR A). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as the others,
// PR A's lib/studio-pass3-polish.ts STUDIO_PASS3_POLISH_ENABLED (it also needs NEXT_PUBLIC_STUDIO_V4_SHELL). PR D holds two findings of the accessibility facts pass (the run of 01:05Z): the Decks tab list has no accessible name (components/ui/tabs.tsx
// gives a TabsList that carries data-studio-deck-tabs the aria-label "Deck views") and /builder has no main landmark and no h1 (its workspace container gets role="main" from an effect, and a visually hidden h1 says "Builder" or
// "Builder: <deck title>"). The session-history panel (the facts' item a) needs nothing: it is already inert while closed.
// The exact lines this change adds to the two app files that older pins hold to an earlier commit ("without this change's lines the file is the base's"): components/ui/tabs.tsx (2 lines) and app/builder/page.tsx (3 lines). NOTHING IS CHANGED
// OR REMOVED IN A BASE LINE, and no base line gets a new attribute (several older pins keep every base line, in order, as a line: an attribute added to a long base line would fail them): every added line carries the marker PASS3-POLISH-D
// (its own; PR A's is PASS3-POLISH, PR B's PASS3-POLISH-B, PR C's PASS3-POLISH-C; a marker is matched as a WHOLE token, so no strip takes another's), so the strip is one rule: a line with the marker goes (stripPass3PolishD(rel, text)).
// How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR A's), and stripBulkEditUndo calls the registry first, innermost.
// scripts/test-studio-pass3-polish-d.mjs proves that the two files without this change's lines are BASE_COMMIT's files byte for byte. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '2fb5e66b9eab51c98c498caa079fa28c8ecf0555' // studio dev head (#504) PR A merged: the Builder page and tabs.tsx are held to it (with the other polish PRs' lines out)
export const PASS3_POLISH_D_MARKER = 'PASS3-POLISH-D'
/** The marker as a WHOLE token: PASS3-POLISH-D is this change's; PASS3-POLISH, PASS3-POLISH-B, PASS3-POLISH-C and any other suffix are not. */
export const PASS3_POLISH_D_MARKER_RE = /(?<![\w-])PASS3-POLISH-D(?![\w-])/
export const PASS3_POLISH_D_TABS = 'components/ui/tabs.tsx'
export const PASS3_POLISH_D_BUILDER = 'app/builder/page.tsx'

/** The two app files whose existing lines are held to a base commit: only marked lines are added to them. */
export const PASS3_POLISH_D_FILES = [PASS3_POLISH_D_TABS, PASS3_POLISH_D_BUILDER]

/** New files (no base text to put back). */
export const PASS3_POLISH_D_NEW_FILES = [
  'lib/studio-pass3-polish-d.ts',
  'scripts/studio-pass3-polish-d-strip.mjs',
  'scripts/test-studio-pass3-polish-d.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip) and PR B's proof (it read the Builder page without the registry, so every later PR's lines in the page broke it; one registry-read edit, like PR A's). */
export const PASS3_POLISH_D_OWN_EDITS = ['scripts/studio-later-changes.mjs', 'scripts/test-studio-pass3-polish-b.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_D_SCOPE_FILES = new Set([...PASS3_POLISH_D_FILES, ...PASS3_POLISH_D_NEW_FILES, ...PASS3_POLISH_D_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishD(rel, text) {
  if (!PASS3_POLISH_D_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !PASS3_POLISH_D_MARKER_RE.test(line)).join('\n')
}
