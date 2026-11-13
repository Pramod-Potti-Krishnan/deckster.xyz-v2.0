// KNOWLEDGE: P4-15 slice 1, Google Drive picker connector (DARK, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED). Registers its files and .env.example block with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git.

export const CONNECTORS_GDRIVE_SCOPE_FILES = new Set([
  "app/(app)/settings/connectors/page.tsx",
  "app/api/connectors/gdrive/callback/route.ts",
  "app/api/connectors/gdrive/disconnect/route.ts",
  "app/api/connectors/gdrive/items/route.ts",
  "app/api/connectors/gdrive/picker-token/route.ts",
  "app/api/connectors/gdrive/start/route.ts",
  "components/settings/settings-sidebar.tsx",
  "lib/connectors-gdrive-server.ts",
  "lib/connectors-gdrive.ts",
  "lib/connectors-gdrive-flag.ts",
  "lib/gdrive-picker-loader.ts",
  "scripts/test-studio-connectors-gdrive.mjs",
  "scripts/studio-connectors-gdrive-strip.mjs",
  "scripts/studio-later-changes.mjs",
  ".env.example"
])

export const CONNECTORS_GDRIVE_ENV_BLOCK = "# P4-15 slice 1: Google Drive picker connector (DARK). Exact \"true\" turns on Settings > Connectors and /api/connectors/gdrive/*.\n# Off (default): no card, no sidebar entry, every connector route returns 404. Tier gate = Knowledge entitlement (pending PK decision C1).\n# Tokens live in Researcher (KNOWLEDGE_SERVICE_URL + KNOWLEDGE_API_KEY above); the browser only ever gets a short-lived Picker access token.\nNEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED=\"false\"\n# Server-only OAuth client id for the drive.file consent (redirect = $NEXTAUTH_URL/api/connectors/gdrive/callback; state signed with NEXTAUTH_SECRET).\nGOOGLE_CONNECTOR_CLIENT_ID=\"\"\n# Connector routes also need RESEARCHER_SESSION_TOKEN_SECRET (existing, see below): every Researcher call carries a\n# K-06 token sid=\"lib:<owner>\", uid=<owner>. Unset/short = every connector route fails closed (503).\n# Browser Picker key (referrer-restricted) and GCP project number.\nNEXT_PUBLIC_GOOGLE_PICKER_API_KEY=\"\"\nNEXT_PUBLIC_GOOGLE_PICKER_APP_ID=\"\"\n"

// The settings sidebar's in-place edit (FRONTEND-2 N2), as exact [has, was] pairs: taken out, the sidebar is the base's (studio-v4-dev-preparation-code) byte for byte.
const SIDEBAR = "components/settings/settings-sidebar.tsx"
const SIDEBAR_PAIRS = [
  [
    'import { User, Palette, Bell, ShieldCheck, Lock, Brain, Plug } from "lucide-react"\nimport { isGdriveConnectorEnabled } from "@/lib/connectors-gdrive-flag"\n',
    'import { User, Palette, Bell, ShieldCheck, Lock, Brain } from "lucide-react"\n',
  ],
  [
    '// P4-15 slice 1 (DARK): the Connectors entry exists only when NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED is exactly "true".\nconst CONNECTORS_ITEM: NavItem = { href: "/settings/connectors", label: "Connectors", icon: Plug, authenticatedOnly: true }\n\n',
    '',
  ],
  [
    '  const items = (isGdriveConnectorEnabled() ? [...ITEMS, CONNECTORS_ITEM] : ITEMS).filter((item) => !item.authenticatedOnly || authenticated)\n',
    '  const items = ITEMS.filter((item) => !item.authenticatedOnly || authenticated)\n',
  ],
]

/** The sidebar without this change's lines is the base's sidebar. Any other file (and anything that is not a string) comes back as it was. */
export function stripConnectorsGdrive(rel, text) {
  if (rel !== SIDEBAR || typeof text !== "string") return text
  return SIDEBAR_PAIRS.reduce((out, [has, was]) => out.replace(has, () => was), text)
}
