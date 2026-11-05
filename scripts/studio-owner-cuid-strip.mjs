// KNOWLEDGE: K-02 chat upload sends user.id (cuid) as owner (DARK, NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED). Registers its files with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git.

export const OWNER_CUID_SCOPE_FILES = new Set([
  "app/builder/page.tsx",
  "lib/studio-upload-owner.ts",
  "scripts/test-studio-upload-owner.mjs",
  "scripts/studio-owner-cuid-strip.mjs",
  "scripts/studio-later-changes.mjs"
])
