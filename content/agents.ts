import { Agent } from "@/types/agents"

/**
 * Canonical agent roster — 7 specialists.
 *
 * The homepage hero (lib/marketing/homepage-v2-content.ts → AGENT_TEAM) and
 * the homepage agent deep-dive (lib/marketing/homepage-v2-agent-deep.ts →
 * AGENT_DEEP) carry the lighter copy used on the homepage. This file is the
 * source of truth for the /agents/[slug] detail pages.
 *
 * Slugs are hyphenated and must match the URLs in AGENT_DEEP.detailHref.
 */

export const agents: Agent[] = [
  {
    id: "director",
    name: "Director",
    slug: "director",
    title: "The Orchestrator",
    tagline: "Builds the team and choreographs every step",
    description:
      "The Director reads your brief, scopes the deck, picks the right specialists, and coordinates every handoff between them. It's who you talk to first — and who closes the loop after every change you ask for.",
    color: {
      primary: "violet-600",
      secondary: "violet-100",
      gradient: "from-violet-600 to-purple-600",
    },
    icon: "Compass",
    capabilities: [
      {
        id: "decompose-goals",
        title: "Decompose goals into a slide-by-slide plan",
        description:
          "Reads your brief and produces a concrete outline — slide order, content type per slide, and the agents that will handle each one.",
      },
      {
        id: "assign-tasks",
        title: "Assign tasks to the right specialist",
        description:
          "Routes each unit of work to whichever agent is best suited — Researcher, Analyst, Visualizer, and so on — and keeps them in sync.",
      },
      {
        id: "review-coherence",
        title: "Review coherence across the whole deck",
        description:
          "Catches drift in tone, voice, palette, and narrative arc as the deck assembles. Flags anything that breaks the through-line.",
      },
      {
        id: "adapt-plan",
        title: "Adapt the plan as you give feedback",
        description:
          "Re-plans on the fly when you change scope, audience, or the order of the story.",
      },
    ],
    useCases: [
      {
        id: "series-a-pitch",
        title: "Investor Pitch Decks",
        description:
          "Coordinates a tight, story-led pitch with market sizing, traction, and the ask — keeping every slide on-brief.",
        example:
          "Series A deck: market opportunity, traction milestones, financials, team, ask.",
      },
      {
        id: "quarterly-review",
        title: "Quarterly Business Reviews",
        description:
          "Orchestrates data-heavy QBR decks with executive-level polish and clear takeaways per section.",
        example:
          "QBR with revenue, retention, pipeline, and strategic priorities for the next quarter.",
      },
      {
        id: "product-launch",
        title: "Product Launches",
        description:
          "Coordinates messaging across launch slides — problem, solution, differentiation, and rollout plan.",
        example:
          "New product launch deck with positioning, demo flow, pricing tiers, and rollout phases.",
      },
    ],
    technicalDetails: [
      {
        id: "task-decomposition",
        aspect: "Task Decomposition",
        description:
          "Hierarchical breakdown of high-level goals into agent-assignable work units.",
      },
      {
        id: "coordination",
        aspect: "Coordination",
        description:
          "Maintains a shared brief and reconciles edits from each specialist before they land on the canvas.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Read the Brief",
        description:
          "Extracts goals, audience, key messages, and constraints from your initial prompt.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Build the Plan",
        description:
          "Produces a slide-by-slide outline with content needs and the right specialist for each.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Coordinate the Team",
        description:
          "Hands work to specialists, syncs their outputs, and keeps the narrative coherent.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Close the Loop",
        description:
          "Reviews the assembled deck, integrates your feedback, and re-plans where needed.",
      },
    ],
  },
  {
    id: "researcher",
    name: "Researcher",
    slug: "researcher",
    title: "The Investigator",
    tagline: "Pulls facts from your data and the open web",
    description:
      "The Researcher pulls facts from your uploaded files, your connected data sources, and the open web. It cites where each number came from, so you can trust — and defend — every claim in the deck.",
    color: {
      primary: "blue-600",
      secondary: "blue-100",
      gradient: "from-blue-600 to-cyan-600",
    },
    icon: "Search",
    capabilities: [
      {
        id: "search-internal",
        title: "Searches your files and connected sources",
        description:
          "Pulls from uploaded PDFs, slide decks, sheets, drives, and any data warehouse you've connected.",
      },
      {
        id: "search-external",
        title: "Pulls public data on demand",
        description:
          "Reaches market sizing, benchmarks, public filings, and news when the deck needs grounding from the open web.",
      },
      {
        id: "cite-sources",
        title: "Surfaces source citations",
        description:
          "Every number ships with a citation so you can see — and link to — where it came from.",
      },
      {
        id: "flag-conflicts",
        title: "Flags conflicting numbers across sources",
        description:
          "Calls out when two sources disagree, so you choose the right one rather than averaging by accident.",
      },
    ],
    useCases: [
      {
        id: "market-research",
        title: "Market Research Decks",
        description:
          "Pulls TAM/SAM/SOM, competitive landscape, and growth projections — all sourced.",
        example:
          "Market overview deck with size, segments, and three-year growth — every number cited.",
      },
      {
        id: "internal-data",
        title: "Internal Data Reviews",
        description:
          "Surfaces metrics from your own warehouse and integrations into the deck without re-typing.",
        example:
          "Board update pulling MRR, NRR, and churn straight from your billing data warehouse.",
      },
    ],
    technicalDetails: [
      {
        id: "retrieval",
        aspect: "Retrieval",
        description:
          "Hybrid retrieval across your private corpus and the open web with relevance ranking.",
      },
      {
        id: "citations",
        aspect: "Citations",
        description:
          "Every fact carries a source pointer that the deck preserves for review and audit.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Receive the Question",
        description:
          "Gets a research brief from the Director with what to find and where to look first.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Search the Corpus",
        description:
          "Searches your files and connected sources before reaching outside.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Reach the Open Web",
        description:
          "When internal sources fall short, pulls public market data, filings, and news.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Hand Off Sourced Facts",
        description:
          "Returns facts with citations to the Director and Analyst for the next stage.",
      },
    ],
  },
  {
    id: "analyst",
    name: "Analyst",
    slug: "analyst",
    title: "The Insight Finder",
    tagline: "Finds the insight inside the numbers",
    description:
      "The Analyst looks at the numbers and tells you what they mean. It spots trends, gaps, and outliers — then writes the one-line takeaway your audience actually needs to leave the slide with.",
    color: {
      primary: "emerald-600",
      secondary: "emerald-100",
      gradient: "from-emerald-600 to-teal-600",
    },
    icon: "TrendingUp",
    capabilities: [
      {
        id: "spot-trends",
        title: "Identifies trends, outliers, and inflection points",
        description:
          "Looks at the data the Researcher pulled and surfaces what's actually moving — and what's noise.",
      },
      {
        id: "compute-derived",
        title: "Computes ratios, growth rates, and segment splits",
        description:
          "Derives the second-order metrics that change how the data should be visualized.",
      },
      {
        id: "draft-insight",
        title: "Drafts the headline insight per chart",
        description:
          "Writes the one-line takeaway every chart needs so the audience reads the chart correctly.",
      },
      {
        id: "flag-weak-data",
        title: "Flags weak data so you don't ship a soft slide",
        description:
          "Calls out small samples, conflicting trends, and confidence concerns before the deck goes out.",
      },
    ],
    useCases: [
      {
        id: "performance-review",
        title: "Performance Reviews",
        description:
          "Turns dashboards into one-line insights — what changed, why, and what to do about it.",
        example:
          "Quarterly OKR review with progress %, variance vs plan, and the takeaway per goal.",
      },
      {
        id: "experiment-readout",
        title: "Experiment Readouts",
        description:
          "Surfaces the meaningful effect, the size, and the confidence — not just the raw chart.",
        example:
          "A/B test readout: lift, sample size, confidence interval, and the recommended call.",
      },
    ],
    technicalDetails: [
      {
        id: "stats",
        aspect: "Statistical Analysis",
        description:
          "Trend detection, outlier flagging, segment comparison, and confidence-aware reasoning.",
      },
      {
        id: "explanation",
        aspect: "Insight Drafting",
        description:
          "Produces a single, plain-language takeaway calibrated to the audience.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Receive the Data",
        description:
          "Gets the sourced data from the Researcher and the audience context from the Director.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Find the Signal",
        description:
          "Detects trends, outliers, and inflection points worth featuring.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Draft the Insight",
        description:
          "Writes the one-line takeaway and recommends the right chart type.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Hand Off to Visualizer",
        description:
          "Passes the insight + chart spec to the Visualizer to render.",
      },
    ],
  },
  {
    id: "content-generator",
    name: "Content Generator",
    slug: "content-generator",
    title: "The Storyteller",
    tagline: "Writes narrative, headlines, and speaker notes",
    description:
      "The Content Generator writes the words. Headlines, body copy, bullet hierarchies, speaker notes — tuned to your audience and the moment in the narrative arc the Director laid out.",
    color: {
      primary: "orange-500",
      secondary: "orange-100",
      gradient: "from-orange-500 to-amber-500",
    },
    icon: "PenTool",
    capabilities: [
      {
        id: "draft-copy",
        title: "Drafts headlines, body, and per-slide speaker notes",
        description:
          "Writes the full text payload of every slide and matching talking points underneath.",
      },
      {
        id: "tone-match",
        title: "Adapts tone for board, sales, technical, or hybrid audiences",
        description:
          "Calibrates voice and formality to the audience the Director identified.",
      },
      {
        id: "compress-expand",
        title: "Compresses or expands existing copy on request",
        description:
          "Tightens dense slides or fills out sparse ones without losing the meaning.",
      },
      {
        id: "voice-consistency",
        title: "Keeps voice consistent across the whole deck",
        description:
          "Guards against tone drift as different sections accumulate.",
      },
    ],
    useCases: [
      {
        id: "sales-deck",
        title: "Sales Decks",
        description:
          "Writes problem-agitate-solve copy that lands with prospects and supports the rep on stage.",
        example:
          "Enterprise sales deck with persona-tuned headlines and detailed speaker notes.",
      },
      {
        id: "training",
        title: "Training Materials",
        description:
          "Produces clear, retainable copy with structured bullets and matching narration.",
        example:
          "Onboarding deck explaining product, process, and culture in plain language.",
      },
    ],
    technicalDetails: [
      {
        id: "nlg",
        aspect: "Natural Language Generation",
        description:
          "Context-aware drafting tuned per slide type and audience parameter.",
      },
      {
        id: "tone",
        aspect: "Tone Calibration",
        description:
          "Adjusts formality, register, and density to the brief.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Receive the Brief",
        description:
          "Gets the slide outline and audience context from the Director.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Draft the Copy",
        description:
          "Writes headlines, body, and speaker notes for each slide.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Tune the Voice",
        description:
          "Adjusts tone and density to match the audience.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Refine on Feedback",
        description:
          "Re-drafts based on your edits and the Director's review.",
      },
    ],
  },
  {
    id: "visualizer",
    name: "Visualizer",
    slug: "visualizer",
    title: "The Designer",
    tagline: "Designs charts, diagrams, and infographics",
    description:
      "The Visualizer turns numbers and concepts into the right picture. Picks the chart type, builds the diagram, lays out the infographic — all on the canvas, all on-theme.",
    color: {
      primary: "pink-600",
      secondary: "pink-100",
      gradient: "from-pink-600 to-rose-600",
    },
    icon: "BarChart3",
    capabilities: [
      {
        id: "chart-selection",
        title: "Selects the most legible chart for the data",
        description:
          "Picks among 18 chart types — bar, line, area, pie, scatter, treemap, sankey — based on data shape and the audience.",
      },
      {
        id: "diagram-builder",
        title: "Builds the 8 diagrams engineers and PMs actually need",
        description:
          "Code Display, Cloud Architecture, Logical Architecture, Data Architecture, Idea Board, Kanban Board, Gantt Chart, and Multi-Chevron Maturity — rendered from the brief.",
      },
      {
        id: "infographic-generator",
        title: "Generates any infographic from a description",
        description:
          "Pyramid, funnel, hexagon spread, concentric circles — but also a ladder, a rocket, a tree, a ship, a rail. Whatever shape your idea fits into, the Visualizer renders it.",
      },
      {
        id: "rerender",
        title: "Re-renders any visual when you change the data",
        description:
          "Update the source numbers and the chart, scale, and labels follow without breaking the layout.",
      },
      {
        id: "color-system",
        title: "Keeps every visual on the same color and scale system",
        description:
          "Coordinates with the Theme Builder so charts and diagrams stay on-theme across the whole deck.",
      },
    ],
    useCases: [
      {
        id: "financial-charts",
        title: "Financial Reports",
        description:
          "Renders revenue trends, cost waterfalls, and variance analyses with the right chart per question.",
        example:
          "Quarterly earnings deck with waterfall, trend lines, and segment bars.",
      },
      {
        id: "process-diagrams",
        title: "Process Diagrams",
        description:
          "Builds flowcharts, cycles, and hub-and-spoke layouts that read at a glance.",
        example:
          "Operations review with a 5-step process flow, dependency network, and ownership matrix.",
      },
    ],
    technicalDetails: [
      {
        id: "chart-engine",
        aspect: "Chart Engine",
        description:
          "Chart.js + D3 backed library covering 18 chart types and 4 advanced visualizations.",
      },
      {
        id: "diagram-engine",
        aspect: "Diagram Engine",
        description:
          "Eight purpose-built diagram subtypes covering engineering (Code Display), architecture (Cloud, Logical, Data), planning (Idea Board, Kanban, Gantt), and strategy (Multi-Chevron Maturity).",
      },
      {
        id: "infographic-engine",
        aspect: "Infographic Engine",
        description:
          "Generative module that renders any visual concept you describe — from classic shapes (pyramid, funnel, cycle) to imaginative ones (ladder, rocket, tree, ship, rail).",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Receive the Spec",
        description:
          "Gets the data and the headline insight from the Analyst.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Pick the Visual",
        description:
          "Chooses the chart, diagram, or infographic that lands the insight.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Render on Canvas",
        description:
          "Renders the visual with the Theme Builder's palette and scale.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Adjust on Request",
        description:
          "Re-renders when you ask for a different chart type or a data change.",
      },
    ],
  },
  {
    id: "theme-builder",
    name: "Theme Builder",
    slug: "theme-builder",
    title: "The Stylist",
    tagline: "Crafts and applies your custom theme",
    description:
      "The Theme Builder builds your custom theme — palette, typography, surface treatments — and applies it consistently across every slide and every visual on the canvas.",
    color: {
      primary: "cyan-500",
      secondary: "cyan-100",
      gradient: "from-cyan-500 to-sky-500",
    },
    icon: "Palette",
    capabilities: [
      {
        id: "generate-theme",
        title: "Generates a custom theme from your brand or brief",
        description:
          "Reads a brand kit, a website, or a description and produces a coherent palette + type system.",
      },
      {
        id: "apply-globally",
        title: "Applies palette, type, and spacing rules globally",
        description:
          "Pushes the theme down through every slide, chart, and diagram in the deck.",
      },
      {
        id: "chart-palette",
        title: "Keeps charts and diagrams on the theme's color scale",
        description:
          "Coordinates with the Visualizer so visuals never reach for off-theme colors.",
      },
      {
        id: "swap-themes",
        title: "Switches themes mid-deck without breaking layouts",
        description:
          "Re-themes the whole deck on request — palette, type, and surfaces — without re-doing layout work.",
      },
    ],
    useCases: [
      {
        id: "brand-decks",
        title: "Brand-Aligned Decks",
        description:
          "Produces internal and external decks that read as on-brand the second they open.",
        example:
          "Corporate keynote with brand palette, custom type, and consistent surface styling.",
      },
      {
        id: "audience-themes",
        title: "Audience-Specific Themes",
        description:
          "Switches the deck's whole look when the same content goes to a different audience.",
        example:
          "Investor deck and customer deck of the same content — two themes, one source.",
      },
    ],
    technicalDetails: [
      {
        id: "palette-gen",
        aspect: "Palette Generation",
        description:
          "Theory-driven palette construction with accessibility-aware contrast checks.",
      },
      {
        id: "system-application",
        aspect: "System Application",
        description:
          "Theme tokens cascade through layout, type, charts, and diagrams from a single source.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Capture the Brand",
        description:
          "Reads the brand kit, website, or text brief to extract identity inputs.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Generate the System",
        description:
          "Produces a coherent palette, type, and surface set with accessibility checks.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Apply Globally",
        description:
          "Cascades the system through every slide and visual.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Re-theme on Request",
        description:
          "Swaps the system without re-doing layout when you change audience or brand.",
      },
    ],
  },
  {
    id: "slide-composer",
    name: "Slide Composer",
    slug: "slide-composer",
    title: "The Conductor",
    tagline: "Conducts each slide — pacing, balance, focus",
    description:
      "The Slide Composer owns each slide's pacing, balance, and focus. Decides what's hero and what's supporting, where the eye should land, and what to cut when it gets too busy.",
    color: {
      primary: "yellow-500",
      secondary: "yellow-100",
      gradient: "from-yellow-500 to-amber-500",
    },
    icon: "LayoutTemplate",
    capabilities: [
      {
        id: "balance",
        title: "Balances density and white space slide by slide",
        description:
          "Manages the visual weight of every slide so it lands without feeling crowded.",
      },
      {
        id: "focal-point",
        title: "Picks the focal element and arranges around it",
        description:
          "Decides what should anchor the slide and arranges supporting content to direct the eye.",
      },
      {
        id: "cut-clutter",
        title: "Cuts elements that crowd the message",
        description:
          "Removes content that competes for attention with the slide's main point.",
      },
      {
        id: "reflow",
        title: "Re-flows when you ask for a tighter or looser look",
        description:
          "Adjusts the layout when you want denser slides or more breathing room.",
      },
    ],
    useCases: [
      {
        id: "executive-decks",
        title: "Executive Decks",
        description:
          "Pares each slide to the one thing the executive needs to leave with.",
        example:
          "C-suite review where every slide answers exactly one question.",
      },
      {
        id: "conference-talks",
        title: "Conference Talks",
        description:
          "Shapes slides for talk pacing — big, simple, and on-cue.",
        example:
          "Keynote slides with single visual focal points and minimal supporting text.",
      },
    ],
    technicalDetails: [
      {
        id: "layout-engine",
        aspect: "Layout Engine",
        description:
          "Constraint-based layout that balances visual weight across the slide grid.",
      },
      {
        id: "focal-selection",
        aspect: "Focal Selection",
        description:
          "Chooses the hero element per slide based on the Director's brief.",
      },
    ],
    workflow: [
      {
        id: "step-1",
        step: 1,
        title: "Receive the Slide",
        description:
          "Gets the assembled elements from the other specialists.",
      },
      {
        id: "step-2",
        step: 2,
        title: "Pick the Focal",
        description:
          "Decides which element should anchor the slide.",
      },
      {
        id: "step-3",
        step: 3,
        title: "Balance the Layout",
        description:
          "Arranges supporting elements around the focal one with proper white space.",
      },
      {
        id: "step-4",
        step: 4,
        title: "Reflow on Feedback",
        description:
          "Re-balances when the Director or you ask for a tighter or looser look.",
      },
    ],
  },
]

export const agentsNavigation = [
  { name: "Director", href: "/agents/director" },
  { name: "Researcher", href: "/agents/researcher" },
  { name: "Analyst", href: "/agents/analyst" },
  { name: "Content Generator", href: "/agents/content-generator" },
  { name: "Visualizer", href: "/agents/visualizer" },
  { name: "Theme Builder", href: "/agents/theme-builder" },
  { name: "Slide Composer", href: "/agents/slide-composer" },
]
