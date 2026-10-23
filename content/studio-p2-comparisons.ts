// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS), content pass 2 (PROGRAM-1, 22 Oct): the /compare/<competitor> pages name the agents the product has now. content/comparisons.ts still told of four agents (Director, Scripter, Graphic Artist,
// Data Visualizer); the team is the eight of lib/marketing/homepage-v2-content.ts (AGENT_TEAM), content/agents.ts and the Help page. Each rule swaps one piece of text (once, in the string that holds it) when the flag is on, through
// studioReword (lib/studio-p2-docs.ts) in lib/comparisons.ts; content/comparisons.ts itself is not touched, so with the flag off every page reads as before. Data only (one type import), so the test runs it as plain code.
// Old -> new, as in content/studio-p2-docs-agents.ts: Scripter -> Content Generator; Graphic Artist -> Slide Composer; Data Visualizer -> Visualizer; "four" / "4" agents -> "eight" / "8" (the count follows the set).
import type { StudioTextRule } from "@/lib/studio-p2-docs"

export const STUDIO_COMPARISON_RULES: readonly StudioTextRule[] = [
  { from: `four specialized AI agents that collaborate`, to: `eight specialized AI agents that collaborate` },
  { from: `four specialized AI agents (Director, Scripter, Graphic Artist, Data Visualizer) working together`, to: `eight specialized AI agents (Director, Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, Element Generator) working together` },
  { from: `Scripter agent writes compelling narratives`, to: `Content Generator agent writes compelling narratives` },
  { from: `employs four specialized agents`, to: `employs eight specialized agents` },
  { from: `writing (Scripter), design (Graphic Artist), data (Data Visualizer)`, to: `writing (Content Generator), design (Slide Composer), data (Visualizer)` },
  { from: `4 specialized AI agents`, to: `8 specialized AI agents` },
  { from: `Dedicated Scripter agent`, to: `Dedicated Content Generator agent` },
  { from: `Specialist Graphic Artist`, to: `Specialist Slide Composer` },
  { from: `Data Visualizer agent analyzes your data`, to: `Visualizer agent analyzes your data` },
  { from: `Scripter writes persuasive copy, Graphic Artist designs professional slides`, to: `Content Generator writes persuasive copy, Slide Composer designs professional slides` },
  { from: `4 specialist agents`, to: `8 specialist agents` },
]
