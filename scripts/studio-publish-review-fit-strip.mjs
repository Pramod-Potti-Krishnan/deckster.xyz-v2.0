// FRONTEND-2: the Publish wizard's setup grid no longer scrolls sideways at phone width (NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT, default off).
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text
// back (stripPublishReviewFit(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-publish-review-fit.mjs proves that
// stripping gives back BASE_COMMIT's file byte for byte. Every piece is a pure insertion, removed on its own (no neighbouring text is needed),
// .env.example's block and the stylesheet's appended block included. New files (no base text to put back): PUBLISH_REVIEW_FIT_NEW_FILES below.

export const BASE_COMMIT = 'c75e4c2d0e5f7319cce890b055567281fe265184'

const ENV_BLOCK = `# PUBLISH REVIEW FIT (FRONTEND-2, the Builder's Publish dialog; the setup wizard on a phone). On for the exact value "true"; default off, and then
# nothing changes. Build-time value: change it on Vercel and redeploy. It matters only with NEXT_PUBLIC_STUDIO_P2_POLISH on (the rule it fixes is that
# change's). On: at phone width (700 px and below) the setup wizard's step body no longer pokes 4 px past the edge of its scrolling grid, so the Review
# step stops scrolling sideways and its right-hand tiles keep their edge; the content does not move. Wider windows and every other dialog are unchanged.
# Off: the dialog is as before.
NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT="false"

`

// The block appended to components/studio-publish.css, after the Pass 2 polish block (which a pin cuts off from its own marker to the end of the file, this one with it).
export const PUBLISH_REVIEW_FIT_CSS_SELECTOR = 'html[data-studio-publish-review-fit="true"] [data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] > .studio-publish-setup-grid > .studio-publish-step-body'
const CSS_BLOCK = `
/* NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT (hooks/use-studio-publish-review-fit.ts), phone width only. Every rule below carries html[data-studio-publish-review-fit="true"], which exists only with the flag on.
   PP-1 above gives the step body "padding: 4px; margin: -4px" so focus rings at its edges survive its own scrolling. At 700px and below the body no longer scrolls (the grid is the one scroller), but the
   negative margin stays, so the body's box ends 4px past the grid's right edge: 4px of scrollable overflow (scrollWidth 332 over clientWidth 328 at 390px). With no padding and no margin the body is exactly
   its track, and its content box (the track) is where it was. ("screen and": the Pass 2 polish pin reads its own phone media block by its exact query, and this block comes after it.) */
@media screen and (max-width: 700px) {
  ${PUBLISH_REVIEW_FIT_CSS_SELECTOR} { padding: 0; margin: 0; }
}
`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT (default off): the Publish wizard's setup grid does not scroll sideways at phone width (hooks/use-studio-publish-review-fit.ts, components/studio-publish.css).
import { useStudioPublishReviewFit } from '@/hooks/use-studio-publish-review-fit'
`

const PAGE_CALL = `  // NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT (default off): marks the page so the Publish dialog's phone rule applies (the dialog is portalled out of the page).
  useStudioPublishReviewFit()
`

// [text this change has, text the base has]; each \`added\` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'components/studio-publish.css': [[CSS_BLOCK, '']],
  'app/builder/page.tsx': [[PAGE_IMPORT, ''], [PAGE_CALL, '']],
}

export const PUBLISH_REVIEW_FIT_FILES = Object.keys(CHANGES)
export const PUBLISH_REVIEW_FIT_NEW_FILES = ['hooks/use-studio-publish-review-fit.ts',
  'scripts/studio-publish-review-fit-strip.mjs', 'scripts/test-studio-publish-review-fit.mjs']
export const PUBLISH_REVIEW_FIT_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripPublishReviewFit(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
