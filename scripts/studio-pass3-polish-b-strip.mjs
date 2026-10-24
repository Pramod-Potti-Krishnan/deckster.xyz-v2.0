// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR B). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as PR A, defined by PR A; this PR
// uses it from lib/studio-pass3-polish-b.ts. PR B holds two findings of the static audit: #7 (the browser's confirm() / alert() in Studio flows become the Studio dialog and toast) and #5 (the Decks page's empty
// state in plain words).
// The exact lines this change adds to the three app files that older pins hold to an earlier commit ("without this change's lines the file is the base's"): app/builder/page.tsx,
// components/presentation-viewer.tsx and app/(app)/dashboard/page.tsx. NOTHING IS REMOVED FROM A BASE LINE: every added line carries the marker PASS3-POLISH, and the one place where a base line grows (the
// Decks page's empty state, whose heading and sentence are two ternaries inside ONE base line) gets four marked FRAGMENTS inserted in front of the base's own string literals (`/* PASS3-POLISH */ <copy> ?? `);
// the table below puts the base text back for them. So the strip is two rules, in this order: the fragments go (the base line is whole again), then every line with the marker goes (stripPass3PolishB(rel, text)).
// Plain node, no imports, nothing read from disk or git here; any other file comes back as it is. How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two
// lines; there is no .env.example block of its own: the flag's block is PR A's), and stripBulkEditUndo calls the registry first, innermost, so every pin that already strips bulk edit + chat undo takes this change's
// lines out with no edit of its own. scripts/test-studio-pass3-polish-b.mjs proves that the three files without this change's lines are BASE_COMMIT's files byte for byte.

export const BASE_COMMIT = 'b2423e20338622d0a4a773db1d0758278e79d312' // studio dev head (Merge pull request #503, chat undo v2) this change is cut from
export const PASS3_POLISH_MARKER = 'PASS3-POLISH'
export const PASS3_POLISH_B_VIEWER = 'components/presentation-viewer.tsx'
export const PASS3_POLISH_B_BUILDER = 'app/builder/page.tsx'
export const PASS3_POLISH_B_DASHBOARD = 'app/(app)/dashboard/page.tsx'

/** The three app files whose existing lines other pins hold to a base commit: only marked lines (and the four marked fragments of one line) are added to them. */
export const PASS3_POLISH_B_FILES = [PASS3_POLISH_B_VIEWER, PASS3_POLISH_B_BUILDER, PASS3_POLISH_B_DASHBOARD]

/** [text this change has, text the base has]: the marked fragments inside the Decks page's empty-state line. Each `has` occurs once in the file. */
export const PASS3_POLISH_B_FRAGMENTS = {
  [PASS3_POLISH_B_DASHBOARD]: [
    ['tab === "completed" ? /* PASS3-POLISH */ decksEmptyCopy?.completed.title ?? "No completed presentations found" : /* PASS3-POLISH */ decksEmptyCopy?.strawman.title ?? "No strawman previews found"',
      'tab === "completed" ? "No completed presentations found" : "No strawman previews found"'],
    ['tab === "completed" ? /* PASS3-POLISH */ decksEmptyCopy?.completed.description ?? "Complete a strawman preview to create your first presentation." : /* PASS3-POLISH */ decksEmptyCopy?.strawman.description ?? "Create a presentation to generate a strawman preview."',
      'tab === "completed" ? "Complete a strawman preview to create your first presentation." : "Create a presentation to generate a strawman preview."'],
  ],
}

/** New files (no base text to put back). */
export const PASS3_POLISH_B_NEW_FILES = [
  'lib/studio-pass3-polish-b.ts',
  'components/studio-pass3-polish/studio-discard-edits-dialog.tsx',
  'scripts/studio-pass3-polish-b-strip.mjs',
  'scripts/test-studio-pass3-polish-b.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). No older test is edited. */
export const PASS3_POLISH_B_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_B_SCOPE_FILES = new Set([...PASS3_POLISH_B_FILES, ...PASS3_POLISH_B_NEW_FILES, ...PASS3_POLISH_B_OWN_EDITS])

/** The file without this change's lines: the marked fragments give the base text back first, then every line that carries the marker is taken out; every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishB(rel, text) {
  if (!PASS3_POLISH_B_FILES.includes(rel) || typeof text !== 'string') return text
  let out = text
  for (const [has, base] of PASS3_POLISH_B_FRAGMENTS[rel] || []) out = out.replace(has, () => base)
  return out.split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)).join('\n')
}
