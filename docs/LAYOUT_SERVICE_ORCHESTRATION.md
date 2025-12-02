# Layout Service AI Orchestration Layer

This document specifies the orchestration layer within the Layout Service that coordinates calls to AI services, handles grid calculations, and manages the flow of AI-generated content.

---

## 1. Architecture Overview

### 1.1 Orchestration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐       │
│  │ User selects │───▶│ User enters  │───▶│ Frontend sends       │       │
│  │ element area │    │ AI prompt    │    │ generation request   │       │
│  └──────────────┘    └──────────────┘    └───────────┬──────────┘       │
└───────────────────────────────────────────────────────┼─────────────────┘
                                                        │ postMessage
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LAYOUT SERVICE                                    │
│                                                                          │
│  ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────┐  │
│  │ 1. Parse Request  │───▶│ 2. Calculate Grid │───▶│ 3. Build AI     │  │
│  │    & Validate     │    │    Dimensions     │    │    Request      │  │
│  └───────────────────┘    └───────────────────┘    └────────┬────────┘  │
│                                                              │           │
│  ┌───────────────────┐    ┌───────────────────┐    ┌────────▼────────┐  │
│  │ 6. Inject into    │◀───│ 5. Transform      │◀───│ 4. Route to     │  │
│  │    Slide Element  │    │    Response       │    │    AI Service   │  │
│  └───────────────────┘    └───────────────────┘    └─────────────────┘  │
│           │                                                              │
│           ▼                                                              │
│  ┌───────────────────┐    ┌───────────────────┐                         │
│  │ 7. Save to DB     │───▶│ 8. Emit Update    │                         │
│  │                   │    │    Event          │                         │
│  └───────────────────┘    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/gRPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI SERVICES                                     │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Text+Table │  │  Image     │  │  Chart     │  │ Illustrator│        │
│  │  Service   │  │  Service   │  │  Service   │  │  Service   │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                                          │
│  ┌────────────┐                                                          │
│  │  Diagram   │                                                          │
│  │  Service   │                                                          │
│  └────────────┘                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Request Parser | Validate incoming request, extract element and prompt info |
| Grid Calculator | Convert element position/size to grid units |
| Request Builder | Construct AI service request with context |
| Service Router | Route to appropriate AI service based on element type |
| Response Transformer | Convert AI response to element format |
| Element Injector | Update element content on slide |
| Database Saver | Persist element state and AI metadata |
| Event Emitter | Notify frontend of updates |

---

## 2. Grid Dimension Calculation

### 2.1 Grid System Constants

```typescript
// Default grid configuration
const DEFAULT_GRID_CONFIG = {
  slideWidth: 1920,
  slideHeight: 1080,
  columns: 12,
  rows: 8,
  marginX: 40,      // px from slide edge
  marginY: 40,
  gutterX: 20,      // px between columns
  gutterY: 20
}

// Calculate grid unit size
function calculateGridUnitSize(config: GridConfig): { width: number, height: number } {
  const availableWidth = config.slideWidth - (config.marginX * 2) - (config.gutterX * (config.columns - 1))
  const availableHeight = config.slideHeight - (config.marginY * 2) - (config.gutterY * (config.rows - 1))

  return {
    width: availableWidth / config.columns,   // ~143px per column
    height: availableHeight / config.rows     // ~115px per row
  }
}
```

### 2.2 Element to Grid Conversion

```typescript
interface ElementPosition {
  x: number       // Percentage (0-100)
  y: number       // Percentage (0-100)
  width: number   // Percentage (0-100)
  height: number  // Percentage (0-100)
}

interface GridDimensions {
  gridX: number      // Starting column (0-based)
  gridY: number      // Starting row (0-based)
  gridWidth: number  // Number of columns spanned
  gridHeight: number // Number of rows spanned
}

function elementToGrid(
  element: ElementPosition,
  config: GridConfig = DEFAULT_GRID_CONFIG
): GridDimensions {
  // Convert percentage to pixels
  const pixelX = (element.x / 100) * config.slideWidth
  const pixelY = (element.y / 100) * config.slideHeight
  const pixelWidth = (element.width / 100) * config.slideWidth
  const pixelHeight = (element.height / 100) * config.slideHeight

  const gridUnit = calculateGridUnitSize(config)

  // Calculate grid position (accounting for margins and gutters)
  const gridX = Math.max(0, Math.floor((pixelX - config.marginX) / (gridUnit.width + config.gutterX)))
  const gridY = Math.max(0, Math.floor((pixelY - config.marginY) / (gridUnit.height + config.gutterY)))

  // Calculate grid span
  const gridWidth = Math.max(1, Math.round(pixelWidth / (gridUnit.width + config.gutterX)))
  const gridHeight = Math.max(1, Math.round(pixelHeight / (gridUnit.height + config.gutterY)))

  return {
    gridX: Math.min(gridX, config.columns - 1),
    gridY: Math.min(gridY, config.rows - 1),
    gridWidth: Math.min(gridWidth, config.columns - gridX),
    gridHeight: Math.min(gridHeight, config.rows - gridY)
  }
}
```

### 2.3 Grid to Pixel Conversion

```typescript
function gridToPixels(
  grid: GridDimensions,
  config: GridConfig = DEFAULT_GRID_CONFIG
): { x: number, y: number, width: number, height: number } {
  const gridUnit = calculateGridUnitSize(config)

  return {
    x: config.marginX + (grid.gridX * (gridUnit.width + config.gutterX)),
    y: config.marginY + (grid.gridY * (gridUnit.height + config.gutterY)),
    width: (grid.gridWidth * gridUnit.width) + ((grid.gridWidth - 1) * config.gutterX),
    height: (grid.gridHeight * gridUnit.height) + ((grid.gridHeight - 1) * config.gutterY)
  }
}
```

---

## 3. AI Service Routing

### 3.1 Service Registry

```typescript
interface AIServiceConfig {
  name: string
  baseUrl: string
  timeout: number     // ms
  retries: number
  healthCheck: string // Endpoint for health check
}

const AI_SERVICE_REGISTRY: Record<string, AIServiceConfig> = {
  'text-table': {
    name: 'Text + Table Service',
    baseUrl: process.env.TEXT_TABLE_SERVICE_URL || 'http://localhost:8001',
    timeout: 30000,
    retries: 3,
    healthCheck: '/health'
  },
  'image': {
    name: 'Image Generation Service',
    baseUrl: process.env.IMAGE_SERVICE_URL || 'http://localhost:8002',
    timeout: 60000,  // Longer timeout for image generation
    retries: 2,
    healthCheck: '/health'
  },
  'chart': {
    name: 'Chart Data Service',
    baseUrl: process.env.CHART_SERVICE_URL || 'http://localhost:8003',
    timeout: 30000,
    retries: 3,
    healthCheck: '/health'
  },
  'illustrator': {
    name: 'Illustrator Service (Infographics)',
    baseUrl: process.env.ILLUSTRATOR_SERVICE_URL || 'http://localhost:8004',
    timeout: 45000,
    retries: 2,
    healthCheck: '/health'
  },
  'diagram': {
    name: 'Diagram Service (Mermaid)',
    baseUrl: process.env.DIAGRAM_SERVICE_URL || 'http://localhost:8005',
    timeout: 30000,
    retries: 3,
    healthCheck: '/health'
  }
}
```

### 3.2 Element Type to Service Mapping

```typescript
type ElementType = 'textbox' | 'image' | 'table' | 'chart' | 'infographic' | 'diagram'

const ELEMENT_SERVICE_MAP: Record<ElementType, { service: string, endpoint: string }> = {
  'textbox': { service: 'text-table', endpoint: '/api/ai/text/generate' },
  'table':   { service: 'text-table', endpoint: '/api/ai/table/generate' },
  'image':   { service: 'image',      endpoint: '/api/ai/image/generate' },
  'chart':   { service: 'chart',      endpoint: '/api/ai/chart/generate' },
  'infographic': { service: 'illustrator', endpoint: '/api/ai/infographic/generate' },
  'diagram': { service: 'diagram',    endpoint: '/api/ai/diagram/generate' }
}

function getServiceForElement(elementType: ElementType): AIServiceConfig {
  const mapping = ELEMENT_SERVICE_MAP[elementType]
  return AI_SERVICE_REGISTRY[mapping.service]
}
```

---

## 4. Request Transformation

### 4.1 Incoming Request Format

```typescript
// Request from Frontend
interface AIGenerationRequest {
  // Identity
  presentationId: string
  slideId: string
  elementId: string
  elementType: ElementType

  // Position (for grid calculation)
  position: { x: number, y: number }      // Percentage
  size: { width: number, height: number } // Percentage

  // User Input
  prompt: string

  // Element-Specific Options
  options: ElementOptions
}

type ElementOptions =
  | TextOptions
  | TableOptions
  | ImageOptions
  | ChartOptions
  | InfographicOptions
  | DiagramOptions

interface TextOptions {
  tone?: 'professional' | 'casual' | 'persuasive' | 'technical'
  format?: 'paragraph' | 'bullets' | 'numbered'
  maxWords?: number
}

interface TableOptions {
  rows: number
  columns: number
  hasHeader: boolean
  dataType?: 'numeric' | 'text' | 'mixed'
}

interface ImageOptions {
  style: 'realistic' | 'illustration' | 'abstract' | 'minimal' | 'photo'
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16'
}

interface ChartOptions {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar' | 'polarArea'
  colorPalette: 'default' | 'professional' | 'vibrant' | 'pastel' | 'monochrome'
}

interface InfographicOptions {
  infographicType: 'timeline' | 'process' | 'comparison' | 'statistics' | 'hierarchy' | 'list' | 'cycle' | 'pyramid' | 'matrix' | 'venn' | 'funnel' | 'roadmap'
  iconStyle?: 'outline' | 'filled' | 'duotone'
}

interface DiagramOptions {
  diagramType: 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'gantt' | 'userjourney' | 'gitgraph' | 'mindmap' | 'pie' | 'timeline'
  direction: 'TB' | 'BT' | 'LR' | 'RL'
  theme: 'default' | 'forest' | 'dark' | 'neutral'
}
```

### 4.2 Context Enrichment

```typescript
interface PresentationContext {
  presentationId: string
  presentationTitle: string
  presentationTheme: string
  slideIndex: number
  slideTitle?: string
  slideTopic?: string
  previousSlidesSummary?: string  // For consistency
  brandColors?: string[]
  brandFonts?: string[]
}

async function enrichWithContext(
  request: AIGenerationRequest
): Promise<PresentationContext> {
  // Fetch presentation metadata from database
  const presentation = await db.presentations.findById(request.presentationId)
  const slide = await db.slides.findById(request.slideId)

  // Get previous slides for context
  const previousSlides = await db.slides.findMany({
    presentationId: request.presentationId,
    index: { lt: slide.index }
  })

  return {
    presentationId: presentation.id,
    presentationTitle: presentation.title,
    presentationTheme: presentation.theme || 'professional',
    slideIndex: slide.index,
    slideTitle: slide.title,
    slideTopic: slide.topic,
    previousSlidesSummary: summarizePreviousSlides(previousSlides),
    brandColors: presentation.brandColors,
    brandFonts: presentation.brandFonts
  }
}
```

### 4.3 Outgoing AI Service Request

```typescript
interface AIServiceRequest {
  // Core
  prompt: string
  elementType: string

  // Grid Dimensions (calculated)
  dimensions: {
    gridWidth: number
    gridHeight: number
    pixelWidth: number
    pixelHeight: number
  }

  // Context
  context: PresentationContext

  // Element-Specific
  options: ElementOptions

  // Request Metadata
  requestId: string
  timestamp: string
}

function buildAIServiceRequest(
  incomingRequest: AIGenerationRequest,
  context: PresentationContext
): AIServiceRequest {
  // Calculate grid dimensions
  const gridDimensions = elementToGrid({
    x: incomingRequest.position.x,
    y: incomingRequest.position.y,
    width: incomingRequest.size.width,
    height: incomingRequest.size.height
  })

  const pixelDimensions = gridToPixels(gridDimensions)

  return {
    prompt: incomingRequest.prompt,
    elementType: incomingRequest.elementType,
    dimensions: {
      gridWidth: gridDimensions.gridWidth,
      gridHeight: gridDimensions.gridHeight,
      pixelWidth: pixelDimensions.width,
      pixelHeight: pixelDimensions.height
    },
    context,
    options: incomingRequest.options,
    requestId: generateUUID(),
    timestamp: new Date().toISOString()
  }
}
```

---

## 5. Response Handling

### 5.1 AI Service Response Format

```typescript
// Generic AI Service Response
interface AIServiceResponse {
  success: boolean
  requestId: string
  generationId: string  // For regeneration/variations

  // Content (varies by element type)
  content: ElementContent

  // Metadata
  processingTime: number  // ms
  tokensUsed?: number
  modelVersion?: string
}

type ElementContent =
  | TextContent
  | TableContent
  | ImageContent
  | ChartContent
  | InfographicContent
  | DiagramContent

interface TextContent {
  html: string
  css?: string
  js?: string
  wordCount: number
}

interface TableContent {
  headers: string[]
  data: string[][]
  suggestedStyle: string
}

interface ImageContent {
  url: string
  thumbnailUrl: string
  width: number
  height: number
  altText: string
}

interface ChartContent {
  chartConfig: ChartJSConfig  // Full Chart.js configuration
}

interface InfographicContent {
  svgContent: string
  items: InfographicItem[]
}

interface DiagramContent {
  mermaidCode: string
  svgContent: string
  diagramType: string
}
```

### 5.2 Response Validation

```typescript
function validateAIResponse(
  response: AIServiceResponse,
  elementType: ElementType
): ValidationResult {
  const errors: string[] = []

  // Check basic structure
  if (!response.success) {
    return { valid: false, errors: ['AI service returned failure'] }
  }

  if (!response.content) {
    errors.push('Missing content in response')
  }

  // Element-specific validation
  switch (elementType) {
    case 'textbox':
      if (!response.content.html) errors.push('Missing HTML content')
      break
    case 'table':
      if (!response.content.data) errors.push('Missing table data')
      if (!response.content.headers) errors.push('Missing table headers')
      break
    case 'image':
      if (!response.content.url) errors.push('Missing image URL')
      break
    case 'chart':
      if (!response.content.chartConfig) errors.push('Missing chart config')
      break
    case 'infographic':
      if (!response.content.svgContent) errors.push('Missing SVG content')
      break
    case 'diagram':
      if (!response.content.mermaidCode && !response.content.svgContent) {
        errors.push('Missing diagram content')
      }
      break
  }

  return { valid: errors.length === 0, errors }
}
```

### 5.3 Response Transformation

```typescript
interface ElementUpdate {
  elementId: string
  content: Record<string, any>  // Element-specific content for DB
  renderData: any               // Data for immediate rendering
}

function transformResponse(
  response: AIServiceResponse,
  elementType: ElementType,
  elementId: string
): ElementUpdate {
  switch (elementType) {
    case 'textbox':
      return {
        elementId,
        content: {
          html: response.content.html,
          css: response.content.css,
          js: response.content.js
        },
        renderData: response.content.html
      }

    case 'table':
      return {
        elementId,
        content: {
          headers: response.content.headers,
          data: response.content.data,
          style: response.content.suggestedStyle
        },
        renderData: generateTableHTML(response.content)
      }

    case 'image':
      return {
        elementId,
        content: {
          url: response.content.url,
          thumbnailUrl: response.content.thumbnailUrl,
          altText: response.content.altText
        },
        renderData: { src: response.content.url }
      }

    case 'chart':
      return {
        elementId,
        content: {
          chartConfig: response.content.chartConfig
        },
        renderData: response.content.chartConfig
      }

    case 'infographic':
      return {
        elementId,
        content: {
          svgContent: response.content.svgContent,
          items: response.content.items
        },
        renderData: response.content.svgContent
      }

    case 'diagram':
      return {
        elementId,
        content: {
          mermaidCode: response.content.mermaidCode,
          svgContent: response.content.svgContent
        },
        renderData: response.content.svgContent
      }
  }
}
```

---

## 6. Error Handling

### 6.1 Error Types

```typescript
enum AIOrchestrationError {
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_TIMEOUT = 'SERVICE_TIMEOUT',
  GENERATION_FAILED = 'GENERATION_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMITED = 'RATE_LIMITED',
  CONTENT_POLICY = 'CONTENT_POLICY',  // Content moderation failure
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN = 'UNKNOWN'
}

interface OrchestrationError {
  code: AIOrchestrationError
  message: string
  details?: Record<string, any>
  retryable: boolean
  retryAfter?: number  // ms
}
```

### 6.2 Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number
  initialDelay: number   // ms
  maxDelay: number       // ms
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error
  let delay = config.initialDelay

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isRetryable(error) || attempt === config.maxRetries) {
        throw error
      }

      // Exponential backoff
      await sleep(delay)
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
    }
  }

  throw lastError
}

function isRetryable(error: any): boolean {
  // Retry on network errors, timeouts, 5xx errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true
  if (error.status >= 500 && error.status < 600) return true
  if (error.code === AIOrchestrationError.SERVICE_TIMEOUT) return true
  if (error.code === AIOrchestrationError.RATE_LIMITED) return true
  return false
}
```

### 6.3 Fallback Behavior

```typescript
interface FallbackStrategy {
  type: 'placeholder' | 'cached' | 'error_display'
  data?: any
}

function getFallbackStrategy(elementType: ElementType): FallbackStrategy {
  switch (elementType) {
    case 'textbox':
      return {
        type: 'placeholder',
        data: { html: '<p>Text generation failed. Please try again.</p>' }
      }

    case 'image':
      return {
        type: 'placeholder',
        data: { url: '/placeholders/image-error.svg' }
      }

    case 'table':
      return {
        type: 'placeholder',
        data: { html: '<table><tr><td>Unable to generate table</td></tr></table>' }
      }

    case 'chart':
      return {
        type: 'placeholder',
        data: { message: 'Chart generation failed' }
      }

    case 'infographic':
      return {
        type: 'placeholder',
        data: { svgContent: '<svg><text>Infographic generation failed</text></svg>' }
      }

    case 'diagram':
      return {
        type: 'placeholder',
        data: { svgContent: '<svg><text>Diagram generation failed</text></svg>' }
      }
  }
}
```

---

## 7. Progress Updates

### 7.1 Progress Event Types

```typescript
interface ProgressUpdate {
  requestId: string
  elementId: string
  status: ProgressStatus
  progress: number       // 0-100
  message: string
  estimatedTime?: number // ms remaining
}

type ProgressStatus =
  | 'queued'
  | 'processing'
  | 'generating'
  | 'rendering'
  | 'complete'
  | 'failed'
```

### 7.2 WebSocket Progress Channel

```typescript
// WebSocket message format
interface WSProgressMessage {
  type: 'AI_GENERATION_PROGRESS'
  payload: ProgressUpdate
}

// Server-side progress emitter
class ProgressEmitter {
  private ws: WebSocket

  emit(update: ProgressUpdate): void {
    this.ws.send(JSON.stringify({
      type: 'AI_GENERATION_PROGRESS',
      payload: update
    }))
  }

  // Standard progress updates
  queued(requestId: string, elementId: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'queued',
      progress: 0,
      message: 'Request queued for processing'
    })
  }

  processing(requestId: string, elementId: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'processing',
      progress: 25,
      message: 'Processing your request...'
    })
  }

  generating(requestId: string, elementId: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'generating',
      progress: 50,
      message: 'AI is generating content...',
      estimatedTime: 10000
    })
  }

  rendering(requestId: string, elementId: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'rendering',
      progress: 75,
      message: 'Rendering result...'
    })
  }

  complete(requestId: string, elementId: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'complete',
      progress: 100,
      message: 'Generation complete!'
    })
  }

  failed(requestId: string, elementId: string, error: string): void {
    this.emit({
      requestId,
      elementId,
      status: 'failed',
      progress: 0,
      message: error
    })
  }
}
```

---

## 8. Main Orchestrator Implementation

### 8.1 Orchestrator Class

```typescript
class AIOrchestrator {
  private serviceRegistry: Map<string, AIServiceConfig>
  private db: Database
  private progressEmitter: ProgressEmitter
  private httpClient: HTTPClient

  constructor(deps: OrchestratorDeps) {
    this.serviceRegistry = new Map(Object.entries(AI_SERVICE_REGISTRY))
    this.db = deps.db
    this.progressEmitter = deps.progressEmitter
    this.httpClient = deps.httpClient
  }

  async generateContent(request: AIGenerationRequest): Promise<ElementUpdate> {
    const requestId = generateUUID()

    try {
      // 1. Emit queued status
      this.progressEmitter.queued(requestId, request.elementId)

      // 2. Validate request
      this.validateRequest(request)

      // 3. Enrich with context
      this.progressEmitter.processing(requestId, request.elementId)
      const context = await enrichWithContext(request)

      // 4. Build AI service request
      const aiRequest = buildAIServiceRequest(request, context)

      // 5. Route to AI service
      this.progressEmitter.generating(requestId, request.elementId)
      const serviceConfig = getServiceForElement(request.elementType)
      const endpoint = ELEMENT_SERVICE_MAP[request.elementType].endpoint

      const response = await executeWithRetry(
        () => this.callAIService(serviceConfig, endpoint, aiRequest)
      )

      // 6. Validate response
      const validation = validateAIResponse(response, request.elementType)
      if (!validation.valid) {
        throw new Error(`Invalid AI response: ${validation.errors.join(', ')}`)
      }

      // 7. Transform response
      this.progressEmitter.rendering(requestId, request.elementId)
      const elementUpdate = transformResponse(response, request.elementType, request.elementId)

      // 8. Save to database
      await this.saveElementContent(request, elementUpdate, response)

      // 9. Emit complete
      this.progressEmitter.complete(requestId, request.elementId)

      return elementUpdate

    } catch (error) {
      this.progressEmitter.failed(requestId, request.elementId, error.message)

      // Apply fallback strategy
      const fallback = getFallbackStrategy(request.elementType)
      return {
        elementId: request.elementId,
        content: fallback.data,
        renderData: fallback.data,
        error: true
      }
    }
  }

  private async callAIService(
    config: AIServiceConfig,
    endpoint: string,
    request: AIServiceRequest
  ): Promise<AIServiceResponse> {
    const url = `${config.baseUrl}${endpoint}`

    const response = await this.httpClient.post(url, request, {
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': request.requestId
      }
    })

    return response.data as AIServiceResponse
  }

  private async saveElementContent(
    request: AIGenerationRequest,
    update: ElementUpdate,
    aiResponse: AIServiceResponse
  ): Promise<void> {
    await this.db.presentationElements.upsert({
      where: { id: request.elementId },
      update: {
        content: update.content,
        ai_prompt: request.prompt,
        ai_generation_id: aiResponse.generationId,
        ai_service_used: ELEMENT_SERVICE_MAP[request.elementType].service,
        updated_at: new Date()
      },
      create: {
        id: request.elementId,
        presentation_id: request.presentationId,
        slide_id: request.slideId,
        element_type: request.elementType,
        position_x: request.position.x,
        position_y: request.position.y,
        width: request.size.width,
        height: request.size.height,
        content: update.content,
        ai_prompt: request.prompt,
        ai_generation_id: aiResponse.generationId,
        ai_service_used: ELEMENT_SERVICE_MAP[request.elementType].service
      }
    })
  }

  private validateRequest(request: AIGenerationRequest): void {
    if (!request.presentationId) throw new Error('Missing presentationId')
    if (!request.slideId) throw new Error('Missing slideId')
    if (!request.elementId) throw new Error('Missing elementId')
    if (!request.prompt?.trim()) throw new Error('Missing prompt')
    if (!ELEMENT_SERVICE_MAP[request.elementType]) {
      throw new Error(`Invalid element type: ${request.elementType}`)
    }
  }
}
```

---

## 9. Health Monitoring

### 9.1 Service Health Checks

```typescript
interface ServiceHealth {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number  // ms
  lastCheck: Date
  errorRate: number  // 0-1
}

async function checkServiceHealth(config: AIServiceConfig): Promise<ServiceHealth> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${config.baseUrl}${config.healthCheck}`, {
      timeout: 5000
    })

    return {
      service: config.name,
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - startTime,
      lastCheck: new Date(),
      errorRate: 0
    }
  } catch (error) {
    return {
      service: config.name,
      status: 'unhealthy',
      latency: Date.now() - startTime,
      lastCheck: new Date(),
      errorRate: 1
    }
  }
}

// Periodic health check (every 30 seconds)
async function startHealthMonitoring(): Promise<void> {
  setInterval(async () => {
    const healthStatuses = await Promise.all(
      Object.values(AI_SERVICE_REGISTRY).map(checkServiceHealth)
    )

    // Log or report health statuses
    for (const status of healthStatuses) {
      if (status.status !== 'healthy') {
        console.warn(`AI Service ${status.service} is ${status.status}`)
      }
    }
  }, 30000)
}
```

---

## 10. Rate Limiting

### 10.1 Rate Limit Configuration

```typescript
interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  concurrentRequests: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'image': {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    concurrentRequests: 3
  },
  'text-table': {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    concurrentRequests: 10
  },
  'chart': {
    requestsPerMinute: 20,
    requestsPerHour: 300,
    concurrentRequests: 5
  },
  'illustrator': {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    concurrentRequests: 3
  },
  'diagram': {
    requestsPerMinute: 20,
    requestsPerHour: 300,
    concurrentRequests: 5
  }
}
```

### 10.2 Rate Limiter Implementation

```typescript
class RateLimiter {
  private counters: Map<string, { count: number, resetAt: Date }>

  async checkLimit(service: string, userId: string): Promise<boolean> {
    const key = `${service}:${userId}`
    const config = RATE_LIMITS[service]

    const counter = this.counters.get(key)
    if (!counter || counter.resetAt < new Date()) {
      this.counters.set(key, { count: 1, resetAt: addMinutes(new Date(), 1) })
      return true
    }

    if (counter.count >= config.requestsPerMinute) {
      return false
    }

    counter.count++
    return true
  }
}
```
