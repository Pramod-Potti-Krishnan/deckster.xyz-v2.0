/**
 * FRONTEND-2 (B32, 27 Oct; E2E-2's element-edit run on Studio dev, session 57f9e99a): chat element edit 2 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2, exact "true", default off, read at build time).
 * Import-free, so scripts/test-studio-chat-element-edit-2.mjs can run it under plain node. Two defects of #522 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT), both after a page reload or an Undo:
 *
 *  1. SLIDE_CHANGED on every edit. The runner (lib/chat-element-edit.ts) compares the directive's slide_id (Layout's, "slide_7f86d3817444") with the id the PAGE knows at that index, and the page read it from the session's
 *     slideStructure (Director's slide_update payload, restored from the session row on a reload). Those ids are Director's own outline UUIDs ("9ebccd93-6807-4940-97dd-5734feae5703"), never Layout's, so the check failed the moment
 *     the restored structure carried ids. With the flag on, the runner reads the SHOWN deck's own slide count and ids from Layout (the slide inventory the rail reads) and checks the directive against those. A slide that really
 *     changed still answers SLIDE_CHANGED; when Layout's ids cannot be read, the index check stands alone (the viewer answers "Slide N not found" for a slide that is gone), never a refusal of every edit.
 *  2. A stale element reference. The element reference of a send (lib/chat-element-refine.ts chatElementReferenceFor) comes from the page's selection record, which was only written when a selection STATE changed and was
 *     never dropped when the element went away (Undo, a restored deck, a slide change). With the flag on the record is written on every selection event, and dropped when the deck changes under it or the shown slide is not the one it
 *     was selected on.
 *  3. The reference's slide_id. Director keeps a reference's slide_id and an element edit then echoes `ref.slide_id or the Layout id` (mdc_actions.py resolve_element_references / the edit directive), so a reference that carries the
 *     session slideStructure's outline UUID (the same source as 1) comes back as a directive whose slide_id the Layout-id check above refuses. With the flag on the reference Studio builds for a send (the refine path's
 *     getChatElementReference and the "@" Element entry) carries slide_id null, and Director fills Layout's own id.
 */

export const CHAT_ELEMENT_EDIT_2_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 === 'true'

/** The shown deck's slides as Layout has them now: the count and the slide_id at each index (null where Layout names none). */
export interface ShownSlides {
  slideCount: number
  slideIds: ReadonlyArray<string | null>
}

/** The shown slides in a Layout slide inventory (lib/slide-rail-identity.ts SlideInventory: array position is the order); null when there is no usable inventory. */
export function shownSlidesFromInventory(inventory: { slideCount: number; slides: ReadonlyArray<{ slideId: string }> } | null | undefined): ShownSlides | null {
  if (!inventory || !Array.isArray(inventory.slides) || !Number.isInteger(inventory.slideCount) || inventory.slideCount < 1) return null
  const slideIds = inventory.slides.map(row => (row && typeof row.slideId === 'string' && row.slideId ? row.slideId : null))
  return { slideCount: inventory.slideCount, slideIds }
}

interface ShownSlidesDeps {
  slideCount: () => number
  slideIdAt: (slideIndex: number) => string | null
  shownSlides?: ((presentationId: string) => Promise<ShownSlides | null>) | null
}

/**
 * The runner's deps with the shown deck's own count and ids in place of the session slideStructure's. The read is Layout's (a GET), made once per directive; a failed or empty read leaves the id check with nothing to
 * compare (count 0 = unknown, no id), so the index check stands alone.
 */
export async function withShownSlides<D extends ShownSlidesDeps>(deps: D, presentationId: string): Promise<D> {
  let shown: ShownSlides | null = null
  try {
    shown = deps.shownSlides ? await deps.shownSlides(presentationId) : null
  } catch {
    shown = null
  }
  if (!shown) return { ...deps, slideCount: () => 0, slideIdAt: () => null }
  const known = shown
  return { ...deps, slideCount: () => known.slideCount, slideIdAt: (slideIndex: number) => (Number.isInteger(slideIndex) && slideIndex >= 0 ? known.slideIds[slideIndex] ?? null : null) }
}

/** The selection a chat send names (lib/chat-element-refine.ts ChatElementSelection, shape only, so this file stays import-free). */
export interface ElementSelectionRecord {
  elementId: string
  elementType: string | null
  slideIndex: number
  slideId: string | null
}

/** The record for one selection event: the element, the slide the viewer shows now, and that slide's id in the page's slide list (the id the flag-off effects record). */
export function chatElementSelectionFor(
  elementId: string, elementType: string | null, slideIndex: number, slides: ReadonlyArray<unknown> | null | undefined,
): ElementSelectionRecord {
  const slide = Array.isArray(slides) ? (slides[slideIndex] as { slide_id?: unknown } | undefined) : undefined
  return { elementId, elementType, slideIndex, slideId: typeof slide?.slide_id === 'string' ? slide.slide_id : null }
}

/** Forgets the selection record: the deck changed under it (an Undo, a restored deck, a slide added or deleted, another deck), so the element it names may be gone. */
export function dropChatElementSelection(ref: { current: ElementSelectionRecord | null }): void {
  ref.current = null
}

/** Forgets the selection record when the shown slide is not the one the element was selected on. */
export function dropChatElementSelectionOffSlide(ref: { current: ElementSelectionRecord | null }, shownSlideIndex: number): void {
  if (ref.current && ref.current.slideIndex !== shownSlideIndex) ref.current = null
}

/** The element reference with its slide_id null (the outline UUID the page's slide list holds is not a Layout id): Director then names the slide by Layout's own id. Null stays null. */
export function referenceWithoutOutlineId<T extends { slide_id: string | null }>(reference: T | null | undefined): T | null {
  return reference ? { ...reference, slide_id: null } : null
}
