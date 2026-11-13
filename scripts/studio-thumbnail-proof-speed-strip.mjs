// FRONTEND-2, thumbnail-last-good proof speed-up (tests only): scripts/test-studio-thumbnail-last-good.mjs took 339 s alone (414-463 s in a gate, past the gate's 600 s cap under load) because its scope check (section 9) spawns git
// about 1600 times, once per file of the committed diff, and the proof runs sections 1-9 once and then once more for each of its 33 mutants. Its git helper now remembers each answer (the repo does not change while the proof runs).
// Nothing else in the proof changed: the nine sections, the 25 checks and the 33 mutants are the same, and every line other changes pin inside it (the registry imports and read(), the scope filter, the added-lines read) is as it was.
// This strip puts the one edited line back, so an older proof that reads that file raw gets dev's file byte for byte. No app file, no flag, no .env.example block, no other file edited but the registry (two lines: its files and its strip).
/** [the text this change put in, the text it replaced] per edit, whole lines, so putting them back gives dev's file byte for byte. */
export const THUMBNAIL_PROOF_SPEED_EDITS = {
  "scripts/test-studio-thumbnail-last-good.mjs": [["const gitCache = new Map() // speed (tests only): the repo does not change while the proof runs, so a git answer is the same every time; the scope check (section 9) spawns git about 1600 times (one ls-tree per file) and every one of the 33 mutant runs repeats it\nconst git = (...args) => { const key = args.join('\\0'); if (!gitCache.has(key)) gitCache.set(key, execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })); return gitCache.get(key) }\n", "const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })\n"]],
}
export const THUMBNAIL_PROOF_SPEED_SCOPE_FILES = ["scripts/test-studio-thumbnail-last-good.mjs", "scripts/studio-thumbnail-proof-speed-strip.mjs", "scripts/studio-later-changes.mjs"]
/** This change undone: each edit put back where it is found (idempotent; a file it did not touch comes back as it is). */
export function stripThumbnailProofSpeed(rel, text) {
  if (typeof text !== "string") return text
  return (THUMBNAIL_PROOF_SPEED_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
