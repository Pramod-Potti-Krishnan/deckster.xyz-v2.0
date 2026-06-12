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

/**
 * Hero rule: visitor vocabulary only. Cold visitors know presentation
 * terms (deck, slides, charts, PowerPoint) and general AI verbs (plan,
 * research, write, design) — they do NOT know our product terms yet.
 * "Director" and friends get introduced on the team slide, after the demo
 * has shown them working. Display type stays ≤ ~8 words; the explanation
 * lives in the subhead.
 */
export const HERO_COPY = {
  eyebrow: "AI presentation builder",
  // Rendered with the brand gradient — the product payoff under the
  // rotating personal moment.
  headlineAccent: "Your deck is getting built.",
  subhead:
    "A team of AI agents plans the story, researches the facts, writes the words, and designs every slide — checking in with you in plain English at every step.",
  primaryCta: "Get Started",
  // The hero's single secondary path is the scroll connector at the slide's
  // bottom edge — a promise of what's next, not a second button competing
  // with Get Started. Rendered in caps by ScrollCue.
  scrollConnector: "See the team in action",
} as const

/**
 * Rotating first headline line — the visitor's reclaimed moment. The hero
 * sells the person's life with the product; the fixed gradient line below
 * ("Your deck is getting built.") keeps the product instantly legible.
 * First phrase is the SSR/reduced-motion fallback.
 */
export const HERO_ROTATING_PHRASES: ReadonlyArray<string> = [
  "Take that walk.",
  "Drink your tea.",
  "Rehearse your pitch.",
  "Call it a night.",
]

// Honest trust signals — every line is a verifiable product fact stated in
// visitor terms, not social proof (we have none yet and won't fabricate
// it). Shown under the hero CTAs and again in the final CTA slide.
export const TRUST_SIGNALS: ReadonlyArray<string> = [
  "Charts, diagrams & infographics built in",
  "PowerPoint & PDF export — no watermark",
  "No templates — just conversation",
]

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
  | "element_generator"

export type AgentIconName =
  | "Compass"
  | "Search"
  | "TrendingUp"
  | "PenTool"
  | "BarChart3"
  | "Palette"
  | "LayoutTemplate"
  | "Layers"

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
  {
    id: "element_generator",
    name: "Element Generator",
    role: "Builds the atomic pieces every slide is made of",
    iconName: "Layers",
    color: "#c084fc",
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

export type ScopeId = "describe" | "build" | "refine" | "remember"

export type ScopeIconName = "PenLine" | "Hammer" | "MessageCircle" | "Brain"

export interface ScopeMeta {
  id: ScopeId
  label: string
  blurb: string
  iconName: ScopeIconName
  /** Tailwind-compatible hex for the card accent (gradient + ring). */
  color: string
}

/**
 * The hero's four cards tell the cycle with the person as protagonist:
 * you describe → they build → you refine → it remembers. The last beat is
 * the compounding payoff PK considers the biggest benefit — every deck
 * grows a personal knowledge base the agents lean on next time. Blurbs
 * stay short and parallel so each card scans as one beat.
 */
export const CONVERSATION_SCOPES: ReadonlyArray<ScopeMeta> = [
  {
    id: "describe",
    label: "YOU DESCRIBE",
    blurb: "A sentence or a full brief — with your data.",
    iconName: "PenLine",
    color: "#a78bfa",
  },
  {
    id: "build",
    label: "THEY BUILD",
    blurb: "Story, slides, charts, design.",
    iconName: "Hammer",
    color: "#22d3ee",
  },
  {
    id: "refine",
    label: "YOU REFINE",
    blurb: "Change anything by asking.",
    iconName: "MessageCircle",
    color: "#fb923c",
  },
  {
    id: "remember",
    label: "IT REMEMBERS",
    blurb: "Your knowledge base grows with every deck.",
    iconName: "Brain",
    color: "#34d399",
  },
]
