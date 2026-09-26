/** Copy for marketing v3. Keep wording in sync with design-marketing-v3/*.html. */
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
      { slide: 1, tag: "01 · Title", title: "Two quarters of flat throughput" },
      { slide: 2, tag: "02 · Problem", title: "Solving the Coordination Crisis in Scaling" },
      { slide: 3, tag: "03", title: "Reversing the Efficiency Decay in Engineering" },
      { slide: 4, tag: "04 · Analysis", title: "Fixing Structural Friction to Restore Delivery" },
      { slide: 6, tag: "06", title: "Reducing Handoff Waste to Accelerate Flow" },
      { slide: 7, tag: "07", title: "How work moves through the organisation today" },
      { slide: 8, tag: "08", title: "Aligning Decision Rights with Project Context" },
      { slide: 9, tag: "09 · Section", title: "Move the decision to the team that" },
    ],
    exchanges: [
      {
        altitude: "deck",
        who: "You → Director",
        request: "“Build a 12-slide operating-model review from my Q3 board pack.”",
        response:
          "Director · plan drafted — 3 sections, 12 slides. Researcher on your uploads, Visualizer on the throughput data. Waiting for your approval.",
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
      foot: "Delivery stalled while headcount kept growing · Analysis",
      number: "5 / 12",
    },
  },
} as const

export function showcaseAlt(slide: number, title: string) {
  return `Slide ${slide} of the showcase deck: ${title}`
}
