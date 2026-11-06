// FRONTEND-2 (THUMBNAILS-BLANK-UAT fix 1): the Publish preview falls back to Layout's slide inventory (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED, default off).
// The exact text this change adds to the two files it touches, so a pin that holds one of them to an earlier commit can first put the base text back
// (stripPublishPreviewInventory(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-publish-preview-inventory.mjs proves that stripping
// gives back BASE_COMMIT's file byte for byte. Every pair is context-free (its text occurs once and needs no neighbour): the two insertions are removed on their own and
// the one swapped line goes back to its base line. New files (no base text to put back): PUBLISH_PREVIEW_INVENTORY_NEW_FILES below.

export const BASE_COMMIT = 'ae0885e8ce685e6eb1259f8fac10017685ca2c5f'

const ENV_BLOCK = `# PUBLISH PREVIEW FROM LAYOUT'S INVENTORY (FRONTEND-2, the Publish dialog's "What viewers get"; THUMBNAILS-BLANK-UAT fix 1). On for the exact value "true"; default
# off, and then nothing changes: no inventory read and the same preview as before. Build-time value: change it on Vercel and redeploy. On: when the preview has neither
# a live Stage F image from this tab nor a restored thumbnail (thumbnail_url with a matching thumbnail_presentation_id), which is any deck not built in this tab, Studio
# reads the Final deck's slide inventory ONCE (GET {layout}/api/presentations/{id}/slides/inventory, the rail's own reader and Layout URL) and shows slide 1's
# thumbnail_url only when it is fresh: not null, not thumbnail_stale, and from this presentation's own inventory. Stale or none: "Deck preview unavailable", as before.
# While the read is in flight the existing "Loading deck preview..." state shows; a failed read shows the unavailable state. A live or restored image always wins and
# makes no read.
NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED="false"

`

const COMPONENT_IMPORT = `import { useStudioPublishPreviewInventory } from '@/hooks/use-studio-publish-preview-inventory'
`

const COMPONENT_CALL = `  const resolved = resolveStudioPublishPreview(sessionId, source)
  // NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED (default off): with no live or restored image, Layout's inventory slide 0 when fresh. Off: \`resolved\`, as before.
  const preview = useStudioPublishPreviewInventory(sessionId, source, resolved)
`

const COMPONENT_CALL_BASE = `  const preview = resolveStudioPublishPreview(sessionId, source)
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'components/studio-publish-preview.tsx': [
    [COMPONENT_IMPORT, ''],
    [COMPONENT_CALL, COMPONENT_CALL_BASE],
  ],
}

export const PUBLISH_PREVIEW_INVENTORY_FILES = Object.keys(CHANGES)
export const PUBLISH_PREVIEW_INVENTORY_NEW_FILES = ['hooks/use-studio-publish-preview-inventory.ts', 'lib/studio-publish-preview-inventory.ts',
  'scripts/studio-publish-preview-inventory-strip.mjs', 'scripts/test-studio-publish-preview-inventory.mjs']
export const PUBLISH_PREVIEW_INVENTORY_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripPublishPreviewInventory(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
