// J2 v2 follow-up (flag NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, exact "true", default off).
//
// After a native Add the Layout ACK carries the PERSISTED index of the new slide, but `goToSlide` takes a VISUAL index,
// and every pending or failed compose placeholder before the slide takes one visual slot. The Blank slide of the J2 v2
// pop-up is the one Add that can land past placeholders (its position is resolved against them), so the viewer converts
// the ACK index here before it navigates.
//
// No new accounting: this is `resolveSlideComposeVisualIndex` (visual -> layout, the resolver the J2 v2 anchor and the
// slide rail use) run backwards, so the two can never disagree about which jobs are placeholders or where they sit.
// A placeholder that targets the new slide's own slot sits before it, exactly as the rail draws it.
import { resolveSlideComposeVisualIndex, type SlideComposeVisualJob } from '@/lib/slide-compose-async'

export const STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED === 'true'

/**
 * The visual index of the real slide at `persistedIndex`. `realSlideCount` counts the slides AFTER the insert; `jobs` is
 * the page's tracked compose jobs (a record) or the rail's list. With no placeholder before the slide, or an index that is
 * not a slide of the deck, the persisted index is returned unchanged.
 */
export function blankInsertVisualIndex(input: {
  persistedIndex: number
  realSlideCount: number
  jobs: Record<string, SlideComposeVisualJob> | ReadonlyArray<SlideComposeVisualJob>
}): number {
  const { persistedIndex, realSlideCount, jobs } = input
  if (!Number.isInteger(persistedIndex)) return persistedIndex
  // The resolver only reads Object.values(jobs), which is the same list for a record and for an array.
  const options = { slideCount: realSlideCount, jobs: jobs as Record<string, SlideComposeVisualJob> }
  // The slide sits between its own index and that plus one slot per job, so the search is bounded by the job count.
  const last = persistedIndex + Object.values(jobs).length
  for (let visualIndex = persistedIndex; visualIndex <= last; visualIndex += 1) {
    const resolved = resolveSlideComposeVisualIndex(visualIndex, options)
    if (resolved?.kind === 'slide' && resolved.layoutIndex === persistedIndex) return visualIndex
  }
  return persistedIndex
}
