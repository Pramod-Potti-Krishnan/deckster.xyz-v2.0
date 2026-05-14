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
  badge: `4 AI agents · ${INVENTORY_COUNTS.elements} element types · ${INVENTORY_COUNTS.charts} charts · ${INVENTORY_COUNTS.diagrams} diagrams`,
  headlineLine1: "Four AI agents.",
  headlineLine2: "Every kind of slide.",
  headlineLine3: "From a single sentence.",
  subhead: `Director, Scripter, Data Visualizer, and Graphic Artist collaborate in real time to build ${INVENTORY_COUNTS.charts} chart types, ${INVENTORY_COUNTS.diagrams} diagram patterns, and ${INVENTORY_COUNTS.infographics} infographics — all from one prompt. PowerPoint and PDF out. No templates, no pixel-pushing, no fiddling.`,
  primaryCta: "Start Building Free",
  secondaryCta: "See a deck build itself",
  countersEyebrow: "Together, they build",
} as const

export const TICKER_LABELS: ReadonlyArray<string> = ELEMENT_TYPES.map(
  (t) => t.id,
)

// The 4 specialist agents. Single source of truth used by the hero AgentStrip
// today and by the full Phase 4 AgentChoreography section later.
export type AgentId = "director" | "scripter" | "data_visualizer" | "graphic_artist"

export interface AgentMeta {
  id: AgentId
  name: string
  role: string
  iconName: "Compass" | "Type" | "BarChart3" | "Palette"
  /** Hex chosen so all four are visually distinct against the dark hero. */
  color: string
}

export const AGENT_TEAM: ReadonlyArray<AgentMeta> = [
  { id: "director",         name: "Director",        role: "Plans the deck",     iconName: "Compass",   color: "#a78bfa" },
  { id: "scripter",         name: "Scripter",        role: "Writes the copy",    iconName: "Type",      color: "#60a5fa" },
  { id: "data_visualizer",  name: "Data Visualizer", role: "Builds the charts",  iconName: "BarChart3", color: "#34d399" },
  { id: "graphic_artist",   name: "Graphic Artist",  role: "Designs the layout", iconName: "Palette",   color: "#f472b6" },
]
