// KNOWLEDGE: P4-15 piece C, remove one Drive item from the library with a real erase (DARK, rides NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED). Registered with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git. No .env.example block (no new flag) and no strip (every edit to an older file is additive and sits behind the Drive flag).

export const CONNECTORS_ITEM_REMOVE_SCOPE_FILES = new Set([
  "app/(app)/settings/connectors/page.tsx",
  "app/api/connectors/gdrive/items/route.ts",
  "components/settings/gdrive-remove-item.tsx",
  "lib/connectors-gdrive-remove.ts",
  "lib/connectors-gdrive-server.ts",
  "lib/connectors-gdrive.ts",
  "package.json",
  "docs/CONNECTORS_E2E_STATUS.md",
  "scripts/studio-connectors-item-remove-strip.mjs",
  "scripts/test-studio-connectors-item-remove.mjs",
  "scripts/studio-later-changes.mjs"
])
