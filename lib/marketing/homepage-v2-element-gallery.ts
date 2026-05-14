/**
 * Homepage V2 — element gallery data.
 *
 * Combines the canonical product taxonomies (CHART_TYPES, DIAGRAM_TYPES,
 * INFOGRAPHIC_TYPES, ELEMENT_TYPES) into a single flat list of cards,
 * each with a category + lucide icon + accent color. The gallery grid
 * renders this list directly and filters by category on the client.
 */

import {
  CHART_TYPES,
  DIAGRAM_TYPES,
  INFOGRAPHIC_TYPES,
} from "@/types/elements"
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
  /** lucide-react icon component name */
  iconName: string
  label: string
  /** Group within the category (e.g., "Cycle", "Pyramid"). */
  group?: string
  /** Hex color for the card accent. Resolved from category palette. */
  color: string
  /** Optional tag for "Coming soon" or similar. */
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

// ---------------------------------------------------------------------------
// Icon mappings — map every product type to a sensible lucide icon.
// ---------------------------------------------------------------------------

const ELEMENT_ICONS: Record<string, string> = {
  TEXT_BOX: "Type",
  METRICS: "Hash",
  TABLE: "Table",
  CHART: "BarChart3",
  IMAGE: "Image",
  ICON_LABEL: "Tag",
  SHAPE: "Square",
  INFOGRAPHIC: "LayoutGrid",
  DIAGRAM: "GitBranch",
}

const CHART_ICONS: Record<string, string> = {
  line: "LineChart",
  bar_vertical: "BarChart3",
  bar_horizontal: "BarChartHorizontal",
  pie: "PieChart",
  doughnut: "CircleDashed",
  scatter: "ScatterChart",
  bubble: "CircleDot",
  radar: "Hexagon",
  polar_area: "Compass",
  area: "AreaChart",
  area_stacked: "Layers",
  bar_grouped: "BarChart2",
  bar_stacked: "BarChart",
  waterfall: "TrendingDown",
  d3_treemap: "LayoutGrid",
  d3_sunburst: "Sun",
  d3_choropleth_usa: "Map",
  d3_sankey: "ArrowRightLeft",
}

const DIAGRAM_ICONS: Record<string, string> = {
  cycle_3_step: "RefreshCw",
  cycle_4_step: "RefreshCw",
  cycle_5_step: "RefreshCw",
  pyramid_3_level: "Pyramid",
  pyramid_4_level: "Pyramid",
  pyramid_5_level: "Pyramid",
  venn_2_circle: "Combine",
  venn_3_circle: "Combine",
  honeycomb_3: "Hexagon",
  honeycomb_5: "Hexagon",
  honeycomb_7: "Hexagon",
  hub_spoke_4: "Share2",
  hub_spoke_6: "Share2",
  hub_spoke_8: "Share2",
  matrix_2x2: "Grid2x2",
  matrix_3x3: "Grid3x3",
  swot: "LayoutGrid",
  quadrant: "SquareDashed",
  funnel_3_stage: "Filter",
  funnel_4_stage: "Filter",
  funnel_5_stage: "Filter",
  process_flow_3: "Workflow",
  process_flow_5: "Workflow",
  flowchart: "Workflow",
  timeline_horizontal: "Milestone",
  gantt: "Calendar",
  sequence: "ListOrdered",
  network: "Network",
  sankey: "ArrowRightLeft",
  state: "CircleDot",
  erDiagram: "Database",
  journey: "Route",
  quadrantChart: "SquareDashed",
  class: "Box",
  gitgraph: "GitBranch",
  mindmap: "Brain",
}

const INFOGRAPHIC_ICONS: Record<string, string> = {
  pyramid: "Pyramid",
  hierarchy: "ListTree",
  funnel: "Filter",
  timeline: "Milestone",
  process: "Workflow",
  roadmap: "Route",
  comparison: "Columns2",
  venn: "Combine",
  matrix: "LayoutGrid",
  concentric_circles: "Target",
  concept_spread: "Hexagon",
  cycle: "RefreshCw",
  statistics: "BarChart3",
  list: "ListChecks",
}

// ---------------------------------------------------------------------------
// Build the unified card list.
// ---------------------------------------------------------------------------

export const GALLERY_CARDS: ReadonlyArray<GalleryCard> = [
  ...ELEMENT_TYPES.map<GalleryCard>((el) => ({
    id: `element:${el.id}`,
    category: "element",
    iconName: ELEMENT_ICONS[el.id] ?? "Square",
    label: el.label,
    color: CATEGORY_COLOR.element,
  })),
  ...CHART_TYPES.map<GalleryCard>((c) => ({
    id: `chart:${c.type}`,
    category: "chart",
    iconName: CHART_ICONS[c.type] ?? "BarChart3",
    label: c.label,
    group: c.group === "d3" ? "Advanced" : "Standard",
    color: CATEGORY_COLOR.chart,
  })),
  ...DIAGRAM_TYPES.map<GalleryCard>((d) => ({
    id: `diagram:${d.type}`,
    category: "diagram",
    iconName: DIAGRAM_ICONS[d.type] ?? "GitBranch",
    label: d.label,
    group: d.group,
    color: CATEGORY_COLOR.diagram,
    badge: d.comingSoon ? "Coming soon" : undefined,
  })),
  ...INFOGRAPHIC_TYPES.map<GalleryCard>((i) => ({
    id: `infographic:${i.type}`,
    category: "infographic",
    iconName: INFOGRAPHIC_ICONS[i.type] ?? "LayoutGrid",
    label: i.label,
    group: i.group,
    color: CATEGORY_COLOR.infographic,
  })),
]

export const GALLERY_COPY = {
  eyebrow: "Every kind of slide",
  title: "75 ways to show what you know.",
  description:
    "Element types, chart variants, diagrams, infographics — all generated by the team. Pick one, or just describe what you want to say.",
  countersEyebrow: "What ships in the box",
} as const
