"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { STUDIO_ELEMENT_GALLERY_FIT_ENABLED, studioElementGalleryFitProps } from "@/lib/studio-element-gallery-fit"
import "./studio-element-gallery.css"

/**
 * PASS2 #6 (frontend-2): the Studio "Add Element" picker as a card gallery.
 *
 * Flag NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY (exact "true"; default off). The viewer reads the flag itself, next to its other
 * Studio switches, and renders this menu instead of the plain text dropdown only when it is on, in the normal (not
 * fullscreen) Studio viewer. Presentation only: the items, their order of handlers, their disabled rules and the follow-on
 * generation panel all come from the viewer's own `addElementItems`; nothing here opens, sizes or moves that panel.
 *
 * What changes (accepted-mockup comparison, 12 Oct): the dropdown showed nine icon + text rows in a different order from the
 * mockup. On: a header and a grid of cards, one per element type, in the mockup's order, each with a small illustration,
 * the name (the same label, which stays the accessible name) and a one-line description.
 */

export interface ElementGalleryItem {
  label: string
  icon: LucideIcon
  disabled: boolean
  action: () => unknown
}

interface CardCopy {
  description: string
  art: ReactNode
}

const frame = (children: ReactNode) => (
  <svg className="seg-art-svg" viewBox="0 0 120 72" role="presentation" aria-hidden="true" focusable="false">{children}</svg>
)

const TEXT_BOX_ART = frame(<>
  <rect x="14" y="13" width="46" height="6" rx="2" className="seg-ink" />
  <rect x="14" y="27" width="92" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="14" y="35" width="84" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="14" y="43" width="92" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="14" y="51" width="56" height="3.5" rx="1.75" className="seg-bar" />
</>)

const IMAGE_ART = frame(<>
  <rect x="12" y="9" width="96" height="54" rx="3" className="seg-tile" />
  <circle cx="86" cy="25" r="8" className="seg-coral" />
  <path d="M26 63V43a14 14 0 0 1 28 0v20z" className="seg-teal" />
  <path d="M33 63V45a7 7 0 0 1 14 0v18z" className="seg-tile" />
  <path d="M58 63c6-15 28-15 44 0z" className="seg-teal-soft" />
</>)

const CHART_ART = frame(<>
  <path d="M14 61h92" className="seg-rule" />
  <rect x="22" y="44" width="13" height="17" rx="1.5" className="seg-teal" />
  <rect x="42" y="36" width="13" height="25" rx="1.5" className="seg-teal" />
  <rect x="62" y="28" width="13" height="33" rx="1.5" className="seg-teal" />
  <rect x="82" y="14" width="13" height="47" rx="1.5" className="seg-coral" />
</>)

const METRICS_ART = frame(<>
  <rect x="11" y="17" width="30" height="38" rx="3" className="seg-tile" />
  <rect x="45" y="17" width="30" height="38" rx="3" className="seg-tile" />
  <rect x="79" y="17" width="30" height="38" rx="3" className="seg-tile" />
  <rect x="17" y="27" width="16" height="7" rx="2" className="seg-teal" />
  <rect x="51" y="27" width="16" height="7" rx="2" className="seg-teal" />
  <rect x="85" y="27" width="16" height="7" rx="2" className="seg-teal" />
  <rect x="17" y="42" width="18" height="3" rx="1.5" className="seg-bar" />
  <rect x="51" y="42" width="18" height="3" rx="1.5" className="seg-bar" />
  <rect x="85" y="42" width="18" height="3" rx="1.5" className="seg-bar" />
</>)

const TABLE_ART = frame(<>
  <rect x="12" y="12" width="96" height="11" rx="2" className="seg-teal" />
  <rect x="16" y="29" width="22" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="50" y="29" width="18" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="82" y="29" width="20" height="3.5" rx="1.75" className="seg-bar" />
  <path d="M12 38h96" className="seg-rule" />
  <rect x="16" y="43" width="22" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="50" y="43" width="14" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="82" y="43" width="18" height="3.5" rx="1.75" className="seg-bar" />
  <path d="M12 52h96" className="seg-rule" />
  <rect x="16" y="57" width="18" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="50" y="57" width="20" height="3.5" rx="1.75" className="seg-bar" />
  <rect x="82" y="57" width="14" height="3.5" rx="1.75" className="seg-bar" />
</>)

const DIAGRAM_ART = frame(<>
  <path d="M60 24v10M26 48V34h68v14M60 34v14" className="seg-link" />
  <rect x="42" y="10" width="36" height="14" rx="3" className="seg-tile seg-outline" />
  <rect x="11" y="48" width="30" height="14" rx="3" className="seg-tile seg-outline" />
  <rect x="45" y="48" width="30" height="14" rx="3" className="seg-teal" />
  <rect x="79" y="48" width="30" height="14" rx="3" className="seg-tile seg-outline" />
</>)

const INFOGRAPHIC_ART = frame(<>
  <path d="M24 28h72" className="seg-link" />
  <circle cx="24" cy="28" r="9" className="seg-teal" />
  <circle cx="60" cy="28" r="9" className="seg-coral" />
  <circle cx="96" cy="28" r="9" className="seg-teal" />
  <rect x="14" y="46" width="20" height="3.5" rx="1.75" className="seg-ink" />
  <rect x="50" y="46" width="20" height="3.5" rx="1.75" className="seg-ink" />
  <rect x="86" y="46" width="20" height="3.5" rx="1.75" className="seg-ink" />
  <rect x="17" y="54" width="14" height="3" rx="1.5" className="seg-bar" />
  <rect x="53" y="54" width="14" height="3" rx="1.5" className="seg-bar" />
  <rect x="89" y="54" width="14" height="3" rx="1.5" className="seg-bar" />
</>)

const ICON_LABEL_ART = frame(<>
  <circle cx="34" cy="36" r="17" className="seg-tile seg-outline" />
  <path d="M26 36.5l9-9h8v8l-9 9z" className="seg-teal" />
  <circle cx="39.5" cy="32" r="1.8" className="seg-tile" />
  <rect x="58" y="29" width="46" height="14" rx="7" className="seg-tile seg-outline" />
  <rect x="66" y="34.5" width="30" height="3.5" rx="1.75" className="seg-ink" />
</>)

const SHAPE_ART = frame(<>
  <circle cx="34" cy="40" r="16" className="seg-teal" />
  <rect x="50" y="22" width="30" height="30" rx="3" className="seg-coral seg-over" />
  <path d="M80 56l14-30 14 30z" className="seg-teal-soft seg-over" />
</>)

/** The mockup's order and one-line copy (design/studio-v4-mockup, 12 Oct comparison). Keyed by the viewer's own labels. */
export const ELEMENT_GALLERY_ORDER = ["Text Box", "Image", "Chart", "Metrics", "Table", "Diagram", "Infographic", "Icon / Label", "Shape"] as const

const CARD_COPY: Record<string, CardCopy> = {
  "Text Box": { description: "Headlines & body copy", art: TEXT_BOX_ART },
  "Image": { description: "An expressive visual", art: IMAGE_ART },
  "Chart": { description: "Make data meaningful", art: CHART_ART },
  "Metrics": { description: "The numbers that matter", art: METRICS_ART },
  "Table": { description: "Structured comparisons", art: TABLE_ART },
  "Diagram": { description: "Connected ideas", art: DIAGRAM_ART },
  "Infographic": { description: "A visual story", art: INFOGRAPHIC_ART },
  "Icon / Label": { description: "Symbol or text label", art: ICON_LABEL_ART },
  "Shape": { description: "A building block", art: SHAPE_ART },
}

/** The items in the mockup's order. A label the gallery does not know keeps its place after the known ones. */
export function orderElementGalleryItems<T extends { label: string }>(items: readonly T[]): T[] {
  const rank = (label: string) => {
    const index = (ELEMENT_GALLERY_ORDER as readonly string[]).indexOf(label)
    return index === -1 ? ELEMENT_GALLERY_ORDER.length : index
  }
  return items.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item.label) - rank(b.item.label) || a.index - b.index).map(({ item }) => item)
}

const GALLERY_REASON_ID = "studio-element-gallery-disabled-reason"

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/**
 * PASS2D B3a (NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT, default off): `studioElementGalleryFitProps` is empty with the flag off, so the content gets exactly the props it always had;
 * on, it adds a collision margin and the `data-studio-element-gallery-fit` marker the stylesheet's narrow-width rules hang on (lib/studio-element-gallery-fit.ts).
 *
 * `disabledReason` (PASS2B batch 1, NEXT_PUBLIC_STUDIO_DISABLED_REASONS; the viewer passes it only with that flag on): why the disabled cards are
 * disabled ("Loading the slide…", "Exit Template Mode to add elements", ...). Shown as one line under the header (role="status"), and each
 * disabled card gets it as its title and in aria-describedby. Not passed (undefined): the gallery is exactly what it was.
 */
export function StudioElementGalleryMenu({ items, disabledReason }: { items: readonly ElementGalleryItem[]; disabledReason?: string }) {
  const reasonShown = typeof disabledReason === 'string' && disabledReason !== '' && items.some(item => item.disabled)
  return (
    <DropdownMenuContent
      data-studio-authoring-menu="add-element"
      data-studio-element-gallery="true"
      align="start"
      sideOffset={8}
      className="p-1"
      {...studioElementGalleryFitProps(STUDIO_ELEMENT_GALLERY_FIT_ENABLED)}
    >
      <DropdownMenuLabel className="seg-head">
        <span className="seg-title">Add an element</span>
        <span className="seg-hint">Choose one, then shape it.</span>
        {reasonShown && <span id={GALLERY_REASON_ID} role="status" data-studio-element-gallery-reason="true" className="seg-hint">{disabledReason}</span>}
      </DropdownMenuLabel>
      {orderElementGalleryItems(items).map(({ label, icon: Icon, disabled, action }) => {
        const copy = CARD_COPY[label]
        const describedBy = copy ? `studio-element-gallery-${slug(label)}-desc` : undefined
        const cardReason = reasonShown && disabled
        return (
          <DropdownMenuItem
            key={label}
            disabled={disabled}
            onClick={() => { void action() }}
            textValue={label}
            aria-label={label}
            aria-describedby={cardReason ? [describedBy, GALLERY_REASON_ID].filter(Boolean).join(' ') : describedBy}
            title={cardReason ? disabledReason : undefined}
            data-studio-element-card={slug(label)}
            className="seg-card cursor-pointer"
          >
            <span className="seg-art" aria-hidden="true">{copy ? copy.art : <Icon className="seg-fallback-icon" />}</span>
            <span className="seg-name">{label}</span>
            {copy && <span id={describedBy} className="seg-desc">{copy.description}</span>}
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  )
}
