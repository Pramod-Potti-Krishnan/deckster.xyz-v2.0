/**
 * Homepage V2 — canonical inventory + copy strings.
 *
 * Phase 1 focus: AGENTS as the protagonist. The seven specialist agents below
 * are the canonical roster shown in the hero. Element-type breadth survives
 * as a small supporting footer line via `HERO_COPY.breadthFooter`; the full
 * inventory gallery moves to Phase 3.
 */

import { CHART_TYPES } from "@/types/elements"
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

/**
 * Marketing surface counts. Diagrams are the **8 real Text Labs subtypes**
 * (CODE_DISPLAY, CLOUD_ARCHITECTURE, LOGICAL_ARCHITECTURE, DATA_ARCHITECTURE,
 * IDEA_BOARD, KANBAN_BOARD, GANTT_CHART, CHEVRON_MATURITY). Infographics
 * ship with a generative module — there is no fixed catalog. Element + chart
 * counts derive from the live taxonomies.
 */
export const INVENTORY_COUNTS = {
  elements: ELEMENT_TYPES.length,
  charts: CHART_TYPES.length,
  diagrams: 8,
  /** Sentinel: infographics are unlimited (generated from your description). */
  infographicsUnlimited: true,
} as const

export const HERO_COPY = {
  eyebrow: "A team of AI agents · Built through conversation",
  headlineLine1: "A team of AI agents builds your deck.",
  headlineLine2: "You direct them —",
  headlineLine3: "one sentence at a time.",
  subhead:
    "Talk to the Director. Reshape any slide. Tweak any element. The team handles the rest.",
  primaryCta: "Start free trial",
  secondaryCta: "See the team in action",
  breadthFooter: `${INVENTORY_COUNTS.elements} element types · ${INVENTORY_COUNTS.charts} chart variants · ${INVENTORY_COUNTS.diagrams} architectural diagrams · infographics generated from anything you can describe.`,
} as const

// The canonical specialist agent team shown in the hero. Single source of
// truth — Phase 6 will port this roster into `content/agents.ts` so the
// `/agents/[slug]` detail pages match.
export type AgentId =
  | "director"
  | "researcher"
  | "analyst"
  | "content_generator"
  | "visualizer"
  | "theme_builder"
  | "slide_composer"

export type AgentIconName =
  | "Compass"
  | "Search"
  | "TrendingUp"
  | "PenTool"
  | "BarChart3"
  | "Palette"
  | "LayoutTemplate"

export interface AgentMeta {
  id: AgentId
  name: string
  role: string
  iconName: AgentIconName
  /** Hex chosen for contrast on the dark hero surface (HSL ≈ 240 10% 4%). */
  color: string
}

export const AGENT_TEAM: ReadonlyArray<AgentMeta> = [
  {
    id: "director",
    name: "Director",
    role: "Builds the team and choreographs every step",
    iconName: "Compass",
    color: "#a78bfa",
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "Pulls facts from your data and the open web",
    iconName: "Search",
    color: "#60a5fa",
  },
  {
    id: "analyst",
    name: "Analyst",
    role: "Finds the insight inside the numbers",
    iconName: "TrendingUp",
    color: "#34d399",
  },
  {
    id: "content_generator",
    name: "Content Generator",
    role: "Writes narrative, headlines, speaker notes",
    iconName: "PenTool",
    color: "#fb923c",
  },
  {
    id: "visualizer",
    name: "Visualizer",
    role: "Designs charts, diagrams, and infographics",
    iconName: "BarChart3",
    color: "#f472b6",
  },
  {
    id: "theme_builder",
    name: "Theme Builder",
    role: "Crafts and applies your custom theme",
    iconName: "Palette",
    color: "#22d3ee",
  },
  {
    id: "slide_composer",
    name: "Slide Composer",
    role: "Conducts each slide — pacing, balance, focus",
    iconName: "LayoutTemplate",
    color: "#facc15",
  },
]

// The single "alive" line in the hero — cycles through what the team is
// doing right now. Mix of imperative and quote-style on purpose: feels like
// a real workspace.
export const AGENT_ACTIVITY_CAPTIONS: ReadonlyArray<string> = [
  "Director is scoping a Series A pitch.",
  "Researcher is pulling market sizing from your sources.",
  "Theme Builder is matching your brand palette.",
  "Analyst just spotted a 23% margin gap.",
  "Visualizer is drafting a waterfall chart.",
  "Slide Composer is balancing slide 4.",
  "Content Generator finished your speaker notes.",
  'Director: "Ready for your review."',
]

export type ScopeId = "deck" | "slide" | "element"

export type ScopeIconName =
  | "BookOpen"
  | "RectangleHorizontal"
  | "MousePointerSquareDashed"

export interface ScopeMeta {
  id: ScopeId
  label: string
  blurb: string
  iconName: ScopeIconName
  /** Tailwind-compatible hex for the card accent (gradient + ring). */
  color: string
}

export const CONVERSATION_SCOPES: ReadonlyArray<ScopeMeta> = [
  {
    id: "deck",
    label: "DECK",
    blurb: "Steer the storyline.",
    iconName: "BookOpen",
    color: "#a78bfa",
  },
  {
    id: "slide",
    label: "SLIDE",
    blurb: "Reshape any slide in chat.",
    iconName: "RectangleHorizontal",
    color: "#22d3ee",
  },
  {
    id: "element",
    label: "ELEMENT",
    blurb: "Edit any chart, any layout, any word — by asking.",
    iconName: "MousePointerSquareDashed",
    color: "#fb923c",
  },
]
