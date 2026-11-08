// FRONTEND-2 (tests only): the restack of FRONTEND-1's page consistency (#600) onto Studio dev eeb78d4f: proofs that pinned the 4 Nov base now read the later changes through the registry.
// FRONTEND-1 OK'd applying the probed fixes to its proofs (new-logo, p2-details, page-consistency line 45, ux-honesty's ce72dbd0 hunk) in B65's report. No app file, no flag, no .env.example block.
// Every edit is registered here as a [has, was] pair, so a pin that reads these proof files through the registry gets them as they were before this change; the strip is plain data and idempotent.
// The two first-parent subject filters (chat-element-edit and deck-sync-truth) carry the shared mark RESTACK-UX-PROOFS and are byte for byte the same on the sibling restack branches, so they merge cleanly.
// The ux-honesty hunk is FRONTEND-1's ce72dbd0, copied byte for byte (so the stacked branch that has it merges the same change cleanly); it carries no mark.
export const RESTACK_UX_PC_SUBJECT = /^Restack UX proofs:/
export const RESTACK_UX_PC_MARK = "LATER-CHANGES: registry read (RESTACK-UX-PC)"
/** [the text this change put in, the text it replaced] per edit (a pure insertion: the replaced text is empty), so putting them back gives the file as it was before this change, byte for byte. */
export const RESTACK_UX_PC_EDITS = {
 "scripts/test-studio-create-word.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n",
   "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"
  ]
 ],
 "scripts/test-studio-plain-nav-labels.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n",
   "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"
  ]
 ],
 "scripts/test-studio-top-bar-v2.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = file => fs.existsSync(path.join(root, file)) ? stripP2Publish(file, stripLaterChanges(file, fs.readFileSync(path.join(root, file), 'utf8'))) : null // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n",
   "const read = file => fs.existsSync(path.join(root, file)) ? stripP2Publish(file, fs.readFileSync(path.join(root, file), 'utf8')) : null\n"
  ]
 ],
 "scripts/test-studio-new-logo.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = rel => stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')) // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n",
   "const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')\n"
  ]
 ],
 "scripts/test-studio-p2-details.mjs": [
  [
   "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines come out of every file this proof reads\n",
   ""
  ],
  [
   "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n",
   "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))\n"
  ]
 ],
 "scripts/test-studio-page-consistency.mjs": [
  [
   "ok(registry.stripLaterEnvBlocks('.env.example', read('.env.example')) === registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.BASE_COMMIT}:.env.example`)) && read('.env.example').includes(strip.PAGE_CONSISTENCY_ENV_BLOCK), '.env.example is the base plus the block') // LATER-CHANGES: registry read (RESTACK-UX-PC): dev's newer env blocks sit between the base and this block; they come out through the registry, the block itself must still be there\n",
   "ok(read('.env.example') === `${git('show', `${strip.BASE_COMMIT}:.env.example`)}\\n${strip.PAGE_CONSISTENCY_ENV_BLOCK}`, '.env.example is the base plus the block')\n"
  ]
 ],
 "scripts/test-studio-ux-honesty.mjs": [
  [
   "const pageConsistency = await import('./studio-page-consistency-strip.mjs') // PAGE-CONSISTENCY is a later change on the same layout: it comes out first\n",
   ""
  ],
  [
   "  ok(strip.stripUxHonesty(LAYOUT, pageConsistency.stripPageConsistency(LAYOUT, layout)) === execFileSync('git', ['show', `${strip.BASE_COMMIT}:${LAYOUT}`], { cwd: root, encoding: 'utf8' }), 'UX-09: the layout without its PAGE-HEADINGS lines is the base, byte for byte')\n",
   "  ok(strip.stripUxHonesty(LAYOUT, layout) === execFileSync('git', ['show', `${strip.BASE_COMMIT}:${LAYOUT}`], { cwd: root, encoding: 'utf8' }), 'UX-09: the layout without its PAGE-HEADINGS lines is the base, byte for byte')\n"
  ]
 ],
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
 ]
}
export const RESTACK_UX_PC_SCOPE_FILES = [...Object.keys(RESTACK_UX_PC_EDITS), "scripts/studio-restack-ux-pc-proofs-strip.mjs", "scripts/studio-later-changes.mjs"]
/** This change undone: each edit put back where it is found (idempotent: a line that is not there is a no-op; a file it did not touch comes back as it is). */
export function stripRestackUxPc(rel, text) {
  if (typeof text !== "string") return text
  return (RESTACK_UX_PC_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
