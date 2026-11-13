// KNOWLEDGE: P4-15 slice 3 Studio half, link Drive items into a chat (DARK, NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED). Registered with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git.

export const CONNECTORS_SESSION_LINKS_SCOPE_FILES = new Set([
  "app/api/connectors/gdrive/session-links/route.ts",
  "lib/connectors-gdrive-session-links.ts",
  "lib/connectors-gdrive-server.ts",
  "hooks/use-deckster-websocket-v2.ts",
  "package.json",
  "docs/CONNECTORS_E2E_STATUS.md",
  "scripts/studio-connectors-session-links-strip.mjs",
  "scripts/test-studio-connectors-session-links.mjs",
  "scripts/studio-later-changes.mjs",
  ".env.example"
])

export const CONNECTORS_SESSION_LINKS_ENV_BLOCK = "# P4-15 slice 3: link picked Drive items into a chat (DARK). Exact \"true\" (AND the Drive flag above) turns on\n# /api/connectors/gdrive/session-links and adds linked_item_ids to the build message for Director (DIRECTOR_CONNECTOR_LINKED_ITEMS_ENABLED).\n# Off (default): the route 404s and the user message is unchanged.\nNEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED=\"false\"\n"

const HOOK = "hooks/use-deckster-websocket-v2.ts"
const HOOK_LINES = [
  "import { linkedItemIdsField } from '@/lib/connectors-gdrive-session-links';",
  "    // P4-15 slice 3 (NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED): Drive library items linked to this chat.",
  "    linked_item_ids?: string[];",
  "  /** P4-15 slice 3: Drive library item ids linked to this chat ([] clears). Dropped unless the session-links flag is on. */",
  "  linkedItemIds?: string[];",
  "          ...linkedItemIdsField(options?.linkedItemIds),",
]

/** The hook without this change's six lines is the base's hook. Any other file: untouched. */
export function stripConnectorsSessionLinks(rel, text) {
  if (rel !== HOOK) return text
  return text.split("\n").filter(l => !HOOK_LINES.includes(l)).join("\n")
}
