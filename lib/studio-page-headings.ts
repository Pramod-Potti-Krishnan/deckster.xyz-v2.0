// UX-09 (FRONTEND-1 UX review, 4 Nov): NEXT_PUBLIC_STUDIO_PAGE_HEADINGS, exact "true", default off, read at build time, and only with the Studio shell. Import-free.
// The Studio account pages each centre their own container (max-w-4xl, max-w-6xl, container ...), so the page heading's left edge sat at 81 / 85 / 113 / 135 px and its size ran 24-36 px.
// With the flag on, a client mount (components/studio-page-headings/studio-page-headings-mount.tsx) sets data-studio-page-headings="true" on <html>, marks the page's first <h1> and the
// containers between the workspace and it; components/studio-page-headings/studio-page-headings.css (every rule scoped to that attribute) gives the OUTERMOST centring container one width
// and gutter, flattens the inner centring containers, and gives the heading one style. Flag off: nothing runs and no rule matches.

export const STUDIO_PAGE_HEADINGS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PAGE_HEADINGS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

export const STUDIO_PAGE_HEADINGS_ATTR = 'data-studio-page-headings'
export const STUDIO_PAGE_HEADING_ATTR = 'data-studio-page-heading'
export const STUDIO_PAGE_CONTAINER_ATTR = 'data-studio-page-container'

/** The part of an element's computed style this reads. */
export interface StudioBox { maxWidth: string; marginLeft: string; marginRight: string }

/** A box that centres a narrower column: a max-width, or equal non-zero side margins (mx-auto). */
export function studioCentres(box: StudioBox): boolean {
  if (box.maxWidth && box.maxWidth !== 'none') return true
  const left = parseFloat(box.marginLeft), right = parseFloat(box.marginRight)
  return left > 0 && Math.abs(left - right) < 0.5
}

/**
 * Roles for the chain workspace -> heading (outermost first, heading excluded): the first centring box is "outer" (one width and gutter), every later centring box is "inner"
 * (flattened, so it adds no second gutter), any other box is null (left alone).
 */
export function studioPageContainerRoles(chain: readonly StudioBox[]): Array<'outer' | 'inner' | null> {
  let seen = false
  return chain.map(box => {
    if (!studioCentres(box)) return null
    if (seen) return 'inner'
    seen = true
    return 'outer'
  })
}
