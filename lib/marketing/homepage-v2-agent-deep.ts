/**
 * Phase 4 — extended copy per agent for the AgentChoreography section.
 *
 * The hero's AgentMeta keeps a single one-liner per agent. This file
 * carries the longer-form capability bullets for the deep-dive section.
 */

import type { AgentId } from "./homepage-v2-content"

export interface AgentDeep {
  id: AgentId
  /** Short noun phrase used as the card title under the agent name. */
  title: string
  /** ~2 sentence description, plain prose. */
  description: string
  /** 3-4 capability bullets, each ≤72 chars. */
  capabilities: string[]
  /** Optional href when the agent has a detail page. */
  detailHref?: string
}

export const AGENT_DEEP: Readonly<Record<AgentId, AgentDeep>> = {
  director: {
    id: "director",
    title: "The Orchestrator",
    description:
      "Reads your brief, scopes the deck, picks the team, and coordinates every handoff. The Director is who you talk to first — and who closes the loop after every change.",
    capabilities: [
      "Plans the deck slide-by-slide",
      "Picks the right agent per step",
      "Adapts as you give feedback",
      "Reviews coherence across the deck",
    ],
    detailHref: "/agents/director",
  },
  researcher: {
    id: "researcher",
    title: "The Investigator",
    description:
      "Pulls facts from your uploaded files, your connected data sources, and the open web. Cites where each number came from so you can trust the deck.",
    capabilities: [
      "Searches files, drives, and web",
      "Pulls market data on demand",
      "Cites every source it uses",
      "Flags conflicting numbers",
    ],
    detailHref: "/agents/researcher",
  },
  analyst: {
    id: "analyst",
    title: "The Insight Finder",
    description:
      "Looks at the numbers and tells you what they mean. Spots trends, gaps, and outliers — then writes the one-line takeaway your audience actually needs.",
    capabilities: [
      "Spots trends, outliers, and gaps",
      "Computes ratios and growth rates",
      "Drafts the headline insight",
      "Flags weak data before it ships",
    ],
    detailHref: "/agents/analyst",
  },
  content_generator: {
    id: "content_generator",
    title: "The Storyteller",
    description:
      "Writes the words. Headlines, body copy, bullet hierarchies, speaker notes — tuned to your audience and the moment in the narrative arc.",
    capabilities: [
      "Writes headlines, body, and notes",
      "Adapts tone to your audience",
      "Keeps voice consistent",
      "Compresses or expands on request",
    ],
    detailHref: "/agents/content-generator",
  },
  visualizer: {
    id: "visualizer",
    title: "The Designer",
    description:
      "Turns numbers and concepts into the right picture. Picks the chart type, builds the diagram, lays out the infographic — all on the canvas.",
    capabilities: [
      "Picks the right chart type",
      "Builds 8 diagram patterns",
      "Generates infographics on demand",
      "Keeps visuals on one color system",
    ],
    detailHref: "/agents/visualizer",
  },
  theme_builder: {
    id: "theme_builder",
    title: "The Stylist",
    description:
      "Builds your custom theme — palette, typography, surface treatments — and applies it consistently across every slide and every visual.",
    capabilities: [
      "Generates a theme from your brand",
      "Applies palette and type globally",
      "Switches themes mid-deck",
      "Keeps visuals on the theme scale",
    ],
    detailHref: "/agents/theme-builder",
  },
  slide_composer: {
    id: "slide_composer",
    title: "The Conductor",
    description:
      "Owns each slide's pacing, balance, and focus. Decides what's hero and what's supporting, where the eye should land, and what to cut when it's too busy.",
    capabilities: [
      "Balances density and white space",
      "Picks the focal element",
      "Cuts elements that crowd",
      "Re-flows tight or loose on request",
    ],
    detailHref: "/agents/slide-composer",
  },
  element_generator: {
    id: "element_generator",
    title: "The Builder",
    description:
      "Builds the atomic pieces every slide is made of — text boxes, metrics, tables, icons, shapes. Picks the right component for each idea and renders it cleanly.",
    capabilities: [
      "Generates 9 element types",
      "Sizes and positions atoms",
      "Re-renders on theme change",
      "Keeps spacing and alignment tight",
    ],
    detailHref: "/agents/element-generator",
  },
}

export const CHOREO_COPY = {
  eyebrow: "Meet the team",
  title: "Specialists, not a one-size-fits-all model.",
  description:
    "Each agent owns one part — the Director keeps them in sync.",
} as const
