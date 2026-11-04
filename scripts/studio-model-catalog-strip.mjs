// FRONTEND-2 Pass 3: the model catalog on the Intelligence page (NEXT_PUBLIC_STUDIO_MODEL_CATALOG, default off, #473). The two shared append-only files this change adds a block or a line to: .env.example (one block,
// after #472's theme / export block and before FRONTEND-1's PASS2 ADMIN block) and package.json (one test registration, after #472's). A pin that holds one of them to an earlier commit reads it through
// stripModelCatalog(rel, text) first and then does what it always did, the way the other *-strip.mjs files work (scripts/test-studio-chat-theme-export.mjs and scripts/test-studio-chat-element-refine.mjs,
// which this change is stacked on, do). scripts/test-studio-model-catalog.mjs proves that stripping gives back the stacked base's two files byte for byte (so nothing else was added to them).
// Every other file comes back as it is. This file has no base text to put back: it is new.

export const MODEL_CATALOG_FILES = ['.env.example', 'package.json']

// The block: its comment lines, the flag line and the blank line after it (the block is inserted as one piece followed by a blank line).
const ENV_BLOCK = /# PASS3 MODEL CATALOG[^\n]*\n(?:#[^\n]*\n)*NEXT_PUBLIC_STUDIO_MODEL_CATALOG="false"\n\n/
const PACKAGE_LINE = '    "test:studio-model-catalog": "node scripts/test-studio-model-catalog.mjs"'

/** `text` of repo file `rel` without this change's block (.env.example) or registration (package.json). Any other file is returned as it is. */
export function stripModelCatalog(rel, text) {
  if (rel === '.env.example') return text.replace(ENV_BLOCK, '')
  if (rel === 'package.json') {
    const last = `,\n${PACKAGE_LINE}\n` // the last entry: the one before it loses its comma again
    return text.includes(last) ? text.replace(last, '\n') : text.replace(`${PACKAGE_LINE},\n`, '')
  }
  return text
}
