// A4 (PK approved D1) — Present and audience viewer paths open the Layout viewer
// with `?viewOnly=true` so authoring placeholders ("Generate image..." spinner,
// "IMAGE / Click to configure", stock copy) are hidden from the people looking.
//
// Import-free and pure (vm-tested in scripts/test-present-view-only.mjs).
//
// Build-time flag NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED, literal "true" only,
// default off. Off: every helper returns its input untouched (same string), so
// URLs and behaviour are identical to today. On: see each helper. Useless alone:
// Layout's LAYOUT_VIEW_HIDES_AUTHORING_PLACEHOLDERS_ENABLED (Layout !203) must be
// on first, because the `viewOnly` query is what that flag keys on.
//
// Layout's `viewOnly` is a server-injected const (`const VIEW_ONLY = ...`), not a
// runtime toggle, so Present cannot flip the editing frame in place. It layers a
// separate view-only frame over it instead (components/present-view-only-frame.tsx).

/** Read per call so the literal `process.env.NEXT_PUBLIC_*` is inlined by Next at build. */
export function isPresentViewOnlyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED === 'true'
}

/** `viewOnly=true` on a Layout viewer URL; query and hash otherwise untouched. Unparsable input is returned as-is. */
export function withViewOnly(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('viewOnly', 'true')
    return parsed.toString()
  } catch {
    return url
  }
}

/** Flag on: the viewer URL with `viewOnly=true`. Flag off: the same string, untouched. */
export function viewOnlyIfEnabled(url: string): string
export function viewOnlyIfEnabled(url: string | null | undefined): string | null | undefined
export function viewOnlyIfEnabled(url: string | null | undefined): string | null | undefined {
  return url && isPresentViewOnlyEnabled() ? withViewOnly(url) : url
}

/** View-only Present frame URL: the viewer with `viewOnly=true`, opened on slide `slideIndex` (0-based, Reveal `#/N` deep link). */
export function presentFrameUrl(baseUrl: string, slideIndex: number): string {
  const parsed = new URL(withViewOnly(baseUrl))
  const index = Number.isFinite(slideIndex) ? Math.max(0, Math.floor(slideIndex)) : 0
  parsed.hash = `#/${index}`
  return parsed.toString()
}

/**
 * A 0-based slide index kept inside a deck of `totalSlides`: the last slide when it is past the
 * end, slide 0 for anything that is not a number. An unknown count (not a number, or <= 0) only
 * floors the index at 0 — nothing is known to clamp to.
 */
export function clampPresentSlideIndex(index: number | null | undefined, totalSlides: number | null | undefined): number {
  const whole = typeof index === 'number' && Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  const total = typeof totalSlides === 'number' && Number.isFinite(totalSlides) ? Math.floor(totalSlides) : 0
  return total > 0 ? Math.min(whole, total - 1) : whole
}

/**
 * Slide a view-only frame opens on when it is mounted during Present: the one the audience is on
 * (the last the previous frame reported), else the one Present began on, kept inside the deck.
 * The viewer URL can change mid-Present (a Director deck mutation or a slide-compose refresh), and
 * the frame is re-mounted for it; the editing frame never moved, so its slide is only the start.
 */
export function presentFrameStartIndex(
  reported: number | null | undefined,
  began: number,
  totalSlides: number | null | undefined,
): number {
  return clampPresentSlideIndex(typeof reported === 'number' && Number.isFinite(reported) ? reported : began, totalSlides)
}

/** Layout command for a Present key press, or null. Arrow keys only: Reveal handles the rest once the frame has focus. */
export function presentNavigationCommand(key: string): 'nextSlide' | 'prevSlide' | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 'nextSlide'
  if (key === 'ArrowLeft' || key === 'ArrowUp') return 'prevSlide'
  return null
}
