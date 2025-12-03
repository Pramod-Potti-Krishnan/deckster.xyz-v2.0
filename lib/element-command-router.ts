/**
 * Element Command Router
 *
 * Routes element commands to either:
 * 1. Layout Service (iframe) - for direct element manipulation
 * 2. AI Backend APIs - for content generation, then injects result into Layout Service
 */

// Commands that go directly to Layout Service iframe
export const LAYOUT_SERVICE_COMMANDS = new Set([
  // Element insertion
  'insertImage',
  'insertChart',
  'insertInfographic',
  'insertDiagram',
  'insertTextBox',
  'insertTable',
  'insertShape',

  // Content updates (after AI generation)
  'updateImageSource',
  'updateChartConfig',
  'setChartHtml',
  'updateInfographicContent',
  'updateDiagramSvg',
  'updateDiagramMermaid',

  // Element management
  'deleteElement',
  'deleteTextBox',

  // Chart-specific
  'setChartType',
  'setChartColors',

  // Table-specific
  'resizeTable',
  'setTableHeaderStyle',

  // Diagram-specific
  'setDiagramTheme',

  // Arrange/layout commands
  'bringToFront',
  'sendToBack',
  'bringForward',
  'sendBackward',
  'resizeElement',
  'positionElement',
  'rotateElement',
  'flipElement',
  'lockElement',
  'groupElements',
  'ungroupElements',
  'alignElement',
])

// AI generation commands that need backend API call first
export interface AICommandMapping {
  apiEndpoint: string
  resultCommand: string
  transformResult: (data: any) => Record<string, any>
}

export const AI_GENERATION_COMMANDS: Record<string, AICommandMapping> = {
  'generateImage': {
    apiEndpoint: '/api/ai/image',
    resultCommand: 'updateImageSource',
    transformResult: (data) => ({
      imageUrl: data.imageUrl,
      alt: data.alt
    })
  },
  'generateChartData': {
    apiEndpoint: '/api/ai/chart',
    resultCommand: 'updateChartConfig',
    transformResult: (data) => ({
      chartConfig: data.chartConfig
    })
  },
  'generateInfographic': {
    apiEndpoint: '/api/ai/infographic',
    resultCommand: 'updateInfographicContent',
    transformResult: (data) => ({
      svgContent: data.svgContent
    })
  },
  'generateDiagram': {
    apiEndpoint: '/api/ai/diagram',
    resultCommand: 'updateDiagramMermaid',
    transformResult: (data) => ({
      mermaidCode: data.mermaidCode
    })
  },
  'generateTableData': {
    apiEndpoint: '/api/ai/table',
    resultCommand: 'updateTableData',
    transformResult: (data) => ({
      tableHtml: data.tableHtml
    })
  }
}

/**
 * Determines if a command should go to Layout Service or AI backend
 */
export function getCommandType(action: string): 'layout-service' | 'ai-generation' | 'unknown' {
  if (LAYOUT_SERVICE_COMMANDS.has(action)) {
    return 'layout-service'
  }
  if (action in AI_GENERATION_COMMANDS) {
    return 'ai-generation'
  }
  return 'unknown'
}

/**
 * Gets the AI command mapping for a generation command
 */
export function getAICommandMapping(action: string): AICommandMapping | null {
  return AI_GENERATION_COMMANDS[action] || null
}
