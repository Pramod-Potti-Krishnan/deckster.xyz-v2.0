// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR C, stacked on PR B on PR A). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as PR A, defined by PR A's
// lib/studio-pass3-polish.ts (STUDIO_PASS3_POLISH_ENABLED: it also needs NEXT_PUBLIC_STUDIO_V4_SHELL). PR C closes one finding of the transcript check of DIRECTOR-2's recordings 08-11 (Director !548): a chip that is already Undone stays
// Undone. Without it the store lets a LATER undo_result for the same change_id overwrite "restored" (a click on the chip and a typed "undo that" in flight at once: Director answers restored, then superseded / not_latest), and the chip
// reads "A later change replaced this" after a successful undo. With the flag on a restored chip keeps its state; every other phase behaves as before (failed -> restored on a retry still works).
// The exact lines this change adds to the one app file an older pin holds to an earlier commit: lib/studio-bulk-edit-store.ts. NOTHING IS CHANGED OR REMOVED IN A BASE LINE: both added lines carry the marker PASS3-POLISH-C (its own; PR A's
// is PASS3-POLISH, PR B's PASS3-POLISH-B; a marker is matched as a WHOLE token, so none of the three takes another's line), so the strip is one rule: a line with the marker goes (stripPass3PolishC(rel, text)).
// How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR A's), and stripBulkEditUndo calls the registry first,
// innermost, so every pin that already strips bulk edit + chat undo takes this change's lines out with no edit of its own. scripts/test-studio-pass3-polish-c.mjs proves that the store without this change's lines is BASE_COMMIT's file byte for byte.
// Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '2fb5e66b9eab51c98c498caa079fa28c8ecf0555' // studio dev head (#504) PR A merged: the store file is the same there as at the #503 merge (b2423e20)
export const PASS3_POLISH_C_MARKER = 'PASS3-POLISH-C'
/** The marker as a WHOLE token: PASS3-POLISH-C is this change's; PASS3-POLISH, PASS3-POLISH-B and any other suffix are not. */
export const PASS3_POLISH_C_MARKER_RE = /(?<![\w-])PASS3-POLISH-C(?![\w-])/
export const PASS3_POLISH_C_STORE = 'lib/studio-bulk-edit-store.ts'

/** The one app file whose existing lines other pins hold to a base commit: only marked lines are added to it. */
export const PASS3_POLISH_C_FILES = [PASS3_POLISH_C_STORE]

/** The recordings of Director !548 (transcripts 08 to 11), byte-identical copies of docs/mdc/bulk-edit-undo-frames/ in the Director repo at its commit 4330151d: the proof feeds them through the store with 01 to 07 (the two older fixture folders). */
export const PASS3_POLISH_C_FIXTURES = [
  'scripts/fixtures/pass3-polish-c/08-bulk-polish-one-name-per-slide.json',
  'scripts/fixtures/pass3-polish-c/09-typed-undo.json',
  'scripts/fixtures/pass3-polish-c/10-bulk-polish-title-only.json',
  'scripts/fixtures/pass3-polish-c/11-bulk-polish-refine-only-and-rebuild-card.json',
]

/** New files (no base text to put back). */
export const PASS3_POLISH_C_NEW_FILES = [
  'scripts/studio-pass3-polish-c-strip.mjs',
  'scripts/test-studio-pass3-polish-c.mjs',
  ...PASS3_POLISH_C_FIXTURES,
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). */
export const PASS3_POLISH_C_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_C_SCOPE_FILES = new Set([...PASS3_POLISH_C_FILES, ...PASS3_POLISH_C_NEW_FILES, ...PASS3_POLISH_C_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishC(rel, text) {
  if (!PASS3_POLISH_C_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !PASS3_POLISH_C_MARKER_RE.test(line)).join('\n')
}
