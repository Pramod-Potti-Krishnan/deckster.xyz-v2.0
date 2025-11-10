import { DocSection } from '@/types/docs';

export const docSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        id: 'quick-start',
        title: 'Quick Start Guide',
        slug: 'quick-start-guide',
        category: 'getting-started',
        content: `# Quick Start Guide

Welcome to deckster! This guide will help you create your first AI-powered presentation in just 5 minutes.

## Step 1: Sign Up

1. Click "Get Started" on the homepage
2. Enter your email and create a password
3. Verify your email address

## Step 2: Start a New Presentation

1. From your dashboard, click "New Presentation"
2. You'll see the builder interface with two main areas:
   - **Left**: Chat interface to communicate with AI agents
   - **Right**: Live preview of your presentation

## Step 3: Describe Your Presentation

In the chat interface, describe what presentation you want to create. Be specific about:

- **Topic**: What is your presentation about?
- **Audience**: Who are you presenting to?
- **Purpose**: What do you want to achieve?
- **Style**: Professional, creative, educational, etc.

### Example Prompt:
\`\`\`
Create a 10-slide pitch deck for a SaaS startup targeting small businesses.
We're raising seed funding and need to cover problem, solution, market size,
business model, and team. Use a professional, modern style.
\`\`\`

## Step 4: Watch the AI Agents Work

Our four AI agents will collaborate to create your presentation:

- **Director**: Plans the structure and flow
- **Scripter**: Writes compelling content
- **Graphic Artist**: Designs layouts and visuals
- **Data Visualizer**: Creates charts and graphs

You'll see their progress in real-time!

## Step 5: Review and Edit

Once generated:
1. Review each slide in the preview pane
2. Click any element to edit directly
3. Chat with agents to request changes
4. Iterate until perfect

## Step 6: Export and Share

When ready:
1. Click "Export" in the top right
2. Choose your format (PDF, PowerPoint, Google Slides)
3. Download or share directly

## Next Steps

- Explore our [template gallery](/templates)
- Learn about [each AI agent](/docs/agent-reference)
- Read [best practices](/docs/features) for better results

Need help? Visit our [Help Center](/help) or contact support.
`,
      },
      {
        id: 'your-first-presentation',
        title: 'Your First Presentation',
        slug: 'your-first-presentation',
        category: 'getting-started',
        content: `# Creating Your First Presentation

Let's walk through creating a presentation step-by-step with detailed tips for success.

## Choosing Your Starting Point

You have three options:

### 1. Start from Scratch
Best for: Unique presentations with specific requirements

Click "New Presentation" and describe your needs in detail to the AI agents.

### 2. Use a Template
Best for: Common presentation types (pitch decks, reports, etc.)

1. Browse our [template gallery](/templates)
2. Click "Use Template" on your preferred option
3. Customize the content to your needs

### 3. Import Existing Content
Best for: Updating or redesigning existing presentations

Upload your current slides and let our agents redesign them with AI.

## Writing Effective Prompts

The quality of your presentation depends on how well you communicate with the AI agents.

### Good Prompt Structure:

1. **Context**: What type of presentation?
2. **Audience**: Who will see it?
3. **Goals**: What should it achieve?
4. **Constraints**: Slide count, time limit, style preferences

### Examples:

**Bad Prompt:**
\`\`\`
Make a sales presentation
\`\`\`

**Good Prompt:**
\`\`\`
Create a 15-slide sales presentation for our B2B SaaS product targeting
enterprise IT managers. Focus on ROI, security, and integration capabilities.
Use a professional blue color scheme with data-driven charts showing cost savings.
Include customer testimonials and a clear pricing slide.
\`\`\`

## Understanding the Interface

### Chat Panel (Left)
- **Input**: Type messages to the AI agents
- **History**: See conversation and agent responses
- **Attachments**: Upload documents for context

### Preview Panel (Right)
- **Slides**: Live preview of your presentation
- **Navigation**: Click thumbnails to jump between slides
- **Editing**: Click any element to edit inline

## Iterating on Your Presentation

Don't expect perfection on the first try. Use these techniques:

### Request Specific Changes
\`\`\`
Make slide 3 more visual with a large chart showing growth trends
\`\`\`

### Add New Slides
\`\`\`
Add a slide about our competitive advantages after the market analysis slide
\`\`\`

### Refine Content
\`\`\`
Make the executive summary more concise and punchy
\`\`\`

### Adjust Style
\`\`\`
Change the color scheme to match our brand colors: #4F46E5 (primary) and #06B6D4 (secondary)
\`\`\`

## Common First-Time Mistakes

1. **Too vague**: "Create a presentation about marketing"
   - **Fix**: Add specific details about topic, audience, and goals

2. **Too many slides**: Asking for 50+ slides
   - **Fix**: Start with 10-15 slides, expand if needed

3. **No iteration**: Accepting first draft
   - **Fix**: Review, refine, and iterate for better results

4. **Ignoring agents**: Not reading agent explanations
   - **Fix**: Agents explain their decisions - use this to guide improvements

## Tips for Success

- **Be conversational**: Talk to the agents like colleagues
- **Provide examples**: Share similar presentations you like
- **Use attachments**: Upload company info, data, or brand guidelines
- **Iterate incrementally**: Make changes one at a time
- **Save versions**: Export drafts as you go

## What Happens Next?

After creating your first presentation:
1. ✅ Congratulations modal will appear
2. 📧 You'll receive tips via email
3. 🎯 Tutorial checklist will guide you through features
4. 💡 You'll unlock pro tips and shortcuts

Ready to get started? [Create your first presentation →](/builder)
`,
      },
      {
        id: 'understanding-agents',
        title: 'Understanding AI Agents',
        slug: 'understanding-agents',
        category: 'getting-started',
        content: `# Understanding Your AI Team

deckster uses a multi-agent AI system where specialized agents collaborate to create your presentation. Think of them as your virtual creative team.

## The Four AI Agents

### 🎯 Director Agent
**Role**: Orchestrator and Strategist

The Director is like your creative director or project manager. This agent:
- Analyzes your requirements
- Plans the presentation structure
- Decides which agents to involve
- Ensures coherence and flow
- Manages the overall creation process

**When Director Leads:**
- Overall structure and flow
- Slide count and organization
- Topic hierarchy
- Transition logic

### ✍️ Scripter Agent
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
- Statistical visualizations

## How Agents Collaborate

Agents don't work in isolation - they collaborate:

1. **Director** receives your request and creates a plan
2. **Director** activates relevant agents based on needs
3. **Scripter** and **Graphic Artist** work together on each slide
4. **Data Visualizer** is called when data needs visualization
5. **Director** reviews and ensures coherence
6. Agents iterate based on your feedback

## Agent Transparency: Chain of Thought

Unlike black-box AI, deckster shows you **how** agents think:

- See agent reasoning in real-time
- Understand why decisions were made
- Guide agents with informed feedback
- Trust the process with transparency

## Controlling Agent Behavior

You can influence which agents are involved:

### Activate Specific Agents
\`\`\`
Use the Data Visualizer to create charts showing our quarterly growth
\`\`\`

### Request Agent Collaboration
\`\`\`
Have the Scripter and Graphic Artist work together to make slide 5 more impactful
\`\`\`

### Override Agent Decisions
\`\`\`
Director, reorganize the slides to put the problem before the solution
\`\`\`

## Free vs Pro Agent Access

- **Free Tier**: Director + Scripter (2 agents)
- **Pro Tier**: All 4 agents with full collaboration
- **Enterprise**: All agents + priority processing

## Learn More

- See [detailed agent capabilities](/docs/agent-reference)
- Read about [agent best practices](/docs/features)
- Watch [agent collaboration demos](/resources)

Your AI team is ready to work! [Start creating →](/builder)
`,
      },
    ],
  },
  {
    id: 'builder-guide',
    title: 'Builder Guide',
    items: [
      {
        id: 'chat-interface',
        title: 'Using the Chat Interface',
        slug: 'chat-interface',
        category: 'builder-guide',
        content: `# Using the Chat Interface

The chat interface is your primary way to communicate with AI agents.

## Chat Panel Overview

Located on the left side of the builder, the chat panel includes:

- **Input field**: Where you type messages
- **Send button**: Submit your message (or press Enter)
- **Conversation history**: See all messages and responses
- **Agent indicators**: Know which agent is responding
- **Attachment button**: Upload files for context

## Message Types

### Initial Request
Your first message sets the context for the entire presentation.

**Example:**
\`\`\`
Create a 12-slide investor pitch for our AI-powered analytics platform
\`\`\`

### Refinement Requests
Ask agents to modify specific aspects.

**Examples:**
\`\`\`
Make the executive summary more concise
Add more data visualizations to slide 4
Change the color scheme to warmer tones
\`\`\`

### Questions
Ask agents for clarification or suggestions.

**Examples:**
\`\`\`
What chart type would work best for this data?
Should I add a team slide before or after traction?
\`\`\`

### Commands
Direct agents to take specific actions.

**Examples:**
\`\`\`
Delete slide 7
Duplicate slide 3 and modify it for a different audience
Export as PDF
\`\`\`

## Agent Responses

Agents respond with:
- **Text explanations**: What they're doing and why
- **Progress updates**: Real-time status
- **Suggestions**: Ideas for improvement
- **Questions**: When they need clarification

## Attachments

Upload files to provide context:

### Supported File Types
- Documents (PDF, DOCX)
- Data (CSV, XLSX)
- Images (PNG, JPG)
- Brand guidelines
- Previous presentations

### How to Use Attachments
1. Click the attachment icon
2. Select your file
3. Reference it in your message

**Example:**
\`\`\`
Use the data from quarterly_results.csv to create visualizations
\`\`\`

## Conversation Best Practices

### Be Specific
❌ "Make it better"
✅ "Add more whitespace and use a larger font for headlines"

### One Change at a Time
❌ "Change colors, add charts, rewrite everything"
✅ "Let's update the color scheme first, then we'll work on charts"

### Use Context
✅ "Based on the market analysis slide, create a competitive positioning slide"

### Iterate Gradually
Start broad, refine iteratively:
1. "Create a sales presentation"
2. "Focus more on ROI and less on features"
3. "Make slide 5's ROI chart more prominent"

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line
- **↑/↓**: Navigate message history
- **Cmd/Ctrl+K**: Focus chat input
- **Cmd/Ctrl+U**: Upload attachment

## Chat History

Your conversation is saved automatically:
- Review past exchanges
- See agent reasoning
- Track changes over time
- Resume where you left off

## Tips for Effective Communication

1. **Start with context**: Describe your goals clearly
2. **Be conversational**: Agents understand natural language
3. **Provide feedback**: Tell agents what works and what doesn't
4. **Ask questions**: Agents can explain their reasoning
5. **Use examples**: Share similar presentations you like

## Troubleshooting

### Agent Not Responding
- Check your internet connection
- Refresh the page
- Contact support if issue persists

### Unexpected Results
- Be more specific in your request
- Review agent's reasoning
- Iterate with clarifying instructions

### Need to Start Over
- Click "New Conversation"
- Previous chat will be saved
- Start fresh with new context

Ready to chat with your AI team? [Open builder →](/builder)
`,
      },
      {
        id: 'slide-editing',
        title: 'Editing Slides',
        slug: 'slide-editing',
        category: 'builder-guide',
        content: `# Editing Slides

Learn how to directly edit and customize your AI-generated slides.

## Edit Modes

### 1. Chat-Based Editing (Recommended)
Ask agents to make changes through the chat interface.

**Advantages:**
- Agents maintain design consistency
- Multiple elements updated cohesively
- Explains reasoning for changes

**Example:**
\`\`\`
Make slide 3's headline more attention-grabbing and add a supporting statistic
\`\`\`

### 2. Direct Inline Editing
Click any element to edit it directly.

**Advantages:**
- Immediate changes
- Full control
- Quick fixes

**How to:**
1. Click any text, image, or element
2. Make your changes
3. Click outside to save

## Editable Elements

### Text Elements
- **Headlines**: Click to edit text, size, style
- **Body content**: Edit bullets, paragraphs
- **Labels**: Chart labels, captions, notes

### Visual Elements
- **Images**: Replace, resize, reposition
- **Shapes**: Color, size, position
- **Icons**: Change icon, color, size

### Data Elements
- **Charts**: Edit data, type, colors
- **Tables**: Edit cells, styling
- **Infographics**: Modify values, layout

### Layout Elements
- **Backgrounds**: Color, gradient, image
- **Spacing**: Margins, padding
- **Alignment**: Position elements

## Editing Workflow

### Making Text Changes

1. **Click the element** you want to edit
2. **Type your changes** directly
3. **Format** using toolbar options:
   - Bold, italic, underline
   - Font size and color
   - Alignment
   - Bullet points
4. **Click outside** to save

### Replacing Images

1. **Click the image**
2. **Select "Replace"** from the toolbar
3. **Choose source**:
   - Upload from computer
   - Select from library
   - Use URL
   - AI-generate (Pro)
4. **Adjust** size and position

### Modifying Charts

1. **Click the chart**
2. **Select "Edit Data"**
3. **Update values** in the editor
4. **Change chart type** if needed
5. **Customize colors** and labels
6. **Save changes**

## Layout Adjustments

### Moving Elements
- **Drag** elements to reposition
- **Arrow keys** for fine-tuning
- **Alignment guides** appear automatically

### Resizing Elements
- **Drag corners** to resize proportionally
- **Drag edges** to resize in one direction
- **Enter exact dimensions** in properties

### Layering Elements
- **Bring forward/backward**: Right-click menu
- **Send to front/back**: Toolbar options
- **Align elements**: Use alignment tools

## Undo/Redo

- **Cmd/Ctrl+Z**: Undo last change
- **Cmd/Ctrl+Shift+Z**: Redo
- **History panel**: See all changes

## Version Control

Save presentation versions:
1. Click "Save Version"
2. Add description
3. Name the version
4. Restore anytime from "Versions"

## Collaboration Features (Pro/Enterprise)

### Real-Time Editing
- Multiple team members can edit simultaneously
- See others' cursors and selections
- Changes sync in real-time

### Comments
- Add comments to specific elements
- @mention team members
- Mark as resolved

### Suggestions
- Propose changes without editing
- Accept or reject suggestions
- Track change history

## Best Practices

### Use Chat for Complex Changes
✅ "Redesign slide 4 to emphasize the ROI data with a larger chart"
Rather than manually moving 10 elements

### Direct Edit for Quick Fixes
✅ Click and fix typos immediately
Rather than asking agents to fix spelling

### Maintain Consistency
- Use existing colors and fonts
- Follow established hierarchy
- Keep spacing uniform

### Preview Changes
- Review in presentation mode
- Check on different screen sizes
- Test animations and transitions

## Keyboard Shortcuts

### Selection
- **Cmd/Ctrl+A**: Select all on slide
- **Shift+Click**: Multi-select
- **Tab**: Select next element

### Editing
- **Delete/Backspace**: Remove selected
- **Cmd/Ctrl+C**: Copy
- **Cmd/Ctrl+V**: Paste
- **Cmd/Ctrl+D**: Duplicate

### Navigation
- **←/→**: Previous/next slide
- **Home/End**: First/last slide
- **Cmd/Ctrl+[number]**: Jump to slide

## Advanced Features

### Style Transfer (Pro)
Apply design from one slide to others:
1. Select source slide
2. Click "Copy Style"
3. Select target slides
4. Click "Apply Style"

### Batch Editing
Edit multiple slides at once:
1. Select slides (Shift+Click)
2. Make changes in properties panel
3. Apply to all selected

### Custom Templates
Save your edited slides as templates:
1. Create your design
2. Click "Save as Template"
3. Use in future presentations

Need help with editing? [Contact support →](/help)
`,
      },
      {
        id: 'exports',
        title: 'Exporting & Sharing',
        slug: 'exports',
        category: 'builder-guide',
        content: `# Exporting & Sharing Your Presentations

Export your presentations in multiple formats and share them with others.

## Export Formats

### PowerPoint (.pptx)
**Best for:** Editing in Microsoft PowerPoint

**Features:**
- Fully editable slides
- Preserves animations
- Includes speaker notes
- Maintains layouts

**How to export:**
1. Click "Export" → "PowerPoint"
2. Choose quality settings
3. Download .pptx file

### PDF Document
**Best for:** Sharing, printing, archiving

**Features:**
- Universal compatibility
- Print-ready
- Locked formatting
- Smaller file size

**Options:**
- **Standard**: Regular quality, smaller size
- **High Resolution**: Print quality, larger size
- **With Notes**: Includes speaker notes

**How to export:**
1. Click "Export" → "PDF"
2. Select quality option
3. Download PDF file

### Google Slides
**Best for:** Cloud collaboration, Google Workspace

**Features:**
- Direct to Google Drive
- Real-time collaboration
- Access anywhere
- Auto-save

**How to export:**
1. Click "Export" → "Google Slides"
2. Connect Google account (if needed)
3. Select Drive location
4. Open in Google Slides

### Images (PNG/JPEG)
**Best for:** Social media, websites, individual slides

**Features:**
- Per-slide images
- Custom dimensions
- High resolution
- Transparent backgrounds (PNG)

**How to export:**
1. Click "Export" → "Images"
2. Select format (PNG or JPEG)
3. Choose slides (all or selection)
4. Set resolution
5. Download zip file

### Web Link (Hosted)
**Best for:** Online sharing, embedding

**Features:**
- Shareable URL
- No download required
- View-only mode
- Analytics tracking (Pro)

**How to share:**
1. Click "Share" → "Create Link"
2. Set permissions (public/private)
3. Copy URL
4. Share link

### Embed Code
**Best for:** Embedding on websites

**Features:**
- Responsive iframe
- Customizable size
- Auto-play options
- Interactive or static

**How to embed:**
1. Click "Share" → "Embed"
2. Customize options
3. Copy embed code
4. Paste in website HTML

## Export Settings

### Quality Options

**Draft**: Fast export, lower quality
- File size: Small
- Export time: < 10s
- Use case: Quick previews

**Standard**: Balanced quality and size
- File size: Medium
- Export time: 10-30s
- Use case: Most presentations

**High Quality**: Maximum quality
- File size: Large
- Export time: 30s+
- Use case: Print, large displays

### Slide Selection

Export options:
- **All slides**: Complete presentation
- **Current slide**: Just one slide
- **Slide range**: Slides 3-7, for example
- **Selected slides**: Custom selection

### Additional Options

- **Include speaker notes**: Add notes pages
- **Include animations**: Preserve transitions (PowerPoint only)
- **Optimize for web**: Smaller file sizes
- **Password protect**: Add password to PDF

## Sharing Options

### Public Link
Anyone with the link can view:
- No login required
- Can be shared anywhere
- Can be revoked anytime

### Private Link
Requires login to view:
- Email-based access
- Invite specific people
- Track who viewed (Pro)

### Team Sharing (Pro/Enterprise)
Share within your organization:
- Organization members only
- Permission levels (view/edit)
- Collaboration features

## Download Limits

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
- API access

## Presentation Mode

Present directly from deckster:
1. Click "Present"
2. Choose mode:
   - **Full screen**: Standard presentation
   - **Presenter view**: See notes and next slide
   - **Audience view**: Share URL for live viewing
3. Use keyboard or remote to navigate

### Presenter Controls
- **←/→**: Navigate slides
- **B**: Black screen
- **W**: White screen
- **Esc**: Exit presentation
- **Cmd/Ctrl+P**: Print notes

## Collaboration & Version Control

### Real-Time Collaboration (Pro)
- Multiple editors simultaneously
- See who's viewing/editing
- Chat during editing
- Resolve conflicts automatically

### Version History
- Auto-saved every 30 seconds
- Named versions
- Restore previous versions
- Compare versions side-by-side

### Comments & Feedback
- Add comments to slides
- @mention team members
- Resolve threads
- Export with comments (optional)

## Analytics (Pro)

Track presentation performance:
- **Views**: How many times viewed
- **Engagement**: Time spent per slide
- **Shares**: How many people shared
- **Conversion**: CTA click-through

## Best Practices

### For Presentations
- Export to PowerPoint for offline presenting
- Use presenter mode for speaker notes
- Test animations before exporting

### For Sharing
- Use web links for quick sharing
- PDF for client deliverables
- Images for social media teasers

### For Collaboration
- Share edit link with team
- Export final version only when complete
- Use version naming conventions

## Troubleshooting

### Export Failed
- Check internet connection
- Try lower quality setting
- Reduce file size (fewer slides, smaller images)
- Contact support if persists

### Formatting Issues
- Fonts may change in PowerPoint (use web-safe fonts)
- Animations limited in PDF
- Some effects web-only

### Sharing Issues
- Check privacy settings
- Verify link hasn't expired
- Confirm recipient permissions

Need help exporting? [Contact support →](/help)
`,
      },
    ],
  },
  {
    id: 'agent-reference',
    title: 'Agent Reference',
    items: [
      {
        id: 'director',
        title: 'Director Agent',
        slug: 'director-agent',
        category: 'agent-reference',
        content: `# Director Agent Reference

The Director is your presentation's strategic planner and orchestrator.

## Core Capabilities

### Strategic Planning
- Analyzes presentation requirements
- Determines optimal structure
- Plans slide count and flow
- Establishes information hierarchy
- Decides agent collaboration strategy

### Orchestration
- Coordinates all other agents
- Manages workflow and timing
- Ensures coherence across slides
- Handles dependencies between elements
- Monitors overall quality

### Decision Making
- Chooses appropriate layouts
- Determines content distribution
- Balances visual and text elements
- Optimizes for audience and purpose
- Makes trade-off decisions

## When Director Takes the Lead

The Director is activated for:

### Structural Decisions
- How many slides needed?
- What order for topics?
- How to transition between sections?
- When to emphasize vs. summarize?

### Resource Allocation
- Which agents to involve?
- How much detail per slide?
- Balance of text vs. visuals?
- Time allocation per section?

### Quality Assurance
- Is the flow logical?
- Are key points emphasized?
- Is there redundancy?
- Does it match requirements?

## Example Director Decisions

### Presentation Structure
**User Request:**
\`\`\`
Create a pitch deck for our SaaS product
\`\`\`

**Director's Plan:**
1. Problem statement (1 slide)
2. Solution overview (1 slide)
3. How it works (2 slides)
4. Market opportunity (2 slides)
5. Business model (1 slide)
6. Traction (1 slide)
7. Team (1 slide)
8. Ask (1 slide)

**Total:** 10 slides

### Agent Coordination
**Scenario:** Creating a data-heavy quarterly report

**Director's Strategy:**
- **Scripter**: Write executive summary and conclusions
- **Data Visualizer**: Create charts for all metrics
- **Graphic Artist**: Design clean, professional layouts
- **Sequence**: Scripter → Data Visualizer → Graphic Artist per slide

## Influencing Director Behavior

### Specify Structure
\`\`\`
Create a 3-part presentation: introduction, main content (5 slides), and conclusion
\`\`\`

### Request Reordering
\`\`\`
Director, move the pricing discussion earlier, before the features section
\`\`\`

### Change Emphasis
\`\`\`
Focus more on the problem than the solution - make it 2 slides instead of 1
\`\`\`

### Override Decisions
\`\`\`
I know you suggested 12 slides, but let's keep it to 8 for a shorter presentation
\`\`\`

## Director Best Practices

### Provide Clear Goals
✅ "Create a 15-minute investor presentation for Series A"
❌ "Make some slides about our company"

### Trust the Plan, Then Iterate
1. Let Director create initial structure
2. Review the flow
3. Request specific changes
4. Don't micromanage early decisions

### Communicate Constraints
- Time limits (5 min, 30 min, etc.)
- Slide count preferences
- Audience expertise level
- Presentation context (formal, casual, etc.)

## Director Reasoning

The Director explains its decisions:

**Example Chain of Thought:**
\`\`\`
Analyzing request: Investor pitch deck
Target audience: Series A investors
Context: Fundraising presentation

Strategic decisions:
1. Start with problem (establish need)
2. Follow with solution (our answer)
3. Show market size (opportunity)
4. Prove traction (reduce risk)
5. Present team (execution capability)
6. End with ask (clear next step)

Estimated slide count: 10-12 slides
Recommended style: Professional, data-driven
Agent collaboration: All four agents needed
\`\`\`

## Free vs. Pro Director

### Free Tier
- Basic structure planning
- Essential decision making
- Works with Scripter only
- Standard templates

### Pro Tier
- Advanced strategic planning
- Complex multi-section presentations
- Coordinates all 4 agents
- Custom structures
- Industry-specific templates

## Working With Director

### Effective Communication

**Do:**
- Describe your end goal clearly
- Provide audience context
- Mention time or slide constraints
- Share any must-have content

**Don't:**
- Prescribe every detail upfront
- Fight the structure without trying it
- Skip reviewing the plan
- Ignore Director's reasoning

### When to Override Director

It's okay to override when:
- You have specific brand requirements
- Audience expectations differ
- Company standards dictate structure
- Personal preference on organization

**How to override:**
\`\`\`
Director, I appreciate the plan, but our company standard is to always start
with team introductions. Please restructure accordingly.
\`\`\`

## Advanced Director Features

### Multi-Section Presentations
For complex presentations:
\`\`\`
Create a 30-slide presentation with 3 sections:
1) Company overview (10 slides)
2) Product deep-dive (15 slides)
3) Partnership proposal (5 slides)
\`\`\`

### Adaptive Restructuring
Director can reorganize mid-creation:
\`\`\`
This flow isn't working. Let's put the case studies before the product details
to build credibility first.
\`\`\`

### Template Blending
Combine multiple approaches:
\`\`\`
Use the startup pitch template structure but add elements from the sales
deck template for product details.
\`\`\`

## Troubleshooting

### Director suggests too many slides
- Specify slide limit in initial request
- Ask Director to condense key points
- Request focus on highest-priority content

### Flow doesn't match expectations
- Review Director's reasoning
- Request specific reordering
- Explain your preferred logic

### Missing important content
- Specify must-have sections upfront
- Ask Director to add specific slides
- Provide comprehensive requirements

## Learn More

- See [Director in action](/resources/understanding-ai-agents)
- Compare with [other agents](/docs/agent-reference)
- Read [strategic planning best practices](/docs/features)

The Director is ready to plan your next presentation. [Start now →](/builder)
`,
      },
    ],
  },
];

export const docNavigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Quick Start Guide', href: '/docs/getting-started/quick-start-guide' },
      { title: 'Your First Presentation', href: '/docs/getting-started/your-first-presentation' },
      { title: 'Understanding AI Agents', href: '/docs/getting-started/understanding-agents' },
    ],
  },
  {
    title: 'Builder Guide',
    items: [
      { title: 'Using the Chat Interface', href: '/docs/builder-guide/chat-interface' },
      { title: 'Editing Slides', href: '/docs/builder-guide/slide-editing' },
      { title: 'Exporting & Sharing', href: '/docs/builder-guide/exports' },
    ],
  },
  {
    title: 'Agent Reference',
    items: [
      { title: 'Director Agent', href: '/docs/agent-reference/director-agent' },
      { title: 'Scripter Agent', href: '/docs/agent-reference/scripter-agent' },
      { title: 'Graphic Artist Agent', href: '/docs/agent-reference/graphic-artist-agent' },
      { title: 'Data Visualizer Agent', href: '/docs/agent-reference/data-visualizer-agent' },
    ],
  },
];
