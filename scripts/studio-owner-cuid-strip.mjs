// KNOWLEDGE: K-02 chat upload sends user.id (cuid) as owner (DARK, NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED). Registers its files and its strip with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git.
// The two lines this change puts in app/builder/page.tsx (both carry the marker K-02, both are pure insertions: the base's `userId: user?.email || '',` line is untouched): the import, and a spread right after that line in the useFileUpload options.
// stripOwnerCuid(rel, text) takes them out, so a pin that holds the Builder page to an earlier commit sees the base's page. Any other file is returned as it is. Idempotent.

export const OWNER_CUID_SCOPE_FILES = new Set([
  "app/builder/page.tsx",
  "lib/studio-upload-owner.ts",
  "scripts/test-studio-upload-owner.mjs",
  "scripts/studio-owner-cuid-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

export const OWNER_CUID_PAGE_FILE = "app/builder/page.tsx"

/** [text this change has, text the base has], whole lines with their newline. */
export const OWNER_CUID_PAGE_EDITS = [
  ["import { uploadOwnerOverride } from '@/lib/studio-upload-owner' // K-02 owner cuid\n", ""],
  ["    ...uploadOwnerOverride(user), // K-02: NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED sends user.id (cuid); off = {} (the e-mail line above stays)\n", ""]
]

/** `text` with one whole line put back: `has` counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === "\n")) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

export function stripOwnerCuid(rel, text) {
  if (typeof text !== "string") return text
  if (rel !== OWNER_CUID_PAGE_FILE) return text
  return OWNER_CUID_PAGE_EDITS.reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
