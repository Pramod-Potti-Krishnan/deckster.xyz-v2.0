import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock AI Diagram Generation API
 *
 * TODO: Replace with actual AI diagram generation service
 */

// Mermaid templates for different diagram types
const DIAGRAM_TEMPLATES: Record<string, (prompt: string, direction: string) => string> = {
  flowchart: (prompt, direction) => `
graph ${direction}
    A[Start: ${prompt.slice(0, 20)}] --> B{Decision}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[Sub-process]
    D --> E
    E --> F[End]
  `,

  sequence: (prompt, direction) => `
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Database

    User->>Frontend: ${prompt.slice(0, 25)}
    Frontend->>API: Request
    API->>Database: Query
    Database-->>API: Result
    API-->>Frontend: Response
    Frontend-->>User: Display
  `,

  class: (prompt, direction) => `
classDiagram
    class BaseClass {
        +String id
        +create()
        +update()
        +delete()
    }
    class ${sanitizeClassName(prompt)} {
        +String name
        +String type
        +process()
    }
    class Handler {
        +handle()
        +validate()
    }
    BaseClass <|-- ${sanitizeClassName(prompt)}
    ${sanitizeClassName(prompt)} --> Handler
  `,

  state: (prompt, direction) => `
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Validating: Process Complete
    Validating --> Success: Valid
    Validating --> Error: Invalid
    Success --> [*]
    Error --> Idle: Retry
  `,

  er: (prompt, direction) => `
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "included in"
    USER {
        string id PK
        string name
        string email
    }
    ORDER {
        string id PK
        date created
        string status
    }
    PRODUCT {
        string id PK
        string name
        float price
    }
  `,

  gantt: (prompt, direction) => `
gantt
    title ${prompt.slice(0, 30)}
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements           :a1, 2024-01-01, 7d
    Design                :a2, after a1, 5d
    section Development
    Implementation        :b1, after a2, 14d
    Testing               :b2, after b1, 7d
    section Deployment
    Deploy                :c1, after b2, 3d
  `,

  mindmap: (prompt, direction) => `
mindmap
  root((${prompt.slice(0, 20)}))
    Origins
      Long history
      Popularization
    Research
      On effectiveness
      On Automatic creation
    Tools
      Pen and paper
      Mermaid
    Applications
      Creative techniques
      Strategic planning
  `,

  timeline: (prompt, direction) => `
timeline
    title ${prompt.slice(0, 30)}
    2024-01 : Phase 1 : Planning
    2024-02 : Phase 2 : Development
    2024-03 : Phase 3 : Testing
    2024-04 : Phase 4 : Launch
  `,

  pie: (prompt, direction) => `
pie title ${prompt.slice(0, 30)}
    "Category A" : 35
    "Category B" : 25
    "Category C" : 20
    "Category D" : 15
    "Other" : 5
  `,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, type = 'flowchart', direction = 'TB', theme = 'default', elementId } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get template generator
    const generator = DIAGRAM_TEMPLATES[type] || DIAGRAM_TEMPLATES.flowchart
    const mermaidCode = generator(prompt, direction).trim()

    console.log(`[AI Diagram] Generated ${type} for: "${prompt.slice(0, 50)}..."`)

    return NextResponse.json({
      success: true,
      result: {
        mermaidCode,
        type,
        direction,
        theme,
        prompt
      }
    })
  } catch (error) {
    console.error('[AI Diagram] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate diagram' },
      { status: 500 }
    )
  }
}

function sanitizeClassName(text: string): string {
  // Convert to valid Mermaid class name
  return text
    .slice(0, 15)
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[0-9]/, 'C') || 'MyClass'
}
