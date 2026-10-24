// FRONTEND-2: the registry of LATER changes in the Studio stack, the ones that come after bulk edit + chat undo (a branch merged on top of it, or stacked above it) and that the older pins cannot know about.
// Plain node, no dependencies, nothing is read from disk or git here. Two things about a later change make an older pin fail, and this file answers both in one place so that no older test has to be edited
// for each new change:
//   1. SCOPE. Several pins read the COMMITTED diff (BASE..HEAD) and refuse any file that is not their change's, a stacked change's, a strip root or a pin they taught. A later change's files are in that diff.
//      Those scope checks skip every file in LATER_CHANGE_FILES (and only there: a file that is in no list is still a stray).
//   2. .env.example. A pin that holds .env.example to an earlier commit, with its own block (and the blocks stacked on it) taken out, sees a later change's block as an extra. Every such pin reads the file through
//      stripLaterEnvBlocks(rel, text) first, which takes each registered block out (the block and the one blank line that separates it from its neighbour) wherever it sits; any other file is returned as it is.
//
// HOW A LATER CHANGE REGISTERS (two lines, one in each list below, no test edit):
//   - LATER_CHANGE_FILES: add one line that spreads every file its commit touches: its code, its new files, its strip module, the pins it taught, package.json. The marker "LATER-CHANGE" goes on the line.
//   - LATER_ENV_BLOCKS: add one line with the exact text of its .env.example block (the string its strip module exports). The marker "LATER-CHANGE" goes on this line too.
//   Both lines can name the change's own strip module with a dynamic import, so that the registration is those two lines and nothing else (no import line; a top-level await is fine in an .mjs), for example
//     ...(await import('./studio-example-strip.mjs')).EXAMPLE_SCOPE_FILES, // LATER-CHANGE: <who>, <what> (<FLAG>)
//     (await import('./studio-example-strip.mjs')).EXAMPLE_ENV_BLOCK, // LATER-CHANGE: <who>, <what> (<FLAG>)
//   The block may carry its leading and trailing blank lines or not; it is matched on its own lines, at the start of a line, and it must be the whole block (a partial match is not a block and is left alone).
//   Until a change is merged, its two lines stay out of this file (scripts/test-studio-bulk-edit-undo.mjs proves the registry with a made-up change that is never committed).
//
// Both lists are empty when nothing is stacked after bulk edit + chat undo, and then nothing here changes anything: stripLaterEnvBlocks returns its text as it was given.

export const LATER_CHANGE_FILES = new Set([
  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  // one line per later change, above this comment
])

export const LATER_ENV_BLOCKS = [
  (await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  // one line per later change, above this comment
]

const lineStart = (text, at) => at === 0 || text[at - 1] === '\n'
const lineEnd = (text, at) => at === text.length || text[at] === '\n'

/**
 * `text` without the registered blocks, when `rel` is .env.example; every other file (and the empty registry) gives `text` back untouched.
 * A block comes out with the one blank line that separated it from its neighbour: the blank line after it when something follows, else the blank line before it (the block was the last thing in the file).
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
    if (after.startsWith('\n\n')) out = before + after.slice(2) // the blank line after it goes with it
    else if (after === '' || after === '\n') out = before.endsWith('\n\n') ? before.slice(0, -1) : before // last in the file: the blank line before it goes
    else out = before + after.slice(1) // no blank line after it: only the block's own lines go
  }
  return out
}
