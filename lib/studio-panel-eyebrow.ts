// PASS2B G29 + G33 (flag NEXT_PUBLIC_STUDIO_PANEL_EYEBROW, default off). Import-free: the words of the band only.
//
// The accepted v4 mockup opens the Add Slide and Add Element panels with a violet band over the header ("CREATE SLIDE" with "Insert after slide 1" on
// the right; "CREATE ELEMENT" with "Selected Chart"). The panels' own title and subtitle stay as they are; the band names the action and, on the
// right, where it lands or what is selected.

export interface StudioPanelEyebrow { label: string; detail: string }

export type SlidePanelMode = 'create' | 'regenerate' | 'refine' | 'edit'

/** Add Slide panels (the v2 panel and the slide generation panel). `slideNumber` is the slide the action points at (the one to insert after when creating). */
export function slidePanelEyebrow(input: { mode: SlidePanelMode; slideNumber: number | null | undefined }): StudioPanelEyebrow {
  const n = typeof input.slideNumber === 'number' && Number.isFinite(input.slideNumber) && input.slideNumber > 0 ? input.slideNumber : null
  switch (input.mode) {
    case 'regenerate': return { label: 'Regenerate slide', detail: n ? `Slide ${n}` : '' }
    case 'refine': return { label: 'Refine slide', detail: n ? `Slide ${n}` : '' }
    case 'edit': return { label: 'Edit slide', detail: n ? `Slide ${n}` : '' }
    default: return { label: 'Create slide', detail: n ? `Insert after slide ${n}` : '' }
  }
}

/** The Add Element panel: `label` is the selected element type's name ("Chart"). */
export function elementPanelEyebrow(input: { mode: 'generate' | 'edit' | 'refine'; label: string }): StudioPanelEyebrow {
  const label = input.mode === 'edit' ? 'Edit element' : input.mode === 'refine' ? 'Refine element' : 'Create element'
  return { label, detail: input.label ? `Selected ${input.label}` : '' }
}
