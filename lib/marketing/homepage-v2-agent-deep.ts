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
      "Decomposes goals into a slide-by-slide plan",
      "Assigns tasks to the right specialist on each step",
      "Reviews coherence across the whole deck",
      "Adapts the plan as you give feedback",
    ],
    detailHref: "/agents/director",
  },
  researcher: {
    id: "researcher",
    title: "The Investigator",
    description:
      "Pulls facts from your uploaded files, your connected data sources, and the open web. Cites where each number came from so you can trust the deck.",
    capabilities: [
      "Searches your files, drives, and connected sources",
      "Pulls public market data and benchmarks on demand",
      "Surfaces source citations for every claim",
      "Flags conflicting numbers across sources",
    ],
    detailHref: "/agents/researcher",
  },
  analyst: {
    id: "analyst",
    title: "The Insight Finder",
    description:
      "Looks at the numbers and tells you what they mean. Spots trends, gaps, and outliers — then writes the one-line takeaway your audience actually needs.",
    capabilities: [
      "Identifies trends, outliers, and inflection points",
      "Computes ratios, growth rates, and segment splits",
      "Drafts the headline insight for each chart",
      "Flags weak data so you don't ship a soft slide",
    ],
    detailHref: "/agents/analyst",
  },
  content_generator: {
    id: "content_generator",
    title: "The Storyteller",
    description:
      "Writes the words. Headlines, body copy, bullet hierarchies, speaker notes — tuned to your audience and the moment in the narrative arc.",
    capabilities: [
      "Drafts headlines, body, and per-slide speaker notes",
      "Adapts tone for board, sales, technical, or hybrid",
      "Compresses or expands existing copy on request",
      "Keeps voice consistent across the whole deck",
    ],
    detailHref: "/agents/content-generator",
  },
  visualizer: {
    id: "visualizer",
    title: "The Designer",
    description:
      "Turns numbers and concepts into the right picture. Picks the chart type, builds the diagram, lays out the infographic — all on the canvas.",
    capabilities: [
      "Picks the right chart from 18 types — bar to Sankey",
      "Builds 8 diagrams — cloud, logical, data, kanban, gantt",
      "Generates infographics from any shape you can describe",
      "Keeps every visual on the same color and scale system",
    ],
    detailHref: "/agents/visualizer",
  },
  theme_builder: {
    id: "theme_builder",
    title: "The Stylist",
    description:
      "Builds your custom theme — palette, typography, surface treatments — and applies it consistently across every slide and every visual.",
    capabilities: [
      "Generates a custom theme from your brand or brief",
      "Applies palette, type, and spacing rules globally",
      "Keeps charts and diagrams on the theme's color scale",
      "Switches themes mid-deck without breaking layouts",
    ],
    detailHref: "/agents/theme-builder",
  },
  slide_composer: {
    id: "slide_composer",
    title: "The Conductor",
    description:
      "Owns each slide's pacing, balance, and focus. Decides what's hero and what's supporting, where the eye should land, and what to cut when it's too busy.",
    capabilities: [
      "Balances density and white space slide by slide",
      "Picks the focal element and arranges around it",
      "Cuts elements that crowd the message",
      "Re-flows when you ask for a tighter or looser look",
    ],
    detailHref: "/agents/slide-composer",
  },
  element_generator: {
    id: "element_generator",
    title: "The Builder",
    description:
      "Builds the atomic pieces every slide is made of — text boxes, metrics, tables, icons, shapes. Picks the right component for each idea and renders it cleanly.",
    capabilities: [
      "Generates 9 element types — text, metrics, tables, more",
      "Sizes and positions atoms inside each layout",
      "Re-renders atoms when content or theme changes",
      "Keeps element spacing and alignment consistent",
    ],
  },
}

export const CHOREO_COPY = {
  eyebrow: "Meet the team",
  title: "Specialists, not a one-size-fits-all model.",
  description:
    "Each agent owns one part of building a great deck. The Director keeps them in sync — you stay in the conversation.",
} as const
