/**
 * J2-F5 (R-20261007-frontend-10): the canvas goes blank while the Slide generation panel is open.
 *
 * What the code does when an inspector panel opens (app/builder/page.tsx, Studio shell, dual pane):
 * the presentation wrapper's margin-right jumps to the panel width under `transition-[margin]
 * duration-300`, so the slide space shrinks over ~300 ms while the drawer animates `width` for
 * 180 ms beside it. The viewer sizes the Layout iframe from that space with a ResizeObserver
 * (presentation-viewer.tsx `calculate`), so the cross-origin Layout viewer (Reveal.js, a fixed
 * 1920x1080 stage scaled to the iframe) is resized through about 19 intermediate sizes (910x512 to
 * 510x287 at 1440x900, measured in the local harness) and re-lays out at each one.
 *
 * With the flag on the wrapper and the drawers change in one step, so the iframe is resized once, to
 * its final size, and the viewer lays out once. Flag off: class names and CSS are unchanged.
 *
 * This is a mitigation for a suspected cause, not a reproduced one. The blank needs the live Layout
 * viewer, whose Reveal.js comes from a CDN, so it could not be run offline here (the mock viewer in
 * evidence/harness stays visible in both states). Seat 1 verifies it in Studio dev. See the PR.
 */
export const STUDIO_PANEL_KEEP_CANVAS_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_PANEL_KEEP_CANVAS_ENABLED === 'true'

/** The presentation wrapper's transition classes (the base behaviour when `keepCanvas` is false). */
export function presentationWrapperTransition(input: { isResizingDrawer: boolean; keepCanvas: boolean }): string {
  return input.isResizingDrawer || input.keepCanvas ? '' : 'transition-[margin] duration-300 ease-out'
}
