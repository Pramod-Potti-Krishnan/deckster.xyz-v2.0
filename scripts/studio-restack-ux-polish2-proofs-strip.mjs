// FRONTEND-2 (tests only): the restack of FRONTEND-1's UX polish 2 (#601, stacked on #600) onto Studio dev eeb78d4f: proofs that pinned the 4 Nov base now read the later changes through the registry.
// FRONTEND-1 OK'd applying the probed fixes to its proofs (ux-polish-2 lines 63-64, p2-publish) in B65's report. No app file, no flag, no .env.example block.
// Every edit is registered here as a [has, was] pair, so a pin that reads these proof files through the registry gets them as they were before this change; the strip is plain data and idempotent.
// The first-parent subject filters of chat-element-edit and deck-sync-truth are #600's (RESTACK-UX-PROOFS): this branch inherits them.
// The legal-short-links proof is edited by PURE INSERTIONS only (3 lines, each a [has, ""] pair): its import line and its UNTOUCHED loop are dev's, byte for byte, because an earlier change (api-hardening) teaches that loop's line and a carrier strip, applied in forward registry order, can never restore a line that a later change rewrote in place (the 8 Nov lesson).
export const RESTACK_UX_POLISH2_SUBJECT = /^Restack UX proofs:/
export const RESTACK_UX_POLISH2_MARK = "LATER-CHANGES: registry read (RESTACK-UX-POLISH2)"
/** [the text this change put in, the text it replaced] per edit (a pure insertion: the replaced text is empty), so putting them back gives the file as it was before this change, byte for byte. */
export const RESTACK_UX_POLISH2_EDITS = {
 "scripts/test-studio-ux-polish-2.mjs": [
  [
   "  ok(registry.stripLaterEnvBlocks('.env.example', files['.env.example']) === registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.BASE_COMMIT}:.env.example`)) && files['.env.example'].includes(strip.UX_POLISH_2_ENV_BLOCK), '.env.example is the base plus the block') // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the blocks of the changes stacked under this one sit between the base and this block; they come out through the registry, the block itself must still be there\n",
   "  ok(files['.env.example'] === `${git('show', `${strip.BASE_COMMIT}:.env.example`)}\\n${strip.UX_POLISH_2_ENV_BLOCK}`, '.env.example is the base plus the block')\n"
  ],
  [
   "  const regDiff = git('diff', '-U0', `${strip.BASE_COMMIT}`, '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line) && line.includes('studio-ux-polish-2-strip.mjs')) // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): only this change's own registry lines count; the restack strips are registered after it\n",
   "  const regDiff = git('diff', '-U0', `${strip.BASE_COMMIT}`, '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n"
  ]
 ],
 "scripts/test-studio-p2-publish.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = rel => stripP2Polish(rel, stripVoiceCore(rel, stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')))) // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the later changes' lines are read out first, innermost\n",
   "const read = rel => stripP2Polish(rel, stripVoiceCore(rel, fs.readFileSync(path.join(root, rel), 'utf8')))\n"
  ]
 ],
 "scripts/test-studio-legal-short-links.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the later changes' lines come out of the files this pin reads that a registered later change touches\n",
   ""
  ],
  [
   "const UNTOUCHED_LATER = UNTOUCHED.filter(rel => LATER_CHANGE_FILES.has(rel)); UNTOUCHED.splice(0, UNTOUCHED.length, ...UNTOUCHED.filter(rel => !LATER_CHANGE_FILES.has(rel))) // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the files a registered later change touches (the root layout: UX polish 2's lines) are read through the registry by the line below; the loop after it keeps every other file, unchanged\n",
   ""
  ],
  [
   "  for (const rel of UNTOUCHED_LATER) eq(sha(stripLaterChanges(rel, stripApiHardening(rel, read(rel)))), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte`)) // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the same check, with the registered later changes' lines out first; a stray line that no registered change owns still fails\n",
   ""
  ]
 ]
}
export const RESTACK_UX_POLISH2_SCOPE_FILES = [...Object.keys(RESTACK_UX_POLISH2_EDITS), "scripts/studio-restack-ux-polish2-proofs-strip.mjs", "scripts/studio-later-changes.mjs"]
/** This change undone: each edit put back where it is found (idempotent: a line that is not there is a no-op; a file it did not touch comes back as it is). */
export function stripRestackUxPolish2(rel, text) {
  if (typeof text !== "string") return text
  return (RESTACK_UX_POLISH2_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
