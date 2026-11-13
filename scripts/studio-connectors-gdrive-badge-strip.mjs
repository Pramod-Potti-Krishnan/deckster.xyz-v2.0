// KNOWLEDGE: P4-15 piece B, the Drive badge on a slide's source citations (DARK, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED). Registered with scripts/studio-later-changes.mjs.
// Plain node, no imports, nothing read from disk or git.

export const CONNECTORS_GDRIVE_BADGE_SCOPE_FILES = new Set([
  "components/build-narration/slide-context-card.tsx",
  "components/builder/studio-citation-sources.tsx",
  "lib/connectors-gdrive-citations.ts",
  "docs/CONNECTORS_E2E_STATUS.md",
  "scripts/studio-connectors-gdrive-badge-strip.mjs",
  "scripts/test-studio-connectors-gdrive-badge.mjs",
  "scripts/studio-later-changes.mjs"
])

const CARD = "components/build-narration/slide-context-card.tsx"
const CARD_LINES = [
  "import { StudioCitationSources } from '@/components/builder/studio-citation-sources'",
  "import { citationSourceRows } from '@/lib/connectors-gdrive-citations'",
  "  return driveRows.length > 0 ? <div className=\"flex min-w-0 flex-col gap-1\">{strip}<StudioCitationSources rows={driveRows} /></div> : strip",
]

/** The card without this change's lines is the base's card (the strip row goes back to being the returned element). Any other file: untouched. */
export function stripConnectorsGdriveBadge(rel, text) {
  if (rel !== CARD) return text
  return text.split("\n")
    .filter(l => !CARD_LINES.includes(l) && !l.startsWith("  const driveRows = citationSourceRows("))
    .map(l => (l === "  const strip = (" ? "  return (" : l))
    .join("\n")
}
