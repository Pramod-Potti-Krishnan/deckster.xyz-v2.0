import { Agent } from '@/types/agents';

export const agents: Agent[] = [
  {
    id: 'director',
    name: 'Director',
    slug: 'director',
    title: 'The Orchestrator',
    tagline: 'Your presentation project manager',
    description: 'The Director is your AI project manager who understands your vision and coordinates all other agents to bring your presentation to life. It breaks down your requirements, assigns tasks, and ensures everything comes together seamlessly.',
    color: {
      primary: 'purple-600',
      secondary: 'purple-100',
      gradient: 'from-purple-600 to-blue-600',
    },
    icon: 'Sparkles',
    capabilities: [
      {
        id: 'requirements-analysis',
        title: 'Requirements Analysis',
        description: 'Understands your presentation goals, audience, and key messages to create a comprehensive brief.',
      },
      {
        id: 'task-coordination',
        title: 'Task Coordination',
        description: 'Intelligently delegates work to specialized agents based on your needs and their capabilities.',
      },
      {
        id: 'quality-control',
        title: 'Quality Control',
        description: 'Reviews all content and visuals to ensure consistency, coherence, and alignment with your goals.',
      },
      {
        id: 'adaptive-planning',
        title: 'Adaptive Planning',
        description: 'Adjusts the presentation structure and content flow based on your feedback and changing requirements.',
      },
    ],
    useCases: [
      {
        id: 'business-pitch',
        title: 'Business Pitch Decks',
        description: 'The Director ensures your investor pitch has a compelling narrative arc, backed by data, with professional visuals.',
        example: 'Creating a Series A fundraising deck with market analysis, financial projections, and team highlights.',
      },
      {
        id: 'product-launch',
        title: 'Product Launches',
        description: 'Coordinates messaging across slides to build excitement while clearly explaining product benefits and differentiation.',
        example: 'Launching a new SaaS product with feature walkthroughs, pricing tiers, and customer testimonials.',
      },
      {
        id: 'quarterly-review',
        title: 'Quarterly Reviews',
        description: 'Orchestrates data-heavy presentations that tell the story behind the numbers with executive-level polish.',
        example: 'Board presentation combining financial metrics, strategic initiatives, and market performance.',
      },
    ],
    technicalDetails: [
      {
        id: 'llm-model',
        aspect: 'LLM Model',
        description: 'Powered by advanced language models fine-tuned for project management and creative direction.',
      },
      {
        id: 'planning-algorithm',
        aspect: 'Planning Algorithm',
        description: 'Uses hierarchical task decomposition to break complex presentations into manageable work units.',
      },
      {
        id: 'feedback-loop',
        aspect: 'Feedback Loop',
        description: 'Implements reinforcement learning to improve coordination based on user preferences and outcomes.',
      },
    ],
    workflow: [
      {
        id: 'step-1',
        step: 1,
        title: 'Understand Requirements',
        description: 'Analyzes your input to extract goals, audience, key messages, and constraints.',
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Create Presentation Plan',
        description: 'Develops a slide-by-slide outline with content requirements and visual needs.',
      },
      {
        id: 'step-3',
        step: 3,
        title: 'Delegate to Specialists',
        description: 'Assigns content writing to Scripter, visuals to Graphic Artist, and data to Data Visualizer.',
      },
      {
        id: 'step-4',
        step: 4,
        title: 'Review and Refine',
        description: 'Ensures all elements work together cohesively and match your original vision.',
      },
    ],
  },
  {
    id: 'scripter',
    name: 'Scripter',
    slug: 'scripter',
    title: 'The Content Writer',
    tagline: 'Your AI copywriting expert',
    description: 'The Scripter crafts compelling narratives, persuasive copy, and clear messaging for every slide. It understands tone, audience, and storytelling to create presentations that resonate and drive action.',
    color: {
      primary: 'blue-600',
      secondary: 'blue-100',
      gradient: 'from-blue-600 to-cyan-600',
    },
    icon: 'PenTool',
    capabilities: [
      {
        id: 'narrative-design',
        title: 'Narrative Design',
        description: 'Structures content to tell a compelling story with clear beginning, middle, and end.',
      },
      {
        id: 'tone-adaptation',
        title: 'Tone Adaptation',
        description: 'Adjusts writing style for different audiences - from technical teams to C-suite executives.',
      },
      {
        id: 'message-clarity',
        title: 'Message Clarity',
        description: 'Distills complex ideas into clear, concise bullet points and headlines.',
      },
      {
        id: 'speaker-notes',
        title: 'Speaker Notes',
        description: 'Generates detailed talking points to help you deliver the presentation confidently.',
      },
    ],
    useCases: [
      {
        id: 'sales-presentations',
        title: 'Sales Presentations',
        description: 'Creates persuasive messaging that addresses customer pain points and highlights value propositions.',
        example: 'Enterprise sales deck with problem-agitate-solve structure and ROI calculations.',
      },
      {
        id: 'training-materials',
        title: 'Training Materials',
        description: 'Develops educational content that\'s easy to understand and remember.',
        example: 'Employee onboarding presentation with company culture, policies, and best practices.',
      },
      {
        id: 'conference-talks',
        title: 'Conference Talks',
        description: 'Writes engaging content for keynotes and technical talks that keeps audiences engaged.',
        example: 'Tech conference presentation explaining new architecture patterns with real-world examples.',
      },
    ],
    technicalDetails: [
      {
        id: 'nlp-engine',
        aspect: 'NLP Engine',
        description: 'Advanced natural language processing for context-aware content generation.',
      },
      {
        id: 'tone-analysis',
        aspect: 'Tone Analysis',
        description: 'Sentiment and style analysis to match your desired voice and audience expectations.',
      },
      {
        id: 'content-optimization',
        aspect: 'Content Optimization',
        description: 'Readability scoring and word choice optimization for maximum impact.',
      },
    ],
    workflow: [
      {
        id: 'step-1',
        step: 1,
        title: 'Receive Content Brief',
        description: 'Gets slide requirements from Director including key messages and target audience.',
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Research and Ideate',
        description: 'Gathers relevant information and brainstorms compelling angles for the content.',
      },
      {
        id: 'step-3',
        step: 3,
        title: 'Draft Content',
        description: 'Creates headlines, body copy, and speaker notes with appropriate tone and style.',
      },
      {
        id: 'step-4',
        step: 4,
        title: 'Refine and Polish',
        description: 'Revises based on Director feedback and user preferences to perfect the messaging.',
      },
    ],
  },
  {
    id: 'graphic-artist',
    name: 'Graphic Artist',
    slug: 'graphic-artist',
    title: 'The Visual Designer',
    tagline: 'Your AI design expert',
    description: 'The Graphic Artist brings your slides to life with beautiful layouts, color schemes, and visual elements. It understands design principles, brand consistency, and how to make complex information visually digestible.',
    color: {
      primary: 'pink-600',
      secondary: 'pink-100',
      gradient: 'from-pink-600 to-rose-600',
    },
    icon: 'Palette',
    capabilities: [
      {
        id: 'layout-design',
        title: 'Layout Design',
        description: 'Creates balanced, visually appealing slide layouts that guide the eye and emphasize key points.',
      },
      {
        id: 'color-theory',
        title: 'Color Theory',
        description: 'Applies professional color palettes that match your brand and evoke the right emotions.',
      },
      {
        id: 'visual-hierarchy',
        title: 'Visual Hierarchy',
        description: 'Organizes elements to create clear information flow and highlight important content.',
      },
      {
        id: 'icon-imagery',
        title: 'Icon & Imagery',
        description: 'Selects and places icons and images that enhance understanding and engagement.',
      },
    ],
    useCases: [
      {
        id: 'brand-presentations',
        title: 'Brand Presentations',
        description: 'Ensures every slide reflects your brand identity with consistent colors, fonts, and visual style.',
        example: 'Company overview deck with brand-aligned color schemes and custom visual elements.',
      },
      {
        id: 'marketing-decks',
        title: 'Marketing Decks',
        description: 'Creates eye-catching designs that capture attention and communicate brand personality.',
        example: 'Campaign proposal with bold visuals, modern layouts, and compelling imagery.',
      },
      {
        id: 'executive-summaries',
        title: 'Executive Summaries',
        description: 'Designs clean, professional slides that convey sophistication and credibility.',
        example: 'C-suite presentation with minimalist design and data-focused layouts.',
      },
    ],
    technicalDetails: [
      {
        id: 'design-system',
        aspect: 'Design System',
        description: 'Built on professional design principles including golden ratio, rule of thirds, and Gestalt principles.',
      },
      {
        id: 'color-engine',
        aspect: 'Color Engine',
        description: 'Generates harmonious color palettes based on color theory and accessibility standards.',
      },
      {
        id: 'layout-algorithm',
        aspect: 'Layout Algorithm',
        description: 'Uses constraint-based layout optimization to create balanced, professional designs.',
      },
    ],
    workflow: [
      {
        id: 'step-1',
        step: 1,
        title: 'Analyze Content',
        description: 'Reviews slide content to understand information hierarchy and visual needs.',
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Select Visual Style',
        description: 'Chooses appropriate design approach based on content type and presentation purpose.',
      },
      {
        id: 'step-3',
        step: 3,
        title: 'Create Layout',
        description: 'Designs slide structure with optimal spacing, alignment, and visual balance.',
      },
      {
        id: 'step-4',
        step: 4,
        title: 'Apply Visual Elements',
        description: 'Adds colors, icons, images, and other design elements to enhance the message.',
      },
    ],
  },
  {
    id: 'data-visualizer',
    name: 'Data Visualizer',
    slug: 'data-visualizer',
    title: 'The Data Specialist',
    tagline: 'Your AI data visualization expert',
    description: 'The Data Visualizer transforms numbers and statistics into clear, insightful charts and graphs. It knows which visualization type best tells your data story and makes complex information easy to understand at a glance.',
    color: {
      primary: 'emerald-600',
      secondary: 'emerald-100',
      gradient: 'from-emerald-600 to-teal-600',
    },
    icon: 'BarChart',
    capabilities: [
      {
        id: 'chart-selection',
        title: 'Smart Chart Selection',
        description: 'Automatically chooses the most effective visualization type for your data and message.',
      },
      {
        id: 'data-analysis',
        title: 'Data Analysis',
        description: 'Identifies trends, outliers, and key insights to highlight in visualizations.',
      },
      {
        id: 'visual-encoding',
        title: 'Visual Encoding',
        description: 'Uses color, size, and position effectively to make data patterns immediately clear.',
      },
      {
        id: 'interactive-charts',
        title: 'Interactive Charts',
        description: 'Creates dynamic visualizations that reveal deeper insights on interaction.',
      },
    ],
    useCases: [
      {
        id: 'financial-reports',
        title: 'Financial Reports',
        description: 'Transforms spreadsheets into clear charts showing revenue trends, cost breakdowns, and forecasts.',
        example: 'Quarterly earnings presentation with waterfall charts, trend lines, and variance analysis.',
      },
      {
        id: 'market-research',
        title: 'Market Research',
        description: 'Visualizes survey data, market segments, and competitive positioning.',
        example: 'Market analysis deck with demographic breakdowns, market share charts, and growth projections.',
      },
      {
        id: 'performance-metrics',
        title: 'Performance Metrics',
        description: 'Presents KPIs, dashboards, and progress tracking in an easy-to-digest format.',
        example: 'OKR review with progress bars, goal tracking, and performance comparisons.',
      },
    ],
    technicalDetails: [
      {
        id: 'chart-library',
        aspect: 'Chart Library',
        description: 'Supports 20+ chart types including bar, line, pie, scatter, heatmap, and custom visualizations.',
      },
      {
        id: 'data-processing',
        aspect: 'Data Processing',
        description: 'Advanced statistical analysis to identify meaningful patterns and correlations.',
      },
      {
        id: 'accessibility',
        aspect: 'Accessibility',
        description: 'Ensures charts are readable with color-blind friendly palettes and proper labeling.',
      },
    ],
    workflow: [
      {
        id: 'step-1',
        step: 1,
        title: 'Receive Data',
        description: 'Imports data from various sources including spreadsheets, databases, and APIs.',
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Analyze Patterns',
        description: 'Performs statistical analysis to identify key trends and insights.',
      },
      {
        id: 'step-3',
        step: 3,
        title: 'Select Visualization',
        description: 'Chooses the most effective chart type based on data characteristics and message.',
      },
      {
        id: 'step-4',
        step: 4,
        title: 'Create Chart',
        description: 'Generates polished visualization with proper scaling, labels, and annotations.',
      },
    ],
  },
];

export const agentsNavigation = [
  { name: 'Director', href: '/agents/director' },
  { name: 'Scripter', href: '/agents/scripter' },
  { name: 'Graphic Artist', href: '/agents/graphic-artist' },
  { name: 'Data Visualizer', href: '/agents/data-visualizer' },
];
