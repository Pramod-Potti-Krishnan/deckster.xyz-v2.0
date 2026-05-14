/**
 * Homepage V2 — canonical inventory + copy strings.
 *
 * The "9 / 18 / 34 / 14" headline numbers are derived from this file by
 * referencing the real product taxonomy in `types/elements.ts` and
 * `types/textlabs.ts`. The hero counters and gallery counts can never drift
 * from what the product actually ships.
 */

import {
  CHART_TYPES,
  DIAGRAM_TYPES,
  INFOGRAPHIC_TYPES,
} from "@/types/elements"
import type { TextLabsComponentType } from "@/types/textlabs"

export type ElementAccent =
  | "indigo"
  | "emerald"
  | "blue"
  | "cyan"
  | "rose"
  | "amber"
  | "violet"
  | "magenta"
  | "purple"

export interface ElementTypeMeta {
  id: TextLabsComponentType
  label: string
  accent: ElementAccent
}

export const ELEMENT_TYPES: ReadonlyArray<ElementTypeMeta> = [
  { id: "TEXT_BOX", label: "Text Box", accent: "indigo" },
  { id: "METRICS", label: "Metrics", accent: "emerald" },
  { id: "TABLE", label: "Table", accent: "blue" },
  { id: "CHART", label: "Chart", accent: "cyan" },
  { id: "IMAGE", label: "Image", accent: "rose" },
  { id: "ICON_LABEL", label: "Icon/Label", accent: "amber" },
  { id: "SHAPE", label: "Shape", accent: "violet" },
  { id: "INFOGRAPHIC", label: "Infographic", accent: "magenta" },
  { id: "DIAGRAM", label: "Diagram", accent: "purple" },
]

export const INVENTORY_COUNTS = {
  elements: ELEMENT_TYPES.length,
  charts: CHART_TYPES.length,
  diagrams: DIAGRAM_TYPES.length,
  infographics: INFOGRAPHIC_TYPES.length,
} as const

export const HERO_COPY = {
  badge: `Multi-agent · ${INVENTORY_COUNTS.elements} element types · ${INVENTORY_COUNTS.charts} charts · ${INVENTORY_COUNTS.diagrams} diagrams`,
  headlineLine1: "Nine element types.",
  headlineLine2: "One prompt.",
  headlineLine3: "Zero pixel-pushing.",
  subhead: `Deckster's four-agent system writes copy, designs layouts, picks colors, and builds ${INVENTORY_COUNTS.charts} chart types, ${INVENTORY_COUNTS.diagrams} diagrams, and ${INVENTORY_COUNTS.infographics} infographics — from a single sentence. PPTX out. No templates. No fiddling.`,
  primaryCta: "Start Building Free",
  secondaryCta: "See a deck build itself",
} as const

export const TICKER_LABELS: ReadonlyArray<string> = ELEMENT_TYPES.map(
  (t) => t.id,
)
