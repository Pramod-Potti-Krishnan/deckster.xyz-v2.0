import { AGENT_TEAM, type AgentId } from "@/lib/marketing/homepage-v2-content"

/** Copy for marketing v3. Keep wording in sync with design-marketing-v3/*.html. */
const agentColor = (id: AgentId) => AGENT_TEAM.find((agent) => agent.id === id)!.color

export const V3_CONTENT = {
  metadata: {
    title: "Deckster — Your knowledge. Your decks. Your voice.",
    description:
      "Deckster turns what you already have — documents, past presentations, your brand — into decks built by a team of AI specialists you direct. Then the deck presents itself.",
  },
  nav: [
    { label: "Build", href: "/v3#zoom" },
    { label: "Bring", href: "/templates" },
    { label: "Present", href: "/learn" },
    { label: "Experts", href: "/agents" },
    { label: "Pricing", href: "/pricing" },
  ],
  header: {
    home: "Deckster home",
    wordmark: "deckster",
    signIn: "Sign in",
    build: "Build a deck",
  },
  footer: {
    copyright: "© 2026 deckster · Your knowledge. Your decks. Your voice.",
    links: [
      { label: "Bring", href: "/templates" },
      { label: "Present", href: "/learn" },
      { label: "Experts", href: "/agents" },
      { label: "Pricing", href: "/pricing" },
      { label: "Learn", href: "/learn" },
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
  start: {
    label: "Start",
    eyebrow: "AI presentation studio · you stay in the loop",
    title: ["Your knowledge.", "Your decks.", "Your voice."],
    lede:
      "Deckster turns what you already have — documents, past presentations, your brand — into decks built by a team of AI specialists. You direct every step. When it's done, the deck can present itself, in a voice you choose.",
    build: "Build a deck",
    drop: "Drop a deck, get a template",
    trust: [
      "PPTX & PDF in",
      "PPTX & PDF out, no watermark",
      "Charts, diagrams, infographics built in",
      "Every step needs your yes",
    ],
    cursor: "you",
    request: "make the chart a waterfall — use our Q3 numbers",
    agent: "Element Composer · ",
    agentBold: "waterfall rendered",
    agentSource: " · source: Q3 board pack, p.7",
    cue: "See how it works",
  },
  zoom: {
    label: "Precision",
    eyebrow: "Precision",
    title: "Control it at every altitude.",
    altitudes: ["Deck", "Slide", "Element"],
    foot: "Scroll to zoom in · deck → slide → element",
    tiles: [
      { slide: 1, tag: "01 · Title", title: "A new operating model moves" },
      { slide: 2, tag: "02 · How it works", title: "Driving Business Agility through a Five-Step Model" },
      { slide: 3, tag: "03", title: "Managing the Ownership Chain for Product Changes" },
      { slide: 4, tag: "04 · Analysis", title: "Strengthening the Six Capabilities of Modern Delivery" },
      { slide: 6, tag: "06", title: "Optimizing Decision Forums and Governance Cadence" },
      { slide: 7, tag: "07", title: "Teams Climb Five Levels of Delivery Maturity" },
      { slide: 8, tag: "08", title: "Where each decision should live" },
      { slide: 9, tag: "16 · Closing", title: "Next Wave Lowers Later Costs" },
    ],
    exchanges: [
      {
        altitude: "deck",
        who: "You → Director",
        request: "“Build a 16-slide operating-model review from my Q3 board pack.”",
        response:
          "Director · plan drafted — 3 sections, 16 slides. Researcher on your uploads, Visualizer on the throughput data. Waiting for your approval.",
        action: "Approve plan",
        secondary: "Edit plan",
      },
      {
        altitude: "slide",
        who: "You → Slide Composer",
        request: "“Add a slide after 4 that compares decision latency by team.”",
        response:
          "Slide Composer · researched from your board pack, composed in the deck's theme, inserted at 5. Neighbours read for continuity.",
        action: "Keep it",
        secondary: "Refine",
      },
      {
        altitude: "element",
        who: "You → Element Composer",
        request: "“Make this chart a waterfall and cite the source.”",
        response:
          "Element Composer · waterfall rendered · 6 steps · source stamped: Q3 board pack, slide 7 — yours.",
        action: "Regenerate",
        secondary: "Try another",
      },
    ],
    slide: {
      eyebrow: "ANALYSIS",
      title: "Decision latency by ",
      titleAccent: "team",
      elements: {
        title: "Title",
        metrics: "Metrics ×3",
        chart: "Chart",
        text: "Text ×2",
        takeaway: "Takeaway",
      },
      metrics: [
        { value: "11 days", label: "Median decision" },
        { value: "48 h", label: "Target rule" },
        { value: "−23%", label: "Throughput gap" },
      ],
      chartTitle: "Days from request to decision, by team",
      waterfallTitle: "Where the 11 days go",
      chartSub: "Q3 · six delivery teams · your board pack",
      bars: [
        { height: 70, base: 0, waterfallHeight: 36.4, value: "14", waterfallValue: "+4.0", label: "Platform", waterfallLabel: "Approval wait" },
        { height: 55, base: 36.4, waterfallHeight: 27.3, value: "11", waterfallValue: "+3.0", label: "Payments", waterfallLabel: "Handoffs" },
        { height: 85, base: 63.7, waterfallHeight: 18.2, value: "17", waterfallValue: "+2.0", label: "Risk", waterfallLabel: "Rework" },
        { height: 45, base: 81.9, waterfallHeight: 13.6, value: "9", waterfallValue: "+1.5", label: "Data", waterfallLabel: "Unsequenced starts" },
        { height: 40, base: 95.5, waterfallHeight: 4.5, value: "8", waterfallValue: "+0.5", label: "Mobile", waterfallLabel: "Other" },
        { height: 60, base: 0, waterfallHeight: 100, value: "12", waterfallValue: "11.0", label: "Ops", waterfallLabel: "Total" },
      ],
      sourceLabel: "SOURCE",
      source: "Q3 board pack · slide 7 · yours",
      sides: [
        {
          title: "What we saw",
          body: "Approvals wait a median of four days at domain level. Six in ten stalls were waiting on a decision already taken elsewhere.",
        },
        {
          title: "What to do",
          body: "Move decision rights to the lowest safe level. Anything stuck longer than 48 hours escalates one rung — automatically.",
        },
      ],
      takeaway: "Decision latency — not capacity — is the binding constraint on delivery.",
      foot: "Fixing delivery without adding headcount",
      number: "5 / 16",
    },
  },
  bring: {
    label: "Bring",
    eyebrow: "Bring what you have",
    title: "Start from what you already have.",
    lede: "Nobody starts from zero. Your past decks, your documents and your brand are the raw material — Deckster turns them into templates, knowledge and themes you reuse on every deck after this one.",
    inputs: [
      { kind: "PPTX", name: "Q3 board pack.pptx", detail: "16 slides · presented in June" },
      { kind: "PDF", name: "Market study.pdf", detail: "48 pages · analyst report" },
      { kind: "BRAND", name: "Brand guide.pdf", detail: "palette · type · logo rules" },
    ],
    template: { title: "Template · Board pack", detail: "roles, ratios & theme — fill with new content", alt: "Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" },
    knowledgeAsset: { title: "Knowledge · 1,284 facts", detail: "96 sources, all yours, all citable" },
    themeAsset: { title: "Theme · Northbank teal", detail: "palette + type + hero slides, as one bundle" },
    notes: [
      { title: "Decks become templates", body: "Drop a PPTX or PDF. It's deconstructed into roles, ratios and a theme — a template you fill with new content, in exactly your layout." },
      { title: "Documents become knowledge", body: "Facts pulled from your files are kept, linked and cited in the decks that follow. Your numbers, with your provenance — not the web's." },
      { title: "Brands become themes", body: "Palette, type and hero slides travel together as a bundle. Switch a whole deck to it — even after it's built." },
    ],
  },
  knowledge: {
    label: "Knowledge",
    eyebrow: "Knowledge graph",
    title: "Every deck you make teaches the next one.",
    lede: "Uploads, research passes and finished decks become a graph that is yours. When the Researcher runs, it checks your graph first — and cites your own documents before it cites the web.",
    legend: { research: "from research", documents: "from your documents" },
    stats: { decks: "decks", facts: "facts", sources: "sources" },
    citation: {
      web: { label: "From the web", value: "Median approval latency in mid-size banks: 6.2 days", source: "Source: industry survey, 2025 · estimated" },
      graph: { label: "From your graph", value: "Median approval latency at Northbank: 11 days", sourceLead: "Source: ", sourceStrong: "Q3 board pack, slide 7 · yours" },
    },
    checks: ["Yours alone", "Purge anytime", "Export anytime", "Never named to your audience"],
  },
  experts: {
    label: "Experts",
    eyebrow: "Human in the loop",
    title: "You direct. Specialists build.",
    lede: "Eight agents, each with one craft. The Director runs them; you run the Director. Nothing ships without your yes — and you can pause, steer or take over at any moment.",
    you: { initials: "PK", name: "you", role: "executive producer · the human in the loop" },
    director: { name: "Director", role: "· plans, routes, checks coherence — reports to you" },
    agents: [
      { id: "researcher", name: "Researcher", role: "your files, then the web", color: agentColor("researcher") },
      { id: "analyst", name: "Analyst", role: "the insight in the numbers", color: agentColor("analyst") },
      { id: "content_generator", name: "Content", role: "headlines, body, notes", color: agentColor("content_generator") },
      { id: "visualizer", name: "Visualizer", role: "charts, diagrams, infographics", color: agentColor("visualizer") },
      { id: "theme_builder", name: "Theme Builder", role: "palette, type, heroes", color: agentColor("theme_builder") },
      { id: "slide_composer", name: "Slide Composer", role: "pacing, balance, focus", color: agentColor("slide_composer") },
      { id: "element_generator", name: "Element Gen.", role: "the atoms of each slide", color: agentColor("element_generator") },
    ],
    gates: [
      { number: "1", name: "Plan", action: "→ your yes" },
      { number: "2", name: "Strawman", action: "→ your yes" },
      { number: "3", name: "Every slide", action: "→ your edit" },
    ],
    loop: {
      bar: "Chain of thought · slide 5 of 16",
      live: "Live · chain of thought",
      paused: "Paused by you",
      pause: "Pause",
      resume: "Resume",
      steer: "Steer",
      placeholder: "Use our numbers, not industry averages",
      inputLabel: "Steer the team",
      pauseLine: { who: "you", text: "Pause. Let me look at slide 5 first." },
      resumeLine: { who: "director", text: "Resuming — picking up at slide 6." },
      steerReplies: [
        { who: "director", text: "Understood — re-routing to your uploads, web figures demoted to \"estimated\"." },
        { who: "researcher", text: "Re-reading board pack slides 7–9 for the latency series" },
      ],
      script: [
        { kind: "k", who: "director", text: "Plan approved by you · 16 slides · routing work" },
        { kind: "a", who: "researcher", text: "Reading your board pack (16 slides) before the web" },
        { kind: "a", who: "researcher", text: "Found decision-latency figures on slide 7 — keeping provenance" },
        { kind: "a", who: "analyst", text: "Median 11 days vs 48h target · 23% throughput gap" },
        { kind: "a", who: "theme", text: "Applying Northbank teal bundle · heroes H1/H2/H3 locked" },
        { kind: "a", who: "content", text: "Drafting slide 5 headline: \"Decision latency by team\"" },
        { kind: "a", who: "visualizer", text: "Bar chart · 6 teams · source stamped from your upload" },
        { kind: "a", who: "composer", text: "Slide 5 balanced · focal element = chart · white space ok" },
        { kind: "a", who: "director", text: "Slide 5 ready for your review" },
        { kind: "a", who: "researcher", text: "Web pass: 3 external benchmarks, marked estimated" },
        { kind: "a", who: "analyst", text: "Rework accounts for 2.0 of the 11 days" },
        { kind: "a", who: "composer", text: "Slide 6 · two-column · table + takeaway band" },
      ],
    },
  },
} as const

/** Public image names are design slots; some contain a different source-deck slide. */
export const SHOWCASE_SLOTS = {
  1: { slide: 1, title: "A new operating model moves" },
  2: { slide: 2, title: "Driving Business Agility through a Five-Step Model" },
  3: { slide: 3, title: "Managing the Ownership Chain for Product Changes" },
  4: { slide: 11, title: "Strengthening the Six Capabilities of Modern Delivery" },
  5: { slide: 5, title: "A Weekly Loop to Replace the Board" },
  6: { slide: 6, title: "Optimizing Decision Forums and Governance Cadence" },
  7: { slide: 7, title: "Teams Climb Five Levels of Delivery Maturity" },
  8: { slide: 9, title: "Where each decision should live" },
  9: { slide: 16, title: "Next Wave Lowers Later Costs" },
  10: { slide: 10, title: "Four Core Pillars of the Operating Model" },
  11: { slide: 12, title: "The rollout runs from June 2026 to June 2027" },
  12: { slide: 14, title: "Hiring Worked: Eleven Engineers Joined Last Quarter" },
} as const

export function showcaseAlt(slot: number, fallbackTitle?: string) {
  const source = SHOWCASE_SLOTS[slot as keyof typeof SHOWCASE_SLOTS]
  return `Slide ${source?.slide ?? slot} of the showcase deck: ${source?.title ?? fallbackTitle ?? "Untitled slide"}`
}
