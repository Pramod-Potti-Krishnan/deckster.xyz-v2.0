/**
 * Homepage V2 — element gallery data.
 *
 * Combines the canonical product taxonomies into a single flat list of
 * cards. The gallery grid renders this list directly and filters by
 * category on the client.
 *
 * Important: charts and elements are sourced from the live taxonomies in
 * `types/elements.ts` and `homepage-v2-content.ts`. Diagrams and
 * infographics are NOT — those types in `types/elements.ts` describe the
 * legacy Layout Service taxonomy (34/14), not the live Text Labs module
 * which ships **8 diagram subtypes and unlimited generated infographics**.
 * The marketing surface needs to reflect what the product actually does.
 */

import { CHART_TYPES } from "@/types/elements"
import { ELEMENT_TYPES } from "./homepage-v2-content"

export type GalleryCategory =
  | "element"
  | "chart"
  | "diagram"
  | "infographic"

export interface GalleryCard {
  /** Unique within the gallery — `${category}:${id}` works fine. */
  id: string
  category: GalleryCategory
  /** Slug used by GalleryGlyph to pick the right visual primitive. */
  glyphKey: string
  label: string
  /** Group within the category (e.g., "Hierarchical", "Architecture"). */
  group?: string
  /** Hex color for the card accent. Resolved from category palette. */
  color: string
  /** Optional tag rendered as a corner pill. */
  badge?: string
}

const CATEGORY_COLOR: Record<GalleryCategory, string> = {
  element: "#6366f1",     // indigo
  chart: "#06b6d4",       // cyan
  diagram: "#d946ef",     // magenta
  infographic: "#fb923c", // orange
}

export const CATEGORY_LABEL: Record<GalleryCategory, string> = {
  element: "Elements",
  chart: "Charts",
  diagram: "Diagrams",
  infographic: "Infographics",
}

/** Display string for each category's count (infographics are unlimited). */
export const CATEGORY_COUNT_DISPLAY: Record<GalleryCategory, string> = {
  element: "9",
  chart: "18",
  diagram: "8",
  infographic: "∞",
}

// ---------------------------------------------------------------------------
// Element-type → glyph key (carries through from ELEMENT_TYPES).
// ---------------------------------------------------------------------------

const ELEMENT_GLYPH: Record<string, string> = {
  TEXT_BOX: "TEXT_BOX",
  METRICS: "METRICS",
  TABLE: "TABLE",
  CHART: "CHART",
  IMAGE: "IMAGE",
  ICON_LABEL: "ICON_LABEL",
  SHAPE: "SHAPE",
  INFOGRAPHIC: "INFOGRAPHIC",
  DIAGRAM: "DIAGRAM",
}

// ---------------------------------------------------------------------------
// The 8 real Text Labs diagram subtypes.
// ---------------------------------------------------------------------------

interface DiagramSpec {
  id: string
  label: string
  group: string
  glyphKey: string
}

const DIAGRAMS: ReadonlyArray<DiagramSpec> = [
  {
    id: "code_display",
    label: "Code Display",
    group: "Engineering",
    glyphKey: "code_display",
  },
  {
    id: "cloud_architecture",
    label: "Cloud Architecture",
    group: "Architecture",
    glyphKey: "cloud_architecture",
  },
  {
    id: "logical_architecture",
    label: "Logical Architecture",
    group: "Architecture",
    glyphKey: "logical_architecture",
  },
  {
    id: "data_architecture",
    label: "Data Architecture",
    group: "Architecture",
    glyphKey: "data_architecture",
  },
  {
    id: "idea_board",
    label: "Idea Board",
    group: "Planning",
    glyphKey: "idea_board",
  },
  {
    id: "kanban_board",
    label: "Kanban Board",
    group: "Planning",
    glyphKey: "kanban_board",
  },
  {
    id: "gantt_chart",
    label: "Gantt Chart",
    group: "Planning",
    glyphKey: "gantt_chart",
  },
  {
    id: "chevron_maturity",
    label: "Multi-Chevron Maturity",
    group: "Strategy",
    glyphKey: "chevron_maturity",
  },
]

// ---------------------------------------------------------------------------
// Infographic — examples, not a fixed list. The real product generates
// any shape from your description. The "+ more" tile makes that explicit.
// ---------------------------------------------------------------------------

interface InfographicSpec {
  id: string
  label: string
  group: string
  glyphKey: string
}

const INFOGRAPHICS: ReadonlyArray<InfographicSpec> = [
  // Classic shapes
  { id: "pyramid", label: "Pyramid", group: "Hierarchical", glyphKey: "pyramid" },
  { id: "funnel", label: "Funnel", group: "Sequential", glyphKey: "funnel" },
  { id: "hexagon_spread", label: "Hexagon Spread", group: "Conceptual", glyphKey: "hexagon" },
  {
    id: "concentric_circles",
    label: "Concentric Circles",
    group: "Conceptual",
    glyphKey: "concentric",
  },
  { id: "cycle", label: "Cycle Diagram", group: "Conceptual", glyphKey: "cycle" },
  { id: "timeline", label: "Timeline", group: "Sequential", glyphKey: "timeline" },
  // Imaginative shapes — the open-ended kind
  { id: "ladder", label: "Ladder", group: "Imagined", glyphKey: "ladder" },
  { id: "rocket", label: "Rocket", group: "Imagined", glyphKey: "rocket" },
  { id: "tree", label: "Tree", group: "Imagined", glyphKey: "tree" },
  { id: "ship", label: "Ship", group: "Imagined", glyphKey: "ship" },
  { id: "rail", label: "Rail", group: "Imagined", glyphKey: "rail" },
  // The "describe anything" tile
  {
    id: "anything",
    label: "Anything you describe",
    group: "Imagined",
    glyphKey: "anything",
  },
]

// ---------------------------------------------------------------------------
// Build the unified card list.
// ---------------------------------------------------------------------------

export const GALLERY_CARDS: ReadonlyArray<GalleryCard> = [
  ...ELEMENT_TYPES.map<GalleryCard>((el) => ({
    id: `element:${el.id}`,
    category: "element",
    glyphKey: ELEMENT_GLYPH[el.id] ?? "SHAPE",
    label: el.label,
    color: CATEGORY_COLOR.element,
  })),
  ...CHART_TYPES.map<GalleryCard>((c) => ({
    id: `chart:${c.type}`,
    category: "chart",
    glyphKey: c.type,
    label: c.label,
    group: c.group === "d3" ? "Advanced" : "Standard",
    color: CATEGORY_COLOR.chart,
  })),
  ...DIAGRAMS.map<GalleryCard>((d) => ({
    id: `diagram:${d.id}`,
    category: "diagram",
    glyphKey: d.glyphKey,
    label: d.label,
    group: d.group,
    color: CATEGORY_COLOR.diagram,
  })),
  ...INFOGRAPHICS.map<GalleryCard>((i) => ({
    id: `infographic:${i.id}`,
    category: "infographic",
    glyphKey: i.glyphKey,
    label: i.label,
    group: i.group,
    color: CATEGORY_COLOR.infographic,
    badge: i.id === "anything" ? "Generated" : undefined,
  })),
]

export const GALLERY_COPY = {
  eyebrow: "Every kind of slide",
  title: "Every shape your idea fits into.",
} as const
