// FRONTEND-2: the registry of LATER changes in the Studio stack, the ones that come after bulk edit + chat undo (a branch merged on top of it, or stacked above it) and that the older pins cannot know about.
// Plain node, nothing is read from disk or git here. Three things about a later change make an older pin fail, and this file answers all three in one place so that no older test has to be edited for each new change:
//   1. SCOPE. Several pins read the COMMITTED diff (BASE..HEAD) and refuse any file that is not their change's, a stacked change's, a strip root or a pin they taught. A later change's files are in that diff.
//      Those scope checks skip every file in LATER_CHANGE_FILES (and only there: a file that is in no list is still a stray).
//   2. .env.example. A pin that holds .env.example to an earlier commit, with its own block (and the blocks stacked on it) taken out, sees a later change's block as an extra. stripLaterEnvBlocks(rel, text) takes each
//      registered block out (the block and the one blank line that separates it from its neighbour) wherever it sits; any other file is returned as it is.
//   3. CODE LINES. A pin that holds an app file (the Decks page, the Builder page, the viewer, the hook ...) to an earlier commit, "without this change's lines it is the base's file", sees the lines a later change added.
//      LATER_STRIPS holds one strip per later change, (rel, text) => text, exactly the function the change's own strip module exports (stripFirstPaint, stripDeckCardThumbnail ...).
// stripLaterChanges(rel, text) is what a pin calls, INNERMOST in its read (before every older strip): it applies every registered strip in order, then stripLaterEnvBlocks. The older pins already reach it with no edit of
// their own: scripts/studio-bulk-edit-undo-strip.mjs (stripBulkEditUndo) calls it first, and the three shared strip roots (open-read-only, dark-persist, add-slide-status) call stripBulkEditUndo innermost.
//
// HOW A LATER CHANGE REGISTERS (three lines, one in each list below, no test edit). Each line carries the marker "LATER-CHANGE". Name the change's own strip module with a dynamic import, so that the registration is those
// lines and nothing else (no import line; a top-level await is fine in an .mjs), for example
//   LATER_CHANGE_FILES   ...(await import('./studio-example-strip.mjs')).EXAMPLE_SCOPE_FILES, // LATER-CHANGE: <who>, <what> (<FLAG>)    every file its commit touches: code, new files, the pins it taught, package.json
//   LATER_ENV_BLOCKS     (await import('./studio-example-strip.mjs')).EXAMPLE_ENV_BLOCK, // LATER-CHANGE: <who>, <what> (<FLAG>)         the exact text of its .env.example block (leave the line out when it adds none)
//   LATER_STRIPS         (await import('./studio-example-strip.mjs')).stripExample, // LATER-CHANGE: <who>, <what> (<FLAG>)             its (rel, text) => text strip (leave the line out when it adds no line to an older file)
// An env block may carry its leading and trailing blank lines or not; it is matched on its own lines, at the start of a line, and it must be the whole block (a partial match is not a block and is left alone).
// A strip must return its text untouched for a file it does not own, and must not need the strips of older changes to have run (the registry runs first). Until a change is merged, its lines stay out of this file
// (scripts/test-studio-bulk-edit-undo.mjs and scripts/test-studio-later-changes.mjs prove the registry with a made-up change that is never committed).
//
// All three lists are empty when nothing is stacked after bulk edit + chat undo, and then nothing here changes anything: stripLaterChanges returns its text as it was given, for every file.

export const LATER_CHANGE_FILES = new Set([
  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  // one line per later change, above this comment
])

export const LATER_ENV_BLOCKS = [
  (await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  // one line per later change, above this comment
]

/** One strip per later change, (rel, text) => text, in the order the changes were stacked. */
export const LATER_STRIPS = [
  (await import('./studio-first-paint-strip.mjs')).stripFirstPaint, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  // one line per later change, above this comment
]

const lineStart = (text, at) => at === 0 || text[at - 1] === '\n'
const lineEnd = (text, at) => at === text.length || text[at] === '\n'

/**
 * `text` without the registered blocks, when `rel` is .env.example; every other file (and the empty registry) gives `text` back untouched.
 * A block comes out with the one blank line that separated it from its neighbour: the blank line after it when something follows, else the blank line before it (the block was the last thing in the file, with or without a blank line of its own after it).
 * Only the first whole occurrence of a block is taken (a block that is there twice is a merge mistake and the older pins must still see the second); stripping twice changes nothing more.
 */
export function stripLaterEnvBlocks(rel, text) {
  if (rel !== '.env.example' || typeof text !== 'string' || LATER_ENV_BLOCKS.length === 0) return text
  let out = text
  for (const registered of LATER_ENV_BLOCKS) {
    const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
    if (block === '') continue
    let at = out.indexOf(block)
    while (at !== -1 && !(lineStart(out, at) && lineEnd(out, at + block.length))) at = out.indexOf(block, at + 1)
    if (at === -1) continue
    const before = out.slice(0, at), after = out.slice(at + block.length)
    if (/^\n*$/.test(after)) out = before.endsWith('\n\n') ? before.slice(0, -1) : before // last in the file (only newlines after it, whether or not the block carries its own trailing blank line): the blank line before it goes
    else if (after.startsWith('\n\n')) out = before + after.slice(2) // the blank line after it goes with it
    else out = before + after.slice(1) // no blank line after it: only the block's own lines go
  }
  return out
}

/**
 * What an older pin reads an app file or .env.example through, INNERMOST: every registered strip in order (a result that is not a string is ignored), then the registered .env.example blocks. A file no later
 * change touches, and the empty registry, come back byte for byte.
 */
export function stripLaterChanges(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const strip of LATER_STRIPS) {
    if (typeof strip !== 'function') continue
    const next = strip(rel, out)
    if (typeof next === 'string') out = next
  }
  return stripLaterEnvBlocks(rel, out)
}
