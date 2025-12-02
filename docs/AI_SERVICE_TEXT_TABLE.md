# AI Service: Text + Table

This document specifies the Text + Table AI Service requirements for generating and transforming text content and table data within presentation elements.

---

## Service Overview

The Text + Table AI Service handles two core content types:
1. **Text Content**: Generate, transform, and enhance text for textbox elements
2. **Table Content**: Generate structured tabular data with AI

Both content types share contextual awareness of the presentation theme, slide context, and element positioning.

---

## Service Endpoints

### Base URL
```
POST /api/ai/text/*
POST /api/ai/table/*
```

---

## Text Generation Endpoints

### 1. Generate Text Content

Generate new text content based on a prompt and context.

```
POST /api/ai/text/generate
```

#### Request Schema

```typescript
interface TextGenerateRequest {
  // Required
  prompt: string                    // User's content description
  presentationId: string            // UUID of presentation
  slideId: string                   // UUID of slide
  elementId: string                 // UUID of target element

  // Context (provided by Layout Service)
  context: {
    presentationTitle: string       // Overall presentation title
    presentationTheme?: string      // Theme identifier
    slideIndex: number              // 0-based slide position
    slideCount: number              // Total slides in deck
    slideTitle?: string             // Current slide title
    slideContext?: string           // AI-generated slide summary
    previousSlideContent?: string   // Brief summary of prior slide
    nextSlideContent?: string       // Brief summary of next slide
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units (1-12)
    gridHeight: number              // Element height in grid units (1-8)
    maxCharacters?: number          // Optional character limit
    minCharacters?: number          // Optional minimum length
  }

  // Generation options
  options?: {
    tone?: TextTone                  // Writing tone
    format?: TextFormat              // Output structure
    language?: string                // ISO language code (default: 'en')
    bulletStyle?: BulletStyle        // For bullet lists
    includeEmoji?: boolean           // Allow emoji in output
  }
}

type TextTone =
  | 'professional'    // Corporate, formal
  | 'conversational'  // Friendly, approachable
  | 'academic'        // Scholarly, detailed
  | 'persuasive'      // Sales-oriented
  | 'casual'          // Relaxed, informal
  | 'technical'       // Precise, jargon-heavy

type TextFormat =
  | 'paragraph'       // Prose text
  | 'bullets'         // Bullet point list
  | 'numbered'        // Numbered list
  | 'headline'        // Short, impactful
  | 'quote'           // Quotation style
  | 'mixed'           // Combination (AI decides)

type BulletStyle = 'disc' | 'circle' | 'square' | 'dash' | 'arrow' | 'check'
```

#### Response Schema

```typescript
interface TextGenerateResponse {
  success: boolean
  data?: {
    generationId: string            // UUID for tracking/regeneration
    content: {
      html: string                  // Formatted HTML content
      plainText: string             // Plain text version
      markdown: string              // Markdown version
    }
    metadata: {
      characterCount: number
      wordCount: number
      estimatedReadTime: number     // Seconds
      format: TextFormat
      tone: TextTone
    }
    suggestions?: {
      alternativeVersions: string[] // Up to 3 variations
      expandable: boolean           // Can be expanded with more detail
      reducible: boolean            // Can be shortened
    }
  }
  error?: {
    code: TextErrorCode
    message: string
    retryable: boolean
  }
}

type TextErrorCode =
  | 'INVALID_PROMPT'
  | 'CONTEXT_MISSING'
  | 'GENERATION_FAILED'
  | 'CONTENT_FILTERED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
```

---

### 2. Transform Text Content

Transform existing text (expand, condense, rephrase, etc.)

```
POST /api/ai/text/transform
```

#### Request Schema

```typescript
interface TextTransformRequest {
  // Required
  sourceContent: string             // Original text to transform
  transformation: TextTransformation
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    slideTitle?: string
    originalPrompt?: string         // Original generation prompt if known
  }

  // Constraints
  constraints: {
    gridWidth: number
    gridHeight: number
    targetLength?: 'shorter' | 'same' | 'longer'
    maxCharacters?: number
  }

  // Options
  options?: {
    preserveFormatting?: boolean    // Keep bullets, numbering, etc.
    preserveTone?: boolean          // Maintain original tone
  }
}

type TextTransformation =
  | 'expand'          // Add more detail
  | 'condense'        // Shorten while keeping key points
  | 'simplify'        // Use simpler language
  | 'formalize'       // Make more professional
  | 'casualize'       // Make more conversational
  | 'bulletize'       // Convert to bullet points
  | 'paragraphize'    // Convert bullets to paragraphs
  | 'rephrase'        // Rewrite with same meaning
  | 'proofread'       // Fix grammar/spelling
  | 'translate'       // Translate to target language
```

#### Response Schema

```typescript
interface TextTransformResponse {
  success: boolean
  data?: {
    transformationId: string
    content: {
      html: string
      plainText: string
      markdown: string
    }
    changes: {
      characterDelta: number        // Positive = longer, negative = shorter
      significantChanges: string[]  // List of notable modifications
    }
    metadata: {
      characterCount: number
      wordCount: number
      transformation: TextTransformation
    }
  }
  error?: {
    code: TextErrorCode
    message: string
    retryable: boolean
  }
}
```

---

### 3. Auto-Fit Text

Adjust text content to fit element dimensions.

```
POST /api/ai/text/autofit
```

#### Request Schema

```typescript
interface TextAutofitRequest {
  content: string                   // Current text content
  presentationId: string
  slideId: string
  elementId: string

  targetFit: {
    gridWidth: number
    gridHeight: number
    fontSize: number                // Current font size in pixels
    minFontSize: number             // Minimum acceptable (default: 12)
    maxFontSize: number             // Maximum acceptable (default: 48)
  }

  strategy: AutofitStrategy
}

type AutofitStrategy =
  | 'reduce_font'     // Shrink font first
  | 'truncate'        // Cut content with ellipsis
  | 'smart_condense'  // AI shortens content to fit
  | 'overflow'        // Allow overflow (no changes)
```

#### Response Schema

```typescript
interface TextAutofitResponse {
  success: boolean
  data?: {
    content: string                 // Adjusted content (if modified)
    recommendedFontSize: number     // Best fit font size
    fits: boolean                   // Whether content fits
    overflow: {
      hasOverflow: boolean
      overflowLines: number
    }
  }
}
```

---

## Table Generation Endpoints

### 1. Generate Table Content

Generate structured table data based on prompt.

```
POST /api/ai/table/generate
```

#### Request Schema

```typescript
interface TableGenerateRequest {
  // Required
  prompt: string                    // What data the table should contain
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    slideTitle?: string
    slideContext?: string
  }

  // Table structure
  structure: {
    columns: number                 // Number of columns (1-10)
    rows: number                    // Number of data rows (1-20)
    hasHeader: boolean              // First row is header
    hasFooter?: boolean             // Last row is summary/footer
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units
    gridHeight: number              // Element height in grid units
  }

  // Styling options
  style?: {
    preset: TableStylePreset
    headerStyle?: 'bold' | 'highlight' | 'minimal'
    alternatingRows?: boolean
    borderStyle?: 'none' | 'light' | 'medium' | 'heavy'
    alignment?: 'left' | 'center' | 'right' | 'auto'
  }

  // Data options
  dataOptions?: {
    includeUnits?: boolean          // Add units to numeric columns
    formatNumbers?: boolean         // Apply number formatting
    dateFormat?: string             // Date format pattern
    currency?: string               // Currency code for money values
  }
}

type TableStylePreset =
  | 'minimal'         // Clean, borderless
  | 'bordered'        // All borders
  | 'striped'         // Alternating row colors
  | 'modern'          // Contemporary design
  | 'professional'    // Corporate style
  | 'colorful'        // Vibrant colors
```

#### Response Schema

```typescript
interface TableGenerateResponse {
  success: boolean
  data?: {
    generationId: string

    // Structured data
    tableData: {
      headers: TableCell[]          // Column headers
      rows: TableCell[][]           // Data rows
      footer?: TableCell[]          // Optional footer row
    }

    // Rendered output
    rendered: {
      html: string                  // Complete table HTML
      css: string                   // Scoped CSS for styling
    }

    // Metadata
    metadata: {
      columnCount: number
      rowCount: number
      columnTypes: ColumnType[]     // Detected/assigned types per column
      hasNumericData: boolean
      hasDateData: boolean
    }

    // Edit hints
    editInfo: {
      editableCells: boolean
      suggestedColumnWidths: number[]  // Percentage widths
    }
  }
  error?: {
    code: TableErrorCode
    message: string
    retryable: boolean
  }
}

interface TableCell {
  value: string | number | null
  displayValue: string              // Formatted for display
  type: CellType
  style?: CellStyle
  colspan?: number
  rowspan?: number
}

type CellType = 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'boolean' | 'empty'
type ColumnType = 'text' | 'numeric' | 'date' | 'mixed'

interface CellStyle {
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  backgroundColor?: string
  textColor?: string
}

type TableErrorCode =
  | 'INVALID_STRUCTURE'
  | 'GENERATION_FAILED'
  | 'DATA_INCONSISTENT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
```

---

### 2. Transform Table Data

Modify existing table structure or content.

```
POST /api/ai/table/transform
```

#### Request Schema

```typescript
interface TableTransformRequest {
  // Source data
  sourceTable: {
    headers: string[]
    rows: (string | number | null)[][]
  }

  // Transformation
  transformation: TableTransformation
  presentationId: string
  slideId: string
  elementId: string

  // Transformation-specific options
  options?: {
    // For 'add_column' / 'add_row'
    position?: number               // Insert position (0-indexed)
    content?: string                // Description of new content

    // For 'remove_column' / 'remove_row'
    index?: number                  // Which to remove

    // For 'sort'
    sortColumn?: number
    sortDirection?: 'asc' | 'desc'

    // For 'summarize'
    summaryType?: 'totals' | 'averages' | 'counts'

    // For 'expand'
    expandPrompt?: string           // What additional data to add
  }
}

type TableTransformation =
  | 'add_column'      // Add a new column with AI-generated data
  | 'add_row'         // Add a new row with AI-generated data
  | 'remove_column'   // Remove specified column
  | 'remove_row'      // Remove specified row
  | 'sort'            // Sort by column
  | 'summarize'       // Add summary row
  | 'transpose'       // Swap rows and columns
  | 'expand'          // Add more rows with similar data
  | 'merge_cells'     // Intelligent cell merging
  | 'split_column'    // Split column into multiple
```

---

### 3. Analyze Table Data

Get insights about table data.

```
POST /api/ai/table/analyze
```

#### Request Schema

```typescript
interface TableAnalyzeRequest {
  sourceTable: {
    headers: string[]
    rows: (string | number | null)[][]
  }
  analysisType: TableAnalysisType
  presentationId: string
  slideId: string
  elementId: string
}

type TableAnalysisType =
  | 'summary'         // Key statistics and insights
  | 'trends'          // Identify patterns
  | 'outliers'        // Find unusual values
  | 'visualization'   // Suggest best chart type
```

#### Response Schema

```typescript
interface TableAnalyzeResponse {
  success: boolean
  data?: {
    analysis: {
      summary: string               // Natural language summary
      keyInsights: string[]         // Bullet points
      statistics?: {
        [columnName: string]: {
          min?: number
          max?: number
          average?: number
          median?: number
          mode?: string | number
        }
      }
    }
    recommendations?: {
      suggestedChartType?: string
      suggestedHighlights?: number[] // Row indices to highlight
      suggestedSorting?: {
        column: number
        direction: 'asc' | 'desc'
      }
    }
  }
}
```

---

## Context-Aware Generation

### Slide Context Integration

The service receives contextual information to generate relevant content:

```typescript
interface SlideContext {
  // Position awareness
  slideIndex: number                // 0-based index
  slideCount: number                // Total slides
  isFirstSlide: boolean
  isLastSlide: boolean

  // Content awareness
  slideTitle: string
  slideType?: SlideType             // Detected slide purpose
  existingElements: ElementSummary[] // Other elements on slide

  // Flow awareness
  previousSlideTitle?: string
  previousSlideKeyPoints?: string[]
  nextSlideTitle?: string

  // Theme awareness
  brandTone?: string                // From presentation settings
  targetAudience?: string           // From presentation settings
}

type SlideType =
  | 'title'           // Title slide
  | 'agenda'          // Table of contents
  | 'content'         // Main content slide
  | 'comparison'      // Side-by-side comparison
  | 'data'            // Data/metrics focused
  | 'quote'           // Quote slide
  | 'section'         // Section divider
  | 'conclusion'      // Summary/closing
  | 'qa'              // Q&A slide

interface ElementSummary {
  elementId: string
  elementType: ElementType
  contentPreview: string            // First 100 chars
  position: { gridCol: number, gridRow: number }
}
```

### Contextual Prompting

The AI service constructs internal prompts using context:

```typescript
function buildTextPrompt(request: TextGenerateRequest): string {
  const ctx = request.context

  return `
    You are creating content for a presentation titled "${ctx.presentationTitle}".

    This is slide ${ctx.slideIndex + 1} of ${ctx.slideCount}.
    ${ctx.slideTitle ? `The slide title is: "${ctx.slideTitle}"` : ''}
    ${ctx.previousSlideContent ? `Previous slide covered: ${ctx.previousSlideContent}` : ''}
    ${ctx.nextSlideContent ? `Next slide will cover: ${ctx.nextSlideContent}` : ''}

    The content area is ${request.constraints.gridWidth} grid units wide
    and ${request.constraints.gridHeight} grid units tall.

    Generate content for: ${request.prompt}

    Tone: ${request.options?.tone || 'professional'}
    Format: ${request.options?.format || 'mixed'}
    ${request.constraints.maxCharacters ? `Maximum ${request.constraints.maxCharacters} characters.` : ''}
  `.trim()
}
```

---

## Content Sizing Guidelines

### Character Limits by Grid Size

Recommended content length based on element dimensions:

```typescript
const CONTENT_GUIDELINES = {
  // Grid width → max characters per line
  charactersPerLine: {
    1: 10,
    2: 20,
    3: 35,
    4: 50,
    5: 65,
    6: 80,
    7: 95,
    8: 110,
    9: 125,
    10: 140,
    11: 155,
    12: 170
  },

  // Grid height → max lines (at standard font size)
  linesPerHeight: {
    1: 2,
    2: 4,
    3: 6,
    4: 9,
    5: 11,
    6: 14,
    7: 16,
    8: 19
  },

  // Calculate max characters for element
  calculateMaxCharacters(gridWidth: number, gridHeight: number): number {
    const charsPerLine = this.charactersPerLine[gridWidth] || 170
    const lines = this.linesPerHeight[gridHeight] || 19
    return charsPerLine * lines * 0.85 // 85% fill factor
  }
}
```

### Table Sizing Guidelines

```typescript
const TABLE_GUIDELINES = {
  // Minimum column width by grid units
  minColumnWidthGrid: 1,

  // Maximum columns by element width
  maxColumnsByWidth: {
    4: 3,
    6: 5,
    8: 7,
    10: 8,
    12: 10
  },

  // Maximum rows by element height
  maxRowsByHeight: {
    2: 3,
    3: 5,
    4: 7,
    5: 9,
    6: 12,
    7: 14,
    8: 16
  },

  // Calculate optimal table dimensions
  calculateOptimalDimensions(
    gridWidth: number,
    gridHeight: number,
    requestedCols: number,
    requestedRows: number
  ): { columns: number, rows: number } {
    const maxCols = this.maxColumnsByWidth[gridWidth] || 10
    const maxRows = this.maxRowsByHeight[gridHeight] || 16

    return {
      columns: Math.min(requestedCols, maxCols),
      rows: Math.min(requestedRows, maxRows)
    }
  }
}
```

---

## Error Handling

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,

  // Error codes that should trigger retry
  retryableCodes: [
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
    'GENERATION_FAILED'  // Sometimes transient
  ],

  // Error codes that should not retry
  nonRetryableCodes: [
    'INVALID_PROMPT',
    'CONTEXT_MISSING',
    'CONTENT_FILTERED',
    'INVALID_STRUCTURE'
  ]
}
```

### Content Filtering

The service filters inappropriate content:

```typescript
interface ContentFilter {
  // Content that was filtered
  filteredContent: boolean

  // Reason for filtering
  filterReason?: 'inappropriate' | 'copyrighted' | 'harmful' | 'off_topic'

  // Suggested alternative prompt
  suggestedPrompt?: string
}
```

---

## Rate Limiting

### Per-User Limits

```typescript
const RATE_LIMITS = {
  text: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    tokensPerMinute: 50000
  },
  table: {
    requestsPerMinute: 20,
    requestsPerHour: 300,
    tokensPerMinute: 30000
  }
}
```

### Response Headers

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1699876543
```

---

## Caching Strategy

### Cache Keys

```typescript
// Text generation cache key
function textCacheKey(request: TextGenerateRequest): string {
  return hash({
    prompt: request.prompt,
    tone: request.options?.tone,
    format: request.options?.format,
    gridWidth: request.constraints.gridWidth,
    gridHeight: request.constraints.gridHeight,
    slideContext: request.context.slideContext
  })
}

// Table generation cache key
function tableCacheKey(request: TableGenerateRequest): string {
  return hash({
    prompt: request.prompt,
    columns: request.structure.columns,
    rows: request.structure.rows,
    style: request.style?.preset,
    slideContext: request.context.slideContext
  })
}
```

### Cache TTL

- Text generation: 1 hour
- Table generation: 1 hour
- Transformations: No caching (always fresh)

---

## Integration with Layout Service

### Request Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Layout Service  │────▶│ Text+Table AI    │
│   Panel      │     │  Orchestrator    │     │    Service       │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │  1. User prompt      │                        │
       │  2. Element ID       │                        │
       │                      │  3. Add context        │
       │                      │  4. Grid calculations  │
       │                      │  5. Forward request    │
       │                      │                        │
       │                      │◀───────────────────────│
       │                      │  6. Generated content  │
       │                      │                        │
       │◀─────────────────────│                        │
       │  7. Update element   │                        │
       │     with content     │                        │
```

### Layout Service Responsibilities

1. **Add Presentation Context**: Title, theme, slide position
2. **Add Slide Context**: Title, other elements, flow
3. **Calculate Grid Constraints**: Convert element dimensions to grid units
4. **Route to AI Service**: Forward enriched request
5. **Inject Response**: Update element content with generated result
6. **Handle Errors**: Display appropriate UI feedback

---

## Implementation Notes

### LLM Provider Abstraction

The service should support multiple LLM backends:

```typescript
interface LLMProvider {
  name: 'anthropic' | 'openai' | 'azure' | 'local'

  generateText(prompt: string, options: LLMOptions): Promise<string>

  streamText(prompt: string, options: LLMOptions): AsyncIterable<string>
}

interface LLMOptions {
  model: string
  temperature: number
  maxTokens: number
  stopSequences?: string[]
}
```

### Recommended Models

| Use Case | Recommended Model | Fallback |
|----------|-------------------|----------|
| Text generation | Claude 3.5 Sonnet | GPT-4 |
| Text transformation | Claude 3 Haiku | GPT-3.5 Turbo |
| Table generation | Claude 3.5 Sonnet | GPT-4 |
| Table analysis | Claude 3 Haiku | GPT-3.5 Turbo |

---

## Monitoring & Analytics

### Metrics to Track

```typescript
interface TextTableMetrics {
  // Request metrics
  totalRequests: number
  requestsByType: {
    textGenerate: number
    textTransform: number
    tableGenerate: number
    tableTransform: number
  }

  // Performance metrics
  averageLatencyMs: number
  p95LatencyMs: number

  // Quality metrics
  regenerationRate: number          // % of requests regenerated
  transformationRate: number        // % of content transformed after generation

  // Error metrics
  errorRate: number
  errorsByCode: Record<string, number>
}
```

### Logging

```typescript
interface RequestLog {
  requestId: string
  timestamp: Date
  userId: string
  presentationId: string
  slideId: string
  elementId: string
  requestType: string
  promptLength: number
  responseLength: number
  latencyMs: number
  success: boolean
  errorCode?: string
  llmModel: string
  tokensUsed: number
}
```
