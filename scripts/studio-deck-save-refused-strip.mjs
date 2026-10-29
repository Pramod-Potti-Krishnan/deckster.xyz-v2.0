// FRONTEND-2 (B46, 29 Oct; the Studio half of Layout MR !263, LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED). Flag NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE (exact "true", default off, build-time; it acts only with
// NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE and NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH): when Layout refuses a stale whole-deck save (409 DECK_CHANGED; the viewer posts saveStatusChanged with status "error" and
// `deckChanged: true`), Studio shows its EXISTING "This deck was updated · Reload deck" notice and does not count the refusal as this tab's own edit. The rules are in lib/studio-deck-save-refused.ts (import-free).
//
//   THE DEFECT. components/presentation-viewer.tsx's save-status handler counted every non-"saved" status as this tab's own autosave (reportOwnDeckEdit) and set the save status to "error": a generic "Save failed", while
//   the deck had changed on the server (Director's add / duplicate / delete / undo / refine) and nothing said so. A Retry is refused again.
//   THE FIX (flag on). The refusal (status "error" + deckChanged === true; "unsaved" and "saving" carry deckChanged too once refused, and stay the user's own edit) is handed to the notice hook, which asks the controller
//   (noteSaveRefused) for the same notice a focus check raises, at once: "This deck was updated" with "Reload deck" and "Dismiss". The save status stays "error" (the header keeps its own words), which the hook reads as
//   unsaved edits: Reload deck asks first ("This tab has changes that are not saved yet. Reloading drops them." / Reload anyway / Keep editing), so the pending change is never dropped without the user's say.
//
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker DECK-SAVE-REFUSED-NOTICE (matched as a whole token): components/presentation-viewer.tsx (an import and one line before the
// base's reportOwnDeckEdit() call: `if (isDeckSaveRefused(event.data)) reportDeckSaveRefused(); else`, which makes that call its else branch, the way the base's own studioArrangeOwnsSaveStatus line guards the next one),
// lib/studio-deck-changed-notice.ts (the controller's noteSaveRefused: one interface line, one method) and hooks/use-deck-changed-notice.ts (an import, the subscription, its unsubscribe). Strip those lines and each
// file is its base, byte for byte. The new files (the lib, this strip, the proof, its fixture) have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '61568fe6b7e07972051f1103749ee4551dd76ef5' // origin/studio-v4-dev-preparation-code with #544 merged (tree 59a79621), the commit this change is read against.
export const DECK_SAVE_REFUSED_FLAG = 'NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE'
export const DECK_SAVE_REFUSED_MARKER = 'DECK-SAVE-REFUSED-NOTICE'
/** The marker as a WHOLE token: DECK-SAVE-REFUSED-NOTICE-X and X-DECK-SAVE-REFUSED-NOTICE are not this change's. */
export const DECK_SAVE_REFUSED_MARKER_RE = /(?<![\w-])DECK-SAVE-REFUSED-NOTICE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const DECK_SAVE_REFUSED_SUBJECT = 'Save refused notice:'

/** Existing files that get marked lines (pure insertions only). */
export const DECK_SAVE_REFUSED_FILES = [
  'components/presentation-viewer.tsx',
  'hooks/use-deck-changed-notice.ts',
  'lib/studio-deck-changed-notice.ts',
]

/** New files (no base text to put back). */
export const DECK_SAVE_REFUSED_NEW_FILES = [
  'lib/studio-deck-save-refused.ts',
  'scripts/studio-deck-save-refused-strip.mjs',
  'scripts/studio-deck-save-refused-layout.mjs',
  'scripts/test-studio-deck-save-refused-notice.mjs',
  'scripts/fixtures/studio-deck-save-refused/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries DECK_SAVE_REFUSED_PIN_MARK. */
export const DECK_SAVE_REFUSED_PIN_MARK = 'LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE)'
export const DECK_SAVE_REFUSED_PIN_EDITS = {
  // Pass 3 polish B's strip is what COMPOSER-2's first-paint viewer pin reads the viewer through: this change's marked viewer lines come out in it first (the pattern STUDIO-ARRANGE, CHAT-ELEMENT-EDIT and DECK-SYNC-TRUTH used). Two pure insertions.
  "scripts/studio-pass3-polish-b-strip.mjs": [
    [
      "import { stripDeckSaveRefused } from './studio-deck-save-refused-strip.mjs' // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): B46 adds marked lines to the viewer, so they come out first and the viewer read through this strip is its base again\n",
      ""
    ],
    [
      "  if (rel === PASS3_POLISH_B_VIEWER) text = stripDeckSaveRefused(rel, text) // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE)\n",
      ""
    ]
  ],
  // The targeted chat edit proof (#540) runs the viewer's real save-status effect with a fixed set of deps; it reads the viewer past the changes registered after it. One line.
  "scripts/test-studio-chat-edit-targeted.mjs": [
    [
      "  const viewerTsx = sources['components/presentation-viewer.tsx'] ?? laterRead('components/presentation-viewer.tsx') // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): a change registered after this one marks lines in the viewer's save-status handler; the handler is cut out without them\n",
      "  const viewerTsx = sources['components/presentation-viewer.tsx'] ?? read('components/presentation-viewer.tsx')\n"
    ]
  ]
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackDeckSaveRefusedPin(rel, text) {
  return (DECK_SAVE_REFUSED_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const DECK_SAVE_REFUSED_PIN_FILES = Object.keys(DECK_SAVE_REFUSED_PIN_EDITS)

export const DECK_SAVE_REFUSED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...DECK_SAVE_REFUSED_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const DECK_SAVE_REFUSED_SCOPE_FILES = new Set([...DECK_SAVE_REFUSED_FILES, ...DECK_SAVE_REFUSED_NEW_FILES, ...DECK_SAVE_REFUSED_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const DECK_SAVE_REFUSED_ENV_BLOCK = `# STUDIO DECK SAVE REFUSED NOTICE (FRONTEND-2, B46; the Studio half of Layout MR !263, LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED). On for the exact value "true"; default off, and then the viewer's save status is exactly as before. Build-time value: change it on Vercel and redeploy.
# On: when Layout refuses a stale whole-deck save (409 DECK_CHANGED: Director added, deleted or changed a slide since this tab loaded the deck; the viewer reports status "error" with deckChanged), Studio shows its existing notice "This deck was updated · Reload deck" at once and does not
# count the refusal as this tab's own edit. The header keeps its own save-failed wording. The pending change is never dropped without the user's say: with unsaved edits, Reload deck asks first (Reload anyway / Keep editing). No new text, no new request, no Layout or Director change here.
# It acts only with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE (the notice) AND NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH (the notice's words by cause; without it the notice would say "in another tab"). With either off this flag does nothing. Layout's flag on its own (without this one) leaves the generic "Save failed".
NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripDeckSaveRefused(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in DECK_SAVE_REFUSED_PIN_EDITS) return putBackDeckSaveRefusedPin(rel, text) // an older proof this change taught: its previous text
  if (!DECK_SAVE_REFUSED_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !DECK_SAVE_REFUSED_MARKER_RE.test(line)).join('\n')
}
