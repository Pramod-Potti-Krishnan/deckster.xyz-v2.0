// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time), ONE flag for the whole set. This PR (A) holds the first three
// findings of the static audit (the Decks / Knowledge gutter and the Replay-intro button on a phone, iOS focus zoom, the Builder root at 100dvh) and the rendered sweep's phone tap targets (section 4). Later PRs append numbered sections to the same stylesheet.
// The exact lines this change adds to the two app files that older pins hold to an earlier commit ("without this change's lines the file is the base's"): app/(app)/layout.tsx and app/builder/page.tsx.
// Every line this change adds to either carries the marker PASS3-POLISH and NO base line is changed or removed, so the strip is one rule: a line with the marker goes (stripPass3Polish(rel, text)).
// The .env.example block is the exact text below, registered as PASS3_POLISH_ENV_BLOCK (scripts/studio-later-changes.mjs takes it out wherever it sits). scripts/test-studio-pass3-polish.mjs proves that the two files
// without the marked lines, and .env.example without the block, are BASE_COMMIT's files byte for byte.
// How the older pins reach it: this change REGISTERS the strip and the block (scripts/studio-later-changes.mjs, three lines), and stripBulkEditUndo calls the registry first, innermost, so every pin that already strips
// bulk edit + chat undo takes this change's lines out with no edit of its own. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = 'b2423e20338622d0a4a773db1d0758278e79d312' // studio dev head (Merge pull request #503, chat undo v2) this change is cut from
export const PASS3_POLISH_MARKER = 'PASS3-POLISH'
export const PASS3_POLISH_LAYOUT = 'app/(app)/layout.tsx'
export const PASS3_POLISH_BUILDER = 'app/builder/page.tsx'

/** The two app files whose existing lines other pins hold to a base commit: only marked lines are added to them. */
export const PASS3_POLISH_FILES = [PASS3_POLISH_LAYOUT, PASS3_POLISH_BUILDER]

/** New files (no base text to put back). */
export const PASS3_POLISH_NEW_FILES = [
  'lib/studio-pass3-polish.ts',
  'hooks/use-studio-pass3-polish.ts',
  'components/studio-pass3-polish/studio-pass3-polish-mount.tsx',
  'components/studio-pass3-polish/studio-pass3-polish.css',
  'scripts/studio-pass3-polish-strip.mjs',
  'scripts/test-studio-pass3-polish.mjs',
]

/** Files this change edits that are not app code: .env.example (its block) and the registry (three lines: its files, its block, its strip). No older test is edited. */
export const PASS3_POLISH_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_SCOPE_FILES = new Set([...PASS3_POLISH_FILES, ...PASS3_POLISH_NEW_FILES, ...PASS3_POLISH_OWN_EDITS])

/** The whole .env.example block: its comment, its line and the blank line after it. */
export const PASS3_POLISH_ENV_BLOCK = `# STUDIO PASS 3 POLISH (FRONTEND-2, PROGRAM-1 Saturday evening push, 24 Oct: a polish sweep of every Studio page at phone and desktop width; ONE flag for the whole set). On for the exact value
# "true"; default off, and then nothing changes: no attribute is set, no rule matches, and no markup, handler, request or stored value differs. Build-time value: change it on Vercel and redeploy.
# Needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). On: <html> carries data-studio-pass3-polish="true" while a Studio route is on screen (the account layout and the Builder set it, and it comes
# off when the route goes), and one stylesheet, every rule scoped to that attribute, applies. PR A has four sections. (1) Decks and Knowledge on a phone (640 px and below): the 64 px right gutter
# becomes 16 px (the page's own) and the Replay-intro button, fixed in the viewport corner, sits in the flow at the end of the page, right-aligned; the 52 px of bottom padding that reserved its
# corner goes back to 28 px. (2) iOS focus zoom (640 px and below): text inputs, native selects, textareas and contenteditable are 16 px (the Director prompt was 13.6 px, the Decks search 13 px, the
# composer menus 11.5 px), with line height 1.5 on textareas and 1.35 on inputs; padding, height, width, buttons, labels and icons are not touched, and Settings and profile pages, Billing,
# Shortcuts, Your details, the account menu, Publish, the published viewer, Admin, Docs and Help are kept out. (3) The Builder root (h-screen, which is 100vh) is 100dvh where the browser has dvh, so
# on a phone the composer is not under the browser toolbar; on a desktop browser dvh and vh are the same. (4) Phone tap targets (640 px and below, Studio shell only): the Builder header's panel
# toggle (27 px), New deck (28 px tall) and Export (28 px tall), the composer toolbar's buttons (28 px) and the Replay-intro button (28 to 30 px) get a 32 px minimum width and height, content
# centred, icons and type unchanged; the Slides / Director segments keep their 22 px box and get a 32 px hit area from an ::after extension. Later PRs add numbered sections to the same stylesheet
# under the same flag.
NEXT_PUBLIC_STUDIO_PASS3_POLISH="false"

`

/** The files without this change's lines: every line that carries the marker is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3Polish(rel, text) {
  if (!PASS3_POLISH_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)).join('\n')
}
