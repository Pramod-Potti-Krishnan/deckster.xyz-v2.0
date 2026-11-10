/**
 * MDC @slide mentions (K1 — DIRECTOR_INTERFACE_REFINEMENT_PLAN.md §6.3).
 *
 * v1 (§12-Q5 locked): slides only. Mentions serialize INTO the message text as
 * `@[Slide N: Title]` — human-readable for the Director's LLM and the
 * transcript — and are ALSO parsed into typed `references[]` so the backend
 * resolver never has to guess. The plain text keeps working against an old
 * Director (it reads "Slide N" naturally).
 */

import type { SlideReference } from '@/types/mdc'

export interface MentionSlide {
  index: number // 0-based
  title: string
  slide_id?: string | null
}

/** The serialized inline form a mention takes inside the message text. */
export function mentionToken(slide: MentionSlide): string {
  const title = (slide.title || '').slice(0, 60)
  return `@[Slide ${slide.index + 1}${title ? `: ${title}` : ''}]`
}

const MENTION_RE = /@\[Slide (\d{1,3})(?::[^\]]*)?\]/g

/** Parse `@[Slide N: …]` tokens into K1 references (bounds-checked). */
export function parseSlideMentions(
  text: string,
  slides: MentionSlide[],
): SlideReference[] {
  const refs: SlideReference[] = []
  const seen = new Set<number>()
  for (const match of text.matchAll(MENTION_RE)) {
    const index = parseInt(match[1], 10) - 1
    if (Number.isNaN(index) || index < 0 || index >= slides.length || seen.has(index)) continue
    seen.add(index)
    refs.push({
      kind: 'slide',
      index,
      slide_id: slides[index]?.slide_id ?? null,
      label: slides[index]?.title,
    })
  }
  return refs
}

/** Filter for the @mention picker — by 1-based number prefix or title substring.
 *  Single source of truth for the popover AND the input's Enter/Tab selection. */
export function filterMentionSlides(slides: MentionSlide[], query: string): MentionSlide[] {
  const q = query.trim().toLowerCase()
  return slides.filter(
    (s) => !q || String(s.index + 1).startsWith(q) || (s.title || '').toLowerCase().includes(q),
  )
}
