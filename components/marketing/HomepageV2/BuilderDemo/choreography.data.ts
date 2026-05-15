import type { AgentId } from "@/lib/marketing/homepage-v2-content"
import type { ChoreoStep, SlideElementSpec } from "./types"

/** Total length of one loop cycle, including the closing hold. */
export const LOOP_DURATION_MS = 21_000

/** Helper: emit start + stop events for an agent pulse. */
function pulse(agent: AgentId, t: number, durationMs: number): ChoreoStep[] {
  return [
    { t, kind: "agent_pulse_start", agent },
    { t: t + durationMs, kind: "agent_pulse_stop", agent },
  ]
}

const TITLE: SlideElementSpec = {
  id: "title",
  type: "title",
  col: 0,
  span: 12,
  row: 0,
  rowSpan: 1,
  data: {
    kind: "title",
    text: "Series A Pitch — FinTechCo",
    subtitle: "Market opportunity & traction",
  },
}

const METRIC_TAM: SlideElementSpec = {
  id: "m1",
  type: "metric",
  col: 0,
  span: 4,
  row: 1,
  rowSpan: 2,
  data: { kind: "metric", value: "$84B", label: "TAM", color: "#a78bfa" },
}
const METRIC_SAM: SlideElementSpec = {
  id: "m2",
  type: "metric",
  col: 4,
  span: 4,
  row: 1,
  rowSpan: 2,
  data: { kind: "metric", value: "$12B", label: "SAM", color: "#22d3ee" },
}
const METRIC_SOM: SlideElementSpec = {
  id: "m3",
  type: "metric",
  col: 8,
  span: 4,
  row: 1,
  rowSpan: 2,
  data: { kind: "metric", value: "$640M", label: "SOM (3y)", color: "#34d399" },
}
const CHART: SlideElementSpec = {
  id: "c1",
  type: "chart",
  col: 0,
  span: 12,
  row: 3,
  rowSpan: 3,
  data: {
    kind: "chart",
    label: "Revenue projection — 2026 → 2029 (in $M)",
    color: "#fb923c",
    bars: [12, 28, 54, 96, 162],
  },
}

/**
 * The single-scope (DECK) demo loop. Each entry is an absolute-millisecond
 * `t` from the start of the loop. The reducer applies steps in `t` order.
 *
 * Adding SLIDE / ELEMENT scope variations is purely additive — append more
 * steps after t=15500 and bump LOOP_DURATION_MS. No refactor needed.
 */
const RAW_STEPS: ChoreoStep[] = [
  { t: 0, kind: "scope", scope: "deck" },

  // User prompt — typewriter for ~2.4s
  {
    t: 200,
    kind: "chat",
    line: {
      id: "u1",
      speaker: "user",
      text: "Build me a Series A pitch deck for FinTechCo. 8 slides.",
      typeMs: 2300,
    },
  },

  // Director routes
  ...pulse("director", 2700, 3000),
  {
    t: 2900,
    kind: "chat",
    line: {
      id: "d1",
      speaker: "director",
      text: "On it. Routing to the team…",
      typeMs: 900,
    },
  },

  // Theme + background wash-in
  ...pulse("theme_builder", 3900, 2800),
  { t: 4100, kind: "theme", bgColor: "#0b1736" },

  // Researcher pulls data
  ...pulse("researcher", 4700, 4000),
  {
    t: 4900,
    kind: "chat",
    line: {
      id: "r1",
      speaker: "researcher",
      text: "Pulling market sizing from your sources…",
      typeMs: 1400,
    },
  },

  // Title appears
  { t: 6500, kind: "element_add", element: TITLE },

  // Analyst calls out the insight
  ...pulse("analyst", 7400, 3500),
  {
    t: 7600,
    kind: "chat",
    line: {
      id: "a1",
      speaker: "analyst",
      text: "Found a 23% margin gap at scale.",
      typeMs: 1200,
    },
  },

  // Three metric tiles, staggered
  { t: 8900, kind: "element_add", element: METRIC_TAM },
  { t: 9200, kind: "element_add", element: METRIC_SAM },
  { t: 9500, kind: "element_add", element: METRIC_SOM },

  // Visualizer drafts the chart
  ...pulse("visualizer", 10500, 4200),
  {
    t: 10700,
    kind: "chat",
    line: {
      id: "v1",
      speaker: "visualizer",
      text: "Drafting the trend chart…",
      typeMs: 1100,
    },
  },
  { t: 12000, kind: "element_add", element: CHART },

  // Slide Composer balances
  ...pulse("slide_composer", 13900, 2400),
  {
    t: 14100,
    kind: "chat",
    line: {
      id: "sc1",
      speaker: "slide_composer",
      text: "Balanced layout — slide 1 ready.",
      typeMs: 1300,
    },
  },

  // Director closes out
  {
    t: 15600,
    kind: "chat",
    line: {
      id: "d2",
      speaker: "director",
      text: 'Director: "Ready for your review."',
      typeMs: 1300,
    },
  },

  // Hold the final state from ~17s through 21s, then reset and loop.
  { t: LOOP_DURATION_MS, kind: "reset" },
]

export const STEPS: ReadonlyArray<ChoreoStep> = [...RAW_STEPS].sort(
  (a, b) => a.t - b.t,
)
