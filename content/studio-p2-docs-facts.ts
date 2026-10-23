// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS), content pass 2 (PROGRAM-1, 22 Oct): the docs text says what the product does today. Rules in the same shape as content/studio-p2-docs-agents.ts, applied after them (so a `from` below reads
// the text the agent rules leave); content/docs.ts itself is not edited, so with the flag off every article reads as before. Data only (one type import), so the test runs it as plain code.
// Plans: the plans are Starter / Pro / Max (lib/marketing/homepage-v2-pricing.ts, PRICING_TIERS), not Free / Pro / Enterprise. Only what that list, the Help page and the pricing page's tier table say is stated:
//   Starter = Director, Content Generator, Visualizer, Slide Composer, Theme Builder; Pro = Starter plus the Researcher (live data from the open web, your own files as source material) and the Analyst;
//   Max = Pro plus the Knowledge Graph and a priority generation queue; PowerPoint and PDF export, no watermark, on every plan.
// Where the code does not say which plan has a feature (analytics, link tracking, team sharing, real-time collaboration, style transfer, AI images, export counts), the plan tag is taken out and nothing is put in its place.
// Sign-in: the product signs in with Google (app/auth/signup and app/auth/signin: "Sign up with Google" / "Continue with Google", lib/auth-options.ts has the Google provider only); there is no password and no verification email.
import type { StudioDocRule } from "@/lib/studio-p2-docs"

export const STUDIO_DOCS_FACT_RULES: readonly StudioDocRule[] = [
  {
    doc: "getting-started/quick-start-guide",
    from: `2. Enter your email and create a password
3. Verify your email address`,
    to: `2. Choose "Sign up with Google" and pick your Google account`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `## Free vs Pro Agent Access

- **Free Tier**: Director + Content Generator (2 agents)
- **Pro Tier**: All 8 agents with full collaboration
- **Enterprise**: All agents + priority processing`,
    to: `## Agent Access by Plan

- **Starter**: Director, Content Generator, Visualizer, Slide Composer, Theme Builder
- **Pro**: Everything in Starter, plus the Researcher (live data from the open web, and your own files as source material) and the Analyst (finds the story in your numbers)
- **Max**: Everything in Pro, plus the Knowledge Graph (the agents learn your domain across decks) and a priority generation queue`,
  },
  {
    doc: "agent-reference/director-agent",
    from: `## Free vs. Pro Director

### Free Tier
- Basic structure planning
- Essential decision making
- Works with Content Generator only
- Standard templates

### Pro Tier
- Advanced strategic planning
- Complex multi-section presentations
- Coordinates all 8 agents
- Custom structures
- Industry-specific templates`,
    to: `## The Director on Every Plan

The Director is part of Starter, Pro and Max. Pro adds the Researcher and the Analyst to the team it works with, and Max adds the Knowledge Graph and a priority generation queue.`,
  },
  {
    doc: "builder-guide/slide-editing",
    from: `   - AI-generate (Pro)`,
    to: `   - AI-generate`,
  },
  {
    doc: "builder-guide/slide-editing",
    from: `## Collaboration Features (Pro/Enterprise)`,
    to: `## Collaboration Features`,
  },
  {
    doc: "builder-guide/slide-editing",
    from: `### Style Transfer (Pro)`,
    to: `### Style Transfer`,
  },
  {
    doc: "builder-guide/exports",
    from: `- Analytics tracking (Pro)`,
    to: `- Analytics tracking`,
  },
  {
    doc: "builder-guide/exports",
    from: `- Track who viewed (Pro)`,
    to: `- Track who viewed`,
  },
  {
    doc: "builder-guide/exports",
    from: `### Team Sharing (Pro/Enterprise)`,
    to: `### Team Sharing`,
  },
  {
    doc: "builder-guide/exports",
    from: `## Download Limits

### Free Tier
- 3 exports per presentation
- Standard quality only
- PowerPoint and PDF only

### Pro Tier
- Unlimited exports
- All formats and quality levels
- Priority export queue

### Enterprise Tier
- Unlimited exports
- Bulk export tools
- API access`,
    to: `## Downloads on Every Plan

Starter, Pro and Max can all download PowerPoint and PDF, with no watermark.`,
  },
  {
    doc: "builder-guide/exports",
    from: `### Real-Time Collaboration (Pro)`,
    to: `### Real-Time Collaboration`,
  },
  {
    doc: "builder-guide/exports",
    from: `## Analytics (Pro)`,
    to: `## Analytics`,
  },
]
