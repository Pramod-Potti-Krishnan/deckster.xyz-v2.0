// FRONTEND-2: the Duplicate-copy-title change (NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE, default off): a copied deck's card keeps its " (copy)" suffix visible and the copy's Builder header shows its own title.
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back (stripDuplicateCopyTitle(rel, text)), the way the other
// *-strip.mjs files do. scripts/test-studio-duplicate-copy-title.mjs proves that stripping gives back BASE_COMMIT's files byte for byte. Every piece is a pure insertion removed on its own (no
// neighbouring text is needed), .env.example's block included, and the page keeps every line it had (the header's `deckTitle` line is the base's; a spread of {deckTitle} after it is what is added), so the
// stacked pins that check "the base's lines, in order" still see them. Each entry is [text this change has, text the base has].
// New files (no base text to put back): DUPLICATE_COPY_TITLE_NEW_FILES below.

export const BASE_COMMIT = '78e3fcf7487595cbe18a46dc56bc58c20de14423' // frontend2/payments-open-soon (#496), which stacks on #495 and studio ae0885e8; the base's .env.example already holds #495's and #496's blocks

const ENV_BLOCK = `# DUPLICATE COPY TITLE (FRONTEND-2; follows the Decks page's "Duplicate" item). On for the exact value "true"; default off, and then nothing changes. Build-time value: change it on
# Vercel and redeploy. It matters only for a deck that was copied. On: (1) on the Decks page a copy's card keeps its " (copy)" suffix visible: the original and its copy both cut to the same words
# ("moving weekly status meeting..."), so the name is cut with an ellipsis BEFORE the suffix, the suffix never shrinks, and the card's link says the full name as its tooltip; (2) the copy's Builder
# header shows the copy's own title (the session's stored title, found through the copy's "copied from" marker) instead of "Studio", which is what a deck with no slide structure of its own showed.
# Nothing is written and no request body changes: the Builder reads the one open session once (the read the copy's "Copied from" note already makes), and only while its header has no title of its own.
# A deck that was not copied is drawn exactly as before, on the Decks page and in the Builder.
NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE="false"

`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck's header shows its own title, not "Studio" (hooks/use-studio-duplicate-copy-title.ts).
import { useStudioDuplicateCopyTitleProps } from '@/hooks/use-studio-duplicate-copy-title'
`

const PAGE_HOOK = `  // NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck has no slideStructure, so its header said "Studio"; the open session's own title is read once, only while the header has none. Flag off: no props, nothing is read.
  const studioDuplicateCopyTitleProps = useStudioDuplicateCopyTitleProps(currentSessionId, !isUnsavedSession && !slideStructure?.metadata?.main_title)

`

const PAGE_HEADER_SPREAD = `          // NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck says its own title here, not "Studio"; flag off, nothing is spread.
          {...studioDuplicateCopyTitleProps}
`

const LAYOUT_IMPORT = `// NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck's card on the Decks page keeps its " (copy)" suffix visible (the deck cards' own files are held byte for byte, so the pass marks them from outside).
import { STUDIO_DUPLICATE_COPY_TITLE_ENABLED } from "@/lib/studio-duplicate-copy-title"
import { StudioDuplicateCopyTitleMount } from "@/components/builder/studio-duplicate-copy-title-mount"
`

const LAYOUT_ELEMENT = `      {STUDIO_DUPLICATE_COPY_TITLE_ENABLED && <StudioDuplicateCopyTitleMount />}
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [
    [PAGE_IMPORT, ''],
    [PAGE_HOOK, ''],
    [PAGE_HEADER_SPREAD, ''],
  ],
  'app/(app)/layout.tsx': [
    [LAYOUT_IMPORT, ''],
    [LAYOUT_ELEMENT, ''],
  ],
}

export const DUPLICATE_COPY_TITLE_FILES = Object.keys(CHANGES)
export const DUPLICATE_COPY_TITLE_NEW_FILES = ['lib/studio-duplicate-copy-title.ts', 'hooks/use-studio-duplicate-copy-title.ts',
  'components/builder/studio-duplicate-copy-title.css', 'components/builder/studio-duplicate-copy-title-mount.tsx',
  'scripts/studio-duplicate-copy-title-strip.mjs', 'scripts/test-studio-duplicate-copy-title.mjs']
export const DUPLICATE_COPY_TITLE_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripDuplicateCopyTitle(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
