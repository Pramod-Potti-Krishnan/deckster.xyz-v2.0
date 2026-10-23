// FRONTEND-2 Pass 3 (BY10): Studio's narration model calls through the model router (NARRATION_VIA_ROUTER, server-side, default off, #475). The two shared append-only files this change adds a block or a line to:
// .env.example (one block, after #473's model catalog block, the last PASS3 block, and before FRONTEND-1's PASS2 ADMIN block) and package.json (one test registration, after #473's). A pin that holds one of them to an
// earlier commit reads it through stripNarrationRouter(rel, text) first and then does what it always did, the way scripts/studio-model-catalog-strip.mjs works (#473, which this change is stacked on, and the tests
// of #470 and #472 read through both). scripts/test-studio-narration-router.mjs proves that stripping gives back the stacked base's two files (13c90ea) byte for byte, so nothing else was added to them.
// Every other file comes back as it is. This file has no base text to put back: it is new.

export const NARRATION_ROUTER_FILES = ['.env.example', 'package.json']

// The block: its comment lines, the three variable lines and the blank line after them (the block is inserted as one piece followed by a blank line).
const ENV_BLOCK = /# STUDIO NARRATION THROUGH THE MODEL ROUTER[^\n]*\n(?:#[^\n]*\n)*NARRATION_VIA_ROUTER="false"\nMODEL_ROUTER_URL=\nMODEL_ROUTER_STUDIO_KEY=\n\n/
const PACKAGE_LINE = '    "test:studio-narration-router": "node scripts/test-studio-narration-router.mjs"'

/** `text` of repo file `rel` without this change's block (.env.example) or registration (package.json). Any other file is returned as it is. */
export function stripNarrationRouter(rel, text) {
  if (rel === '.env.example') return text.replace(ENV_BLOCK, '')
  if (rel === 'package.json') {
    const last = `,\n${PACKAGE_LINE}\n` // the last entry: the one before it loses its comma again
    return text.includes(last) ? text.replace(last, '\n') : text.replace(`${PACKAGE_LINE},\n`, '')
  }
  return text
}
