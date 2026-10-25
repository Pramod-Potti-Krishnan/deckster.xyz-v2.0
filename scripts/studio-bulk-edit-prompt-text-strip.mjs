// FRONTEND-2 (PROGRAM-1, DIRECTOR-2 option a: the whole-deck edit confirm card draws the Director's own prompt_text). Flag NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT (exact "true", default off, build-time); it flips together
// with Director's DIRECTOR_MDC_BULK_EDIT_POLISH_ENABLED. With the flag on, lib/studio-bulk-edit-wire.ts keeps payload.prompt_text in the card's model (promptText: plain text, cleaned like every other text, 600 characters at
// most) and components/builder/chat/studio-bulk-edit-card.tsx draws it once, under the "Whole-deck change" heading and before the quoted instruction; the estimate line is left out when the sentence already says the label.
// The exact lines this change adds to the two files that bulk edit + chat undo owns and older pins hold to an earlier commit ("without this change's lines the file is the base's"): every added line carries the marker
// BULK-EDIT-PROMPT-TEXT and NO base line is changed or removed, so the strip is one rule: a line with the marker goes (stripBulkEditPromptText(rel, text)). The .env.example block is the exact text below, registered as
// BULK_EDIT_PROMPT_TEXT_ENV_BLOCK (scripts/studio-later-changes.mjs takes it out wherever it sits). How the older pins reach it: this change REGISTERS the strip and the block (three registry lines), and stripBulkEditUndo calls
// the registry first, innermost, so every pin that already strips bulk edit + chat undo takes this change's lines out with no edit of its own. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '85b1e8a6f1fd2ae3f0bf1954c417bea7aca45935' // frontend2/pass3-polish-b (#506), the stack this change is cut from
export const BULK_EDIT_PROMPT_TEXT_MARKER = 'BULK-EDIT-PROMPT-TEXT'
export const BULK_EDIT_PROMPT_TEXT_CARD = 'components/builder/chat/studio-bulk-edit-card.tsx'
export const BULK_EDIT_PROMPT_TEXT_WIRE = 'lib/studio-bulk-edit-wire.ts'

/** The two files whose existing lines other pins hold to a base commit: only marked lines are added to them. */
export const BULK_EDIT_PROMPT_TEXT_FILES = [BULK_EDIT_PROMPT_TEXT_CARD, BULK_EDIT_PROMPT_TEXT_WIRE]

/** New files (no base text to put back). */
export const BULK_EDIT_PROMPT_TEXT_NEW_FILES = [
  'lib/studio-bulk-edit-prompt-text.ts',
  'components/builder/chat/studio-bulk-edit-prompt-text.css',
  'scripts/studio-bulk-edit-prompt-text-strip.mjs',
  'scripts/test-studio-bulk-edit-prompt-text.mjs',
  // DIRECTOR-2's offline record.py transcripts 10 and 11 (Director 4330151d, the I2 polish), copied verbatim: RECORDED (the older 01 is scripts/fixtures/chat-undo-v2/01-bulk-confirm-card.json)
  'scripts/fixtures/bulk-edit-prompt-text/10-bulk-polish-title-only.json',
  'scripts/fixtures/bulk-edit-prompt-text/11-bulk-polish-refine-only-and-rebuild-card.json',
  'scripts/fixtures/bulk-edit-prompt-text/SOURCES.sha256',
]

/** Files this change edits that are not new: .env.example (its block) and the registry (three lines: its files, its block, its strip). No older test is edited. */
export const BULK_EDIT_PROMPT_TEXT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const BULK_EDIT_PROMPT_TEXT_SCOPE_FILES = new Set([...BULK_EDIT_PROMPT_TEXT_FILES, ...BULK_EDIT_PROMPT_TEXT_NEW_FILES, ...BULK_EDIT_PROMPT_TEXT_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const BULK_EDIT_PROMPT_TEXT_ENV_BLOCK = `# STUDIO BULK EDIT PROMPT TEXT (FRONTEND-2; follows the whole-deck edit card, NEXT_PUBLIC_STUDIO_BULK_EDIT). On for the exact value "true"; default off, and then nothing changes: the card is drawn exactly as before.
# Flip it TOGETHER with Director's DIRECTOR_MDC_BULK_EDIT_POLISH_ENABLED: Director's polished confirm sends its own sentence for the card (payload.prompt_text: what it will change, how, and the rough cost), and with
# this flag on the card draws that sentence once, as plain text, under the "Whole-deck change" heading and before the quoted instruction. The sentence already carries the estimate label, so the card's own
# "Estimate:" line is then left out (the label is never drawn twice); a missing or empty sentence draws nothing new. Build-time value: change it on Vercel and redeploy. Safe to set before the Director flag: no sentence, no change.
NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT="false"
`

/** The files without this change's lines: every line that carries the marker is taken out, every other byte stays. Any other file is returned as it is. */
export function stripBulkEditPromptText(rel, text) {
  if (!BULK_EDIT_PROMPT_TEXT_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !line.includes(BULK_EDIT_PROMPT_TEXT_MARKER)).join('\n')
}
