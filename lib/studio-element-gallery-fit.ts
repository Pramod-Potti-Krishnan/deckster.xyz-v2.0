/**
 * PASS2D B3a (flag NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT, exact "true", default off): the Add Element card gallery stays whole at narrow widths.
 *
 * What the code does today (components/studio-element-gallery.css, studio-authoring-menus.css): the gallery is a 3-column grid 448 px wide,
 * capped at `100vw - 24px`, and from 480 px down it becomes 2 columns. Two columns make five rows, about 600 px tall, and the menu's own
 * `max-height` is `min(560px, 100dvh - 32px, available height)` with a thin scrollbar. So at 480 px and below (and at any viewport shorter than
 * about 500 px) the lower cards sit below the fold: Table, Diagram, Infographic, Icon / Label and Shape are cut off until the user scrolls a
 * list that shows no sign it scrolls. Measured against the real viewer in headless Chromium: at 420x700 three cards are out of sight, at 380x560 five.
 *
 * With the flag on the gallery marks itself `data-studio-element-gallery-fit`; the stylesheet then (a) sizes the menu from the room Radix says
 * it has (`--radix-dropdown-menu-content-available-width`) and (b) at 480 px and below keeps three columns with compact cards (no one-line
 * description; it stays the accessible description) so all nine cards fit a 420 px wide, 560 px tall viewport. `collisionPadding` keeps a margin to the side
 * edges only: a vertical margin would shrink the room below the gallery's own height at about 600 px tall viewports, where it fits today.
 * Flag off: no extra prop, no attribute, no rule applies; the gallery is byte-for-byte what it was.
 *
 * Pure, no imports: the test loads this file on its own.
 */
export const STUDIO_ELEMENT_GALLERY_FIT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT === 'true'

/** Room kept between the menu and the viewport's left and right edges, in px (Radix `collisionPadding`; never top/bottom, see above). */
export const STUDIO_ELEMENT_GALLERY_FIT_PADDING = 12

export interface StudioElementGalleryFitProps {
  collisionPadding?: { left: number; right: number }
  'data-studio-element-gallery-fit'?: 'true'
}

/** The extra props for the gallery's menu content. Empty when the flag is off, so the content receives exactly the props it always did. */
export function studioElementGalleryFitProps(enabled: boolean): StudioElementGalleryFitProps {
  return enabled ? { collisionPadding: { left: STUDIO_ELEMENT_GALLERY_FIT_PADDING, right: STUDIO_ELEMENT_GALLERY_FIT_PADDING }, 'data-studio-element-gallery-fit': 'true' } : {}
}
