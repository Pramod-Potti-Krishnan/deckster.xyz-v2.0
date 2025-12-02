# AI Service: Diagram

This document specifies the Diagram AI Service requirements for generating Mermaid-based diagrams within presentations. The service uses AI to generate Mermaid syntax code that is then rendered as SVG diagrams.

---

## Service Overview

The Diagram Service generates 11 types of Mermaid diagrams:

| Type | Mermaid Syntax | Use Case |
|------|----------------|----------|
| `flowchart` | `flowchart TD/LR` | Process flows, decision trees |
| `sequence` | `sequenceDiagram` | Interaction sequences, API flows |
| `class` | `classDiagram` | UML class diagrams, data models |
| `state` | `stateDiagram-v2` | State machines, workflow states |
| `er` | `erDiagram` | Entity-relationship, database schemas |
| `gantt` | `gantt` | Project timelines, scheduling |
| `userjourney` | `journey` | User experience flows, personas |
| `gitgraph` | `gitGraph` | Git branch visualization |
| `mindmap` | `mindmap` | Hierarchical ideas, brainstorming |
| `pie` | `pie` | Simple pie charts |
| `timeline` | `timeline` | Historical events, milestones |

---

## Service Endpoints

### Base URL
```
POST /api/ai/diagram/*
```

---

## Diagram Generation

### 1. Generate Diagram

```
POST /api/ai/diagram/generate
```

#### Request Schema

```typescript
interface DiagramGenerateRequest {
  // Required
  prompt: string                    // Description of diagram content
  type: DiagramType                 // One of 11 types
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    slideTitle?: string
    slideIndex: number
    existingDiagrams?: string[]     // Other diagrams in presentation
  }

  // Layout options
  layout: {
    direction: DiagramDirection     // Flow direction
    theme: MermaidTheme             // Visual theme
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units (1-12)
    gridHeight: number              // Element height in grid units (1-8)
  }

  // Content options
  options?: {
    complexity: 'simple' | 'moderate' | 'detailed'
    maxNodes?: number               // Limit node count
    includeNotes?: boolean          // Add notes/annotations
    includeSubgraphs?: boolean      // Group related items
  }
}

type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'userjourney'
  | 'gitgraph'
  | 'mindmap'
  | 'pie'
  | 'timeline'

type DiagramDirection =
  | 'TB'    // Top to Bottom
  | 'BT'    // Bottom to Top
  | 'LR'    // Left to Right
  | 'RL'    // Right to Left

type MermaidTheme =
  | 'default'   // Standard Mermaid theme
  | 'forest'    // Green/nature theme
  | 'dark'      // Dark mode
  | 'neutral'   // Grayscale
  | 'base'      // Minimal styling
```

#### Response Schema

```typescript
interface DiagramGenerateResponse {
  success: boolean
  data?: {
    generationId: string

    // Mermaid code
    mermaidCode: string             // Raw Mermaid syntax

    // Rendered output
    rendered: {
      svg: string                   // Complete SVG content
      png?: string                  // Base64 PNG (optional)
    }

    // Parsed structure
    structure: DiagramStructure

    // Metadata
    metadata: {
      type: DiagramType
      direction: DiagramDirection
      theme: MermaidTheme
      nodeCount: number
      edgeCount: number
      dimensions: {
        width: number
        height: number
      }
      syntaxValid: boolean
    }

    // Edit capabilities
    editInfo: {
      editableNodes: boolean
      editableEdges: boolean
      canAddNodes: boolean
      canReorder: boolean
    }
  }
  error?: {
    code: DiagramErrorCode
    message: string
    syntaxError?: {
      line: number
      column: number
      expected: string[]
    }
    retryable: boolean
  }
}

type DiagramErrorCode =
  | 'INVALID_TYPE'
  | 'INVALID_PROMPT'
  | 'SYNTAX_ERROR'
  | 'RENDER_FAILED'
  | 'GENERATION_FAILED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
```

---

## Diagram Structure Types

### Base Structure

```typescript
interface DiagramStructure {
  type: DiagramType
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  subgraphs?: DiagramSubgraph[]
  config?: MermaidConfig
}

interface DiagramNode {
  id: string
  label: string
  type?: NodeType
  style?: NodeStyle
  position?: number                 // Order in definition
}

interface DiagramEdge {
  id: string
  source: string                    // Source node ID
  target: string                    // Target node ID
  label?: string
  type: EdgeType
  style?: EdgeStyle
}

interface DiagramSubgraph {
  id: string
  label: string
  nodes: string[]                   // Node IDs in subgraph
  style?: SubgraphStyle
}

type NodeType = 'default' | 'round' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'diamond' | 'hexagon' | 'parallelogram' | 'trapezoid'

type EdgeType = 'solid' | 'dotted' | 'thick' | 'arrow' | 'bidirectional' | 'none'

interface NodeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  color?: string
}

interface EdgeStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
}
```

### Type-Specific Structures

#### Flowchart

```typescript
interface FlowchartStructure extends DiagramStructure {
  type: 'flowchart'
  direction: DiagramDirection
  nodes: FlowchartNode[]
}

interface FlowchartNode extends DiagramNode {
  shape: 'rectangle' | 'rounded' | 'stadium' | 'subroutine' |
         'cylinder' | 'circle' | 'diamond' | 'hexagon' |
         'parallelogram' | 'trapezoid' | 'double-circle'
}

// Example Mermaid output
const FLOWCHART_EXAMPLE = `
flowchart TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
    C --> D
`
```

#### Sequence Diagram

```typescript
interface SequenceStructure extends DiagramStructure {
  type: 'sequence'
  participants: SequenceParticipant[]
  messages: SequenceMessage[]
  activations?: SequenceActivation[]
  notes?: SequenceNote[]
  loops?: SequenceLoop[]
}

interface SequenceParticipant {
  id: string
  alias?: string
  type: 'participant' | 'actor'
}

interface SequenceMessage {
  from: string
  to: string
  text: string
  type: 'solid' | 'dotted' | 'solidArrow' | 'dottedArrow' |
        'solidCross' | 'dottedCross' | 'solidOpen' | 'dottedOpen'
}

interface SequenceActivation {
  participant: string
  start: number                     // Message index
  end: number
}

interface SequenceNote {
  position: 'left' | 'right' | 'over'
  participants: string[]
  text: string
}

interface SequenceLoop {
  label: string
  messages: number[]                // Message indices
}

// Example Mermaid output
const SEQUENCE_EXAMPLE = `
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob
    B-->>A: Hi Alice
    Note right of B: Bob thinks
    A->>B: How are you?
    B-->>A: Good!
`
```

#### Class Diagram

```typescript
interface ClassStructure extends DiagramStructure {
  type: 'class'
  classes: ClassDefinition[]
  relationships: ClassRelationship[]
}

interface ClassDefinition {
  name: string
  stereotype?: string               // <<interface>>, <<abstract>>
  attributes: ClassMember[]
  methods: ClassMember[]
  isAbstract?: boolean
}

interface ClassMember {
  visibility: '+' | '-' | '#' | '~'  // public, private, protected, package
  name: string
  type?: string
  parameters?: string[]             // For methods
  isStatic?: boolean
  isAbstract?: boolean
}

interface ClassRelationship {
  from: string
  to: string
  type: 'inheritance' | 'composition' | 'aggregation' |
        'association' | 'dependency' | 'realization'
  label?: string
  cardinality?: {
    from?: string                   // "1", "*", "0..1"
    to?: string
  }
}

// Example Mermaid output
const CLASS_EXAMPLE = `
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
`
```

#### State Diagram

```typescript
interface StateStructure extends DiagramStructure {
  type: 'state'
  states: StateDefinition[]
  transitions: StateTransition[]
}

interface StateDefinition {
  id: string
  label?: string
  type: 'normal' | 'start' | 'end' | 'choice' | 'fork' | 'join' | 'composite'
  description?: string
  substates?: StateDefinition[]
}

interface StateTransition {
  from: string
  to: string
  event?: string
  guard?: string                    // [condition]
  action?: string
}

// Example Mermaid output
const STATE_EXAMPLE = `
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
`
```

#### ER Diagram

```typescript
interface ERStructure extends DiagramStructure {
  type: 'er'
  entities: EREntity[]
  relationships: ERRelationship[]
}

interface EREntity {
  name: string
  attributes: ERAttribute[]
}

interface ERAttribute {
  name: string
  type: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  isNullable?: boolean
}

interface ERRelationship {
  from: string
  to: string
  label: string
  cardinality: {
    from: '||' | '|o' | '}|' | '}o'  // exactly one, zero or one, one or more, zero or more
    to: '||' | 'o|' | '|{' | 'o{'
  }
}

// Example Mermaid output
const ER_EXAMPLE = `
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created
        int customer_id FK
    }
`
```

#### Gantt Chart

```typescript
interface GanttStructure extends DiagramStructure {
  type: 'gantt'
  title?: string
  dateFormat: string
  sections: GanttSection[]
}

interface GanttSection {
  name: string
  tasks: GanttTask[]
}

interface GanttTask {
  id: string
  name: string
  status: 'done' | 'active' | 'crit' | 'milestone'
  start: string | { after: string }
  duration?: string                 // "5d", "2w"
  end?: string
}

// Example Mermaid output
const GANTT_EXAMPLE = `
gantt
    title Project Schedule
    dateFormat  YYYY-MM-DD
    section Planning
    Research           :done,    a1, 2024-01-01, 10d
    Design             :active,  a2, after a1, 15d
    section Development
    Implementation     :         a3, after a2, 30d
    Testing            :         a4, after a3, 14d
`
```

#### User Journey

```typescript
interface JourneyStructure extends DiagramStructure {
  type: 'userjourney'
  title: string
  sections: JourneySection[]
}

interface JourneySection {
  name: string
  tasks: JourneyTask[]
}

interface JourneyTask {
  name: string
  score: number                     // 1-5
  actors: string[]
}

// Example Mermaid output
const JOURNEY_EXAMPLE = `
journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me
`
```

#### Git Graph

```typescript
interface GitGraphStructure extends DiagramStructure {
  type: 'gitgraph'
  commits: GitCommit[]
  branches: GitBranch[]
  merges: GitMerge[]
}

interface GitCommit {
  id: string
  message?: string
  tag?: string
  type?: 'normal' | 'highlight' | 'reverse'
  branch: string
}

interface GitBranch {
  name: string
  from?: string                     // Parent branch
}

interface GitMerge {
  from: string
  to: string
  message?: string
}

// Example Mermaid output
const GITGRAPH_EXAMPLE = `
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
`
```

#### Mindmap

```typescript
interface MindmapStructure extends DiagramStructure {
  type: 'mindmap'
  root: MindmapNode
}

interface MindmapNode {
  id: string
  text: string
  shape?: 'default' | 'rounded' | 'circle' | 'bang' | 'cloud' | 'hexagon'
  icon?: string
  children?: MindmapNode[]
}

// Example Mermaid output
const MINDMAP_EXAMPLE = `
mindmap
  root((Project))
    Planning
      Research
      Design
    Development
      Frontend
      Backend
    Testing
      Unit Tests
      Integration
`
```

#### Pie Chart

```typescript
interface PieStructure extends DiagramStructure {
  type: 'pie'
  title: string
  showData: boolean
  slices: PieSlice[]
}

interface PieSlice {
  label: string
  value: number
}

// Example Mermaid output
const PIE_EXAMPLE = `
pie showData
    title Browser Market Share
    "Chrome" : 65
    "Firefox" : 15
    "Safari" : 12
    "Edge" : 8
`
```

#### Timeline

```typescript
interface TimelineStructure extends DiagramStructure {
  type: 'timeline'
  title?: string
  periods: TimelinePeriod[]
}

interface TimelinePeriod {
  period: string
  events: string[]
}

// Example Mermaid output
const TIMELINE_EXAMPLE = `
timeline
    title Company History
    2000 : Company founded
    2005 : First product launch
         : IPO
    2010 : Expansion to Europe
    2015 : Acquired competitor
    2020 : 1M customers reached
`
```

---

## Mermaid Configuration

### Theme Configuration

```typescript
interface MermaidConfig {
  theme: MermaidTheme
  themeVariables?: ThemeVariables
  flowchart?: FlowchartConfig
  sequence?: SequenceConfig
  gantt?: GanttConfig
}

interface ThemeVariables {
  // Colors
  primaryColor?: string
  primaryTextColor?: string
  primaryBorderColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  background?: string

  // Lines
  lineColor?: string
  textColor?: string

  // Fonts
  fontFamily?: string
  fontSize?: string
}

interface FlowchartConfig {
  htmlLabels?: boolean
  curve?: 'basis' | 'linear' | 'cardinal'
  padding?: number
  nodeSpacing?: number
  rankSpacing?: number
  useMaxWidth?: boolean
}

interface SequenceConfig {
  diagramMarginX?: number
  diagramMarginY?: number
  actorMargin?: number
  boxMargin?: number
  boxTextMargin?: number
  noteMargin?: number
  messageMargin?: number
  mirrorActors?: boolean
  bottomMarginAdj?: number
  useMaxWidth?: boolean
}

interface GanttConfig {
  titleTopMargin?: number
  barHeight?: number
  barGap?: number
  topPadding?: number
  leftPadding?: number
  gridLineStartPadding?: number
  fontSize?: number
  fontFamily?: string
  numberSectionStyles?: number
  axisFormat?: string
  useMaxWidth?: boolean
}
```

### Presentation Theme to Mermaid Theme Mapping

```typescript
const THEME_MAPPING: Record<string, MermaidTheme> = {
  'light': 'default',
  'dark': 'dark',
  'corporate': 'neutral',
  'modern': 'base',
  'nature': 'forest'
}

function getMermaidTheme(presentationTheme?: string): MermaidTheme {
  return THEME_MAPPING[presentationTheme || 'light'] || 'default'
}
```

---

## Content Generation Guidelines

### Node Limits by Type and Size

```typescript
const NODE_LIMITS = {
  flowchart: {
    small: { max: 6, recommended: 4 },
    medium: { max: 12, recommended: 8 },
    large: { max: 20, recommended: 14 }
  },
  sequence: {
    small: { maxParticipants: 3, maxMessages: 6 },
    medium: { maxParticipants: 5, maxMessages: 12 },
    large: { maxParticipants: 8, maxMessages: 20 }
  },
  class: {
    small: { maxClasses: 3, maxMembers: 3 },
    medium: { maxClasses: 6, maxMembers: 5 },
    large: { maxClasses: 10, maxMembers: 8 }
  },
  state: {
    small: { max: 5 },
    medium: { max: 10 },
    large: { max: 18 }
  },
  er: {
    small: { maxEntities: 3, maxAttributes: 4 },
    medium: { maxEntities: 6, maxAttributes: 6 },
    large: { maxEntities: 10, maxAttributes: 8 }
  },
  gantt: {
    small: { maxTasks: 5 },
    medium: { maxTasks: 12 },
    large: { maxTasks: 20 }
  },
  mindmap: {
    small: { maxDepth: 2, maxChildren: 3 },
    medium: { maxDepth: 3, maxChildren: 4 },
    large: { maxDepth: 4, maxChildren: 5 }
  }
}

function getNodeLimits(
  type: DiagramType,
  gridWidth: number,
  gridHeight: number
): { max: number, recommended: number } {
  const size = getLayoutSize(gridWidth, gridHeight)
  const limits = NODE_LIMITS[type]

  if (!limits) return { max: 10, recommended: 6 }

  return limits[size] || { max: 10, recommended: 6 }
}

function getLayoutSize(
  gridWidth: number,
  gridHeight: number
): 'small' | 'medium' | 'large' {
  const area = gridWidth * gridHeight

  if (area <= 16) return 'small'      // 4x4 or less
  if (area <= 48) return 'medium'     // 6x8 or less
  return 'large'
}
```

### Direction Recommendations by Type

```typescript
const RECOMMENDED_DIRECTION: Record<DiagramType, DiagramDirection[]> = {
  flowchart: ['TD', 'LR'],          // Top-down or left-right
  sequence: ['LR'],                  // Always left-right
  class: ['TB', 'LR'],               // Top-down preferred
  state: ['TB', 'LR'],               // Top-down preferred
  er: ['TB', 'LR'],                  // Either works
  gantt: ['LR'],                     // Always left-right (time axis)
  userjourney: ['LR'],               // Always left-right
  gitgraph: ['TB'],                  // Top-down preferred
  mindmap: ['TB', 'LR'],             // Either works
  pie: ['TB'],                       // Not applicable
  timeline: ['TB', 'LR']             // Top-down preferred
}

function getOptimalDirection(
  type: DiagramType,
  gridWidth: number,
  gridHeight: number
): DiagramDirection {
  const preferred = RECOMMENDED_DIRECTION[type]

  // For wide elements, prefer LR
  if (gridWidth > gridHeight && preferred.includes('LR')) {
    return 'LR'
  }

  // For tall elements, prefer TB
  if (gridHeight > gridWidth && preferred.includes('TB')) {
    return 'TB'
  }

  return preferred[0]
}
```

---

## Transform Operations

### 2. Update Diagram Code

```
POST /api/ai/diagram/update
```

#### Request Schema

```typescript
interface DiagramUpdateRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  // New Mermaid code
  mermaidCode: string

  // Options
  validateOnly?: boolean            // Just validate, don't save
}
```

### 3. Transform Diagram

```
POST /api/ai/diagram/transform
```

#### Request Schema

```typescript
interface DiagramTransformRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  transformation: DiagramTransformation
  options?: {
    targetType?: DiagramType        // For type conversion
    targetDirection?: DiagramDirection
    targetTheme?: MermaidTheme
    additionalPrompt?: string       // Guidance for AI
  }
}

type DiagramTransformation =
  | 'add_node'        // Add a new node
  | 'remove_node'     // Remove a node
  | 'add_edge'        // Add connection
  | 'remove_edge'     // Remove connection
  | 'add_subgraph'    // Group nodes
  | 'change_direction'// Rotate layout
  | 'change_theme'    // Apply different theme
  | 'change_type'     // Convert diagram type (if possible)
  | 'simplify'        // Reduce complexity
  | 'elaborate'       // Add more detail
```

### 4. Validate Mermaid Syntax

```
POST /api/ai/diagram/validate
```

#### Request Schema

```typescript
interface DiagramValidateRequest {
  mermaidCode: string
  type?: DiagramType                // Expected type
}
```

#### Response Schema

```typescript
interface DiagramValidateResponse {
  valid: boolean
  detectedType?: DiagramType
  errors?: {
    line: number
    column: number
    message: string
    expected?: string[]
  }[]
  warnings?: string[]
  suggestions?: string[]
}
```

---

## Client-Side Rendering

### Mermaid.js Integration

The Layout Service renders Mermaid diagrams client-side:

```typescript
// Client-side rendering
import mermaid from 'mermaid'

async function renderMermaidDiagram(
  code: string,
  config: MermaidConfig,
  container: HTMLElement
): Promise<void> {
  // Initialize Mermaid with config
  mermaid.initialize({
    startOnLoad: false,
    theme: config.theme,
    themeVariables: config.themeVariables,
    flowchart: config.flowchart,
    sequence: config.sequence,
    gantt: config.gantt
  })

  // Generate unique ID
  const id = `mermaid-${Date.now()}`

  // Render diagram
  const { svg } = await mermaid.render(id, code)

  // Insert into container
  container.innerHTML = svg
}
```

### Server-Side Pre-rendering

For export and thumbnail generation, the AI service can pre-render:

```typescript
// Server-side rendering with puppeteer or similar
async function prerenderMermaid(
  code: string,
  config: MermaidConfig,
  outputFormat: 'svg' | 'png'
): Promise<string> {
  // Use puppeteer to render Mermaid
  // Return SVG string or base64 PNG
}
```

---

## Error Handling

### Syntax Error Recovery

```typescript
interface SyntaxErrorRecovery {
  // Attempt to fix common syntax errors
  autoFix: {
    missingDirection: boolean       // Add missing 'TD' to flowchart
    missingArrow: boolean           // Fix --> to proper syntax
    unbalancedBrackets: boolean     // Close open brackets
    invalidCharacters: boolean      // Replace special chars
  }

  // If fix fails, provide helpful message
  helpfulMessage: string
  suggestedCode?: string
}

const COMMON_FIXES = {
  // Missing flowchart direction
  'flowchart\n': 'flowchart TD\n',

  // Wrong arrow syntax
  '->': '-->',
  '<-': '<--',

  // Missing quotes in labels
  /\[([^"\]]+)\]/g: '["$1"]',

  // Invalid line endings
  '\r\n': '\n'
}
```

---

## Rate Limiting

```typescript
const RATE_LIMITS = {
  generate: {
    requestsPerMinute: 20,
    requestsPerHour: 300
  },
  transform: {
    requestsPerMinute: 40,
    requestsPerHour: 600
  },
  validate: {
    requestsPerMinute: 100,
    requestsPerHour: 2000
  }
}
```

---

## Integration with Layout Service

### Orchestration Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Layout Service  │────▶│  Diagram AI      │
│   Panel      │     │  Orchestrator    │     │    Service       │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │  1. Type selection   │                        │
       │  2. User prompt      │                        │
       │  3. Direction/theme  │                        │
       │                      │  4. Add context        │
       │                      │  5. Calculate limits   │
       │                      │  6. Map theme          │
       │                      │                        │
       │                      │────────────────────────▶
       │                      │  7. Generate request   │
       │                      │                        │
       │                      │◀────────────────────────
       │                      │  8. Mermaid code + SVG │
       │                      │                        │
       │◀─────────────────────│  9. Store code        │
       │ 10. Client render    │ 10. Return to frontend │
```

### Layout Service Responsibilities

1. **Store Mermaid Code**: Save raw code in element content
2. **Map Presentation Theme**: Convert to Mermaid theme
3. **Calculate Node Limits**: Based on element dimensions
4. **Client-Side Rendering**: Use Mermaid.js to render
5. **Handle Re-rendering**: On theme/direction changes
6. **Export Support**: Pre-render for PDF/image export

---

## Implementation Notes

### Mermaid Version

Target Mermaid.js version: `10.x`

Key features required:
- All 11 diagram types
- Theme support
- Configuration API
- Error reporting

### Security Considerations

```typescript
// Sanitize user-provided Mermaid code
function sanitizeMermaidCode(code: string): string {
  // Remove potential XSS vectors
  return code
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '')
}
```

### Caching Strategy

```typescript
// Cache rendered SVGs by code hash
const SVG_CACHE_TTL = 3600 // 1 hour

function getCacheKey(code: string, config: MermaidConfig): string {
  return hash({
    code,
    theme: config.theme,
    themeVariables: config.themeVariables
  })
}
```
