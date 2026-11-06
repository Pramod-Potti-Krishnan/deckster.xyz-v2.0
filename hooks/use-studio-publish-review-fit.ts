import { useEffect } from 'react'

/**
 * NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT (exact "true", default off, build-time): the Publish wizard's setup grid no longer scrolls sideways at phone width.
 * The finding (E2E-2, Studio dev, 24 Oct): at 390 px the Review step's grid (.studio-publish-setup-grid) measured scrollWidth 332 against clientWidth 328 with
 * overflow-x: auto, so the step scrolled sideways and the right-hand tiles lost their edge. The 4 px is PP-1's own: the polish block gives the step body
 * "padding: 4px; margin: -4px" so the focus rings of controls at its edges are not clipped by the body's own scrolling (desktop, where the body is the scroller).
 * On a phone the body stops scrolling and the grid becomes the one scroller, but the negative margin stays: the body's box ends 4 px past the grid's right edge,
 * and that 4 px is scrollable overflow. The fix is the rule in components/studio-publish.css (a phone rule that gives the body no padding and no margin, scoped to this
 * attribute); the content box does not move (it was the track either way), so nothing is hidden and no overflow is clipped.
 * The attribute sits on <html>: the dialog is portalled out of the page and its own files are held byte for byte by the Pass 2 pins, so the page, which only the Builder
 * mounts the dialog under, sets it. Flag off: the attribute is never set, so the new rule never matches and nothing here runs.
 */
export const STUDIO_PUBLISH_REVIEW_FIT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT === 'true'
export const STUDIO_PUBLISH_REVIEW_FIT_ATTR = 'data-studio-publish-review-fit'

export function useStudioPublishReviewFit(): void {
  useEffect(() => {
    if (!STUDIO_PUBLISH_REVIEW_FIT_ENABLED) return
    const root = document.documentElement
    root.setAttribute(STUDIO_PUBLISH_REVIEW_FIT_ATTR, 'true')
    return () => { root.removeAttribute(STUDIO_PUBLISH_REVIEW_FIT_ATTR) }
  }, [])
}
