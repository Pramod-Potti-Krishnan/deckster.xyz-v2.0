// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the docs text names the agents the product has now. The articles (content/docs.ts) still told of four agents (Director, Scripter, Graphic Artist, Data Visualizer); the team is the eight of
// lib/marketing/homepage-v2-content.ts (AGENT_TEAM), content/agents.ts and the Help page: Director, Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, Element Generator.
// Each rule swaps one piece of an article's text (once, where it is found) when the flag is on; content/docs.ts itself is not touched, so with the flag off every article reads as before. Data only (one type import), so the test runs it as plain code.
// Old -> new: Scripter -> Content Generator; Graphic Artist -> Slide Composer (layout, balance, focus); Data Visualizer -> Visualizer; "four" / "4" agents -> "eight" / "8"; Researcher, Analyst, Theme Builder and Element Generator are new to the text.
// The words of the seven sections added to "Understanding AI Agents" are content/agents.ts's own (role = the agent's title; the first sentence of its description; its first four capabilities).
// The Free / Pro / Enterprise lines in those articles carry the new names and the count here and are then replaced by the real plans (Starter / Pro / Max) in content/studio-p2-docs-facts.ts, which is applied after these rules.
import type { StudioDocRule } from "@/lib/studio-p2-docs"

export const STUDIO_DOCS_AGENT_RULES: readonly StudioDocRule[] = [
  {
    doc: "getting-started/quick-start-guide",
    from: `Our four AI agents will collaborate to create your presentation:

- **Director**: Plans the structure and flow
- **Scripter**: Writes compelling content
- **Graphic Artist**: Designs layouts and visuals
- **Data Visualizer**: Creates charts and graphs`,
    to: `Our eight AI agents will collaborate to create your presentation:

- **Director**: Plans the structure and flow
- **Researcher**: Pulls facts from your data and the open web
- **Analyst**: Finds the insight inside the numbers
- **Content Generator**: Writes narrative, headlines, speaker notes
- **Visualizer**: Designs charts, diagrams, and infographics
- **Theme Builder**: Crafts and applies your custom theme
- **Slide Composer**: Conducts each slide — pacing, balance, focus
- **Element Generator**: Builds the atomic pieces every slide is made of`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `## The Four AI Agents`,
    to: `## The Eight AI Agents`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `### ✍️ Scripter Agent
**Role**: Content Writer and Copywriter

The Scripter creates all written content. This agent:
- Writes compelling headlines
- Crafts clear body content
- Creates speaker notes
- Ensures consistent tone and voice
- Optimizes for readability

**When Scripter Leads:**
- Headlines and titles
- Bullet points and descriptions
- Speaker notes
- Call-to-action text
- Narrative flow

### 🎨 Graphic Artist Agent
**Role**: Visual Designer and Layout Specialist

The Graphic Artist handles visual design. This agent:
- Selects layouts and templates
- Chooses color schemes
- Positions elements aesthetically
- Ensures visual hierarchy
- Creates cohesive design language

**When Graphic Artist Leads:**
- Layout selection
- Color palette
- Typography choices
- Visual balance
- Design consistency

### 📊 Data Visualizer Agent
**Role**: Chart and Graph Specialist

The Data Visualizer creates data representations. This agent:
- Converts data to visualizations
- Chooses appropriate chart types
- Ensures data clarity
- Creates infographics
- Optimizes for insight delivery

**When Data Visualizer Leads:**
- Charts and graphs
- Tables and matrices
- Infographics
- Data-driven slides
- Statistical visualizations`,
    to: `### 🔍 Researcher Agent
**Role**: The Investigator

The Researcher pulls facts from your uploaded files, your connected data sources, and the open web. This agent:
- Searches your files and connected sources
- Pulls public data on demand
- Surfaces source citations
- Flags conflicting numbers across sources

### 📈 Analyst Agent
**Role**: The Insight Finder

The Analyst looks at the numbers and tells you what they mean. This agent:
- Identifies trends, outliers, and inflection points
- Computes ratios, growth rates, and segment splits
- Drafts the headline insight per chart
- Flags weak data so you don't ship a soft slide

### ✍️ Content Generator Agent
**Role**: The Storyteller

The Content Generator writes the words. This agent:
- Drafts headlines, body, and per-slide speaker notes
- Adapts tone for board, sales, technical, or hybrid audiences
- Compresses or expands existing copy on request
- Keeps voice consistent across the whole deck

### 📊 Visualizer Agent
**Role**: The Designer

The Visualizer turns numbers and concepts into the right picture. This agent:
- Selects the most legible chart for the data
- Builds the 8 diagrams engineers and PMs actually need
- Generates any infographic from a description
- Re-renders any visual when you change the data

### 🎨 Theme Builder Agent
**Role**: The Stylist

The Theme Builder builds your custom theme — palette, typography, surface treatments — and applies it consistently across every slide and every visual on the canvas. This agent:
- Generates a custom theme from your brand or brief
- Applies palette, type, and spacing rules globally
- Keeps charts and diagrams on the theme's color scale
- Switches themes mid-deck without breaking layouts

### 🎼 Slide Composer Agent
**Role**: The Conductor

The Slide Composer owns each slide's pacing, balance, and focus. This agent:
- Balances density and white space slide by slide
- Picks the focal element and arranges around it
- Cuts elements that crowd the message
- Re-flows when you ask for a tighter or looser look

### 🧱 Element Generator Agent
**Role**: The Builder

The Element Generator builds the atoms every slide is made of — text boxes, metrics, tables, charts, images, icon-label rows, shapes, infographics, and diagrams. This agent:
- Generates 9 element types from a single brief
- Sizes and positions atoms on the canvas grid
- Re-renders elements when the theme changes
- Keeps spacing and alignment tight across elements`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `3. **Scripter** and **Graphic Artist** work together on each slide
4. **Data Visualizer** is called when data needs visualization`,
    to: `3. **Content Generator** and **Slide Composer** work together on each slide
4. **Visualizer** is called when data needs visualization`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `Use the Data Visualizer to create charts showing our quarterly growth`,
    to: `Use the Visualizer to create charts showing our quarterly growth`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `Have the Scripter and Graphic Artist work together to make slide 5 more impactful`,
    to: `Have the Content Generator and Slide Composer work together to make slide 5 more impactful`,
  },
  {
    doc: "getting-started/understanding-agents",
    from: `- **Free Tier**: Director + Scripter (2 agents)
- **Pro Tier**: All 4 agents with full collaboration`,
    to: `- **Free Tier**: Director + Content Generator (2 agents)
- **Pro Tier**: All 8 agents with full collaboration`,
  },
  {
    doc: "agent-reference/director-agent",
    from: `- **Scripter**: Write executive summary and conclusions
- **Data Visualizer**: Create charts for all metrics
- **Graphic Artist**: Design clean, professional layouts
- **Sequence**: Scripter → Data Visualizer → Graphic Artist per slide`,
    to: `- **Content Generator**: Write executive summary and conclusions
- **Visualizer**: Create charts for all metrics
- **Slide Composer**: Design clean, professional layouts
- **Sequence**: Content Generator → Visualizer → Slide Composer per slide`,
  },
  {
    doc: "agent-reference/director-agent",
    from: `Agent collaboration: All four agents needed`,
    to: `Agent collaboration: All eight agents needed`,
  },
  {
    doc: "agent-reference/director-agent",
    from: `- Works with Scripter only`,
    to: `- Works with Content Generator only`,
  },
  {
    doc: "agent-reference/director-agent",
    from: `- Coordinates all 4 agents`,
    to: `- Coordinates all 8 agents`,
  },
]
