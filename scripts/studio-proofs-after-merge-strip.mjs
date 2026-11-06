// FRONTEND-2 (tests only): two of FRONTEND-2's older proofs made robust after merge. #475's test-studio-narration-router.mjs reads its siblings'
// added lines at its OWN head, and #521's test-studio-model-choice.mjs reads its route set at its OWN head, as fixed inputs: a later change's registered
// lines in those siblings, and its own routes added or deleted, are that change's business (OPS-2's 05:32Z #571 gate: 2 NEW from exactly this).
// The edits are pure insertions, registered here as a later change, so an older proof that reads these files through the registry gets dev's file
// byte for byte. The two proofs that filter later changes' commits by subject learn this change's subject. No app file, no flag, no .env.example block.
export const PROOFS_AFTER_MERGE_SUBJECT = /^Proofs after merge:/
export const PROOFS_AFTER_MERGE_MARK = "LATER-CHANGES: registry read (PROOFS-AFTER-MERGE)"
/** [the text this change put in, the text it replaced] per edit (pure insertions: the replaced text is empty), so putting them back gives dev's file byte for byte. */
export const PROOFS_AFTER_MERGE_EDITS = {
  "scripts/test-studio-narration-router.mjs": [["    { const lines = (rel, sign) => (gitOut('diff', '-U0', BASE_COMMIT, OWN_HEAD, '--', rel) ?? '').split('\\n').filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3))) // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE), #475 robust after merge: the siblings' lines are read at this change's OWN head (a fixed input, like the strip above), so a later change's registered lines in them (pre-promo's stripLaterChanges import, #590's reducer block) are that change's business\n", ""], ["\n    } // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE), #475: the end of the block above", ""]],
  "scripts/test-studio-model-choice.mjs": [["\n    { const after = routesOf(git('ls-tree', '-r', '--name-only', 'd4e62e0b0affcab480694e056af3946ec23a9136', '--', 'app').split('\\n').filter(Boolean)) // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE), #521 robust after merge: the route set is read at this change's OWN head d4e62e0b (#521's last commit, a fixed input), so a later change's own routes, added or deleted (#584's /api/wallet/precheck, #585's /usage, #589's /api/usage/credits, #571 C-07's /api/dev/mock-token), are that change's business", ""], ["\n    } // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE), #521: the end of the block above", ""]],
  "scripts/test-studio-chat-element-edit.mjs": [["\n  shas.splice(0, shas.length, ...shas.filter(sha => !/^Proofs after merge:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE): on a branch stacked after this change (the older proofs' after-merge fix), the first-parent commits are its own, not this change's", ""]],
  "scripts/test-studio-deck-sync-truth.mjs": [["\n  shas.splice(0, shas.length, ...shas.filter(sha => !/^Proofs after merge:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE): on a branch stacked after this change (the older proofs' after-merge fix), the first-parent commits are its own, not this change's", ""]],
}
export const PROOFS_AFTER_MERGE_SCOPE_FILES = [...Object.keys(PROOFS_AFTER_MERGE_EDITS), "scripts/studio-proofs-after-merge-strip.mjs"]
/** This change undone: each edit put back where it is found (idempotent; a file it did not touch comes back as it is). */
export function stripProofsAfterMerge(rel, text) {
  if (typeof text !== "string") return text
  return (PROOFS_AFTER_MERGE_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
