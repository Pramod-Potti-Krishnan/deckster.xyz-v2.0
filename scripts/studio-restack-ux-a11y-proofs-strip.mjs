// FRONTEND-2 (tests only): the restack of FRONTEND-1's a11y and picker follow-ups (#602) onto Studio dev eeb78d4f.
// - chat-element-edit and deck-sync-truth skip the first-parent commits of FRONTEND-1's "UX: / A11y:" restacks and of these proof fixes (one subject filter each). The two lines are byte for byte the ones #600 adds (mark RESTACK-UX-PROOFS), so the sibling restack branches merge cleanly.
// - model-catalog-2026-10 renders the Intelligence workspace and hashes it against the base: it now reads the source with the stacked a11y change's lines put back (studio-a11y-picker-followups-strip.mjs), so its aria-label is out of the render; dev's other later changes stay in.
// No app file, no flag, no .env.example block. Every edit is registered here as a [has, was] pair, so a pin that reads these proof files through the registry gets them as they were before this change; the strip is plain data and idempotent.
export const RESTACK_UX_A11Y_SUBJECT = /^Restack UX proofs:/
export const RESTACK_UX_A11Y_MARK = "LATER-CHANGES: registry read (RESTACK-UX-A11Y)"
/** [the text this change put in, the text it replaced] per edit (a pure insertion: the replaced text is empty), so putting them back gives the file as it was before this change, byte for byte. */
export const RESTACK_UX_A11Y_EDITS = {
 "scripts/test-studio-chat-element-edit.mjs": [
  [
   "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:UX|A11y|Restack UX proofs): /.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESTACK-UX-PROOFS): FRONTEND-1's UX restacks and their proof fixes (#600-#602): their first-parent commits are theirs, not this change's\n",
   ""
  ]
 ],
 "scripts/test-studio-deck-sync-truth.mjs": [
  [
   "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:UX|A11y|Restack UX proofs): /.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESTACK-UX-PROOFS): FRONTEND-1's UX restacks and their proof fixes (#600-#602): their first-parent commits are theirs, not this change's\n",
   ""
  ]
 ],
 "scripts/test-studio-model-catalog-2026-10.mjs": [
  [
   "import { stripA11yPickerFollowups } from './studio-a11y-picker-followups-strip.mjs' // LATER-CHANGES: registry read (RESTACK-UX-A11Y): the stacked a11y change's lines come out of the workspace source this proof renders\n",
   ""
  ],
  [
   "const source = stripA11yPickerFollowups('components/studio-personal/intelligence-workspace.tsx', fs.readFileSync(path.join(workspaceDir, 'intelligence-workspace.tsx'), 'utf8')) // LATER-CHANGES: registry read (RESTACK-UX-A11Y): the base render hash is of the workspace as it was before the stacked a11y change's aria-label\n",
   "const source = fs.readFileSync(path.join(workspaceDir, 'intelligence-workspace.tsx'), 'utf8')\n"
  ]
 ]
}
export const RESTACK_UX_A11Y_SCOPE_FILES = [...Object.keys(RESTACK_UX_A11Y_EDITS), "scripts/studio-restack-ux-a11y-proofs-strip.mjs", "scripts/studio-later-changes.mjs"]
/** This change undone: each edit put back where it is found (idempotent: a line that is not there is a no-op; a file it did not touch comes back as it is). */
export function stripRestackUxA11y(rel, text) {
  if (typeof text !== "string") return text
  return (RESTACK_UX_A11Y_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
