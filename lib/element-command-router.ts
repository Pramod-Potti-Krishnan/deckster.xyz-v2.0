/**
 * Element Command Router
 *
 * Routes element commands to either:
 * 1. Layout Service (iframe) - for direct element manipulation
 * 2. Elementor API - for AI content generation (auto-injects into Layout Service)
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

  // Content updates (manual updates, not from AI)
  'updateImageSource',
  'updateChartConfig',
  'setChartHtml',
  'updateInfographicContent',
  'updateDiagramSvg',
  'updateDiagramMermaid',
  'updateTableData',

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

  // Slide refresh
  'refreshSlide',
  'goToSlide',

  // UI toggle commands
  'toggleBorderHighlight',
])

// AI generation commands that go to Elementor
// Elementor auto-injects content into Layout Service, so no resultCommand needed
export const ELEMENTOR_COMMANDS = new Set([
  'generateImage',
  'generateChartData',
  'generateInfographic',
  'generateDiagram',
  'generateTableData',
  'generateText',
])

/**
 * Determines if a command should go to Layout Service or Elementor
 */
export function getCommandType(action: string): 'layout-service' | 'elementor' | 'unknown' {
  if (LAYOUT_SERVICE_COMMANDS.has(action)) {
    return 'layout-service'
  }
  if (ELEMENTOR_COMMANDS.has(action)) {
    return 'elementor'
  }
  return 'unknown'
}

/**
 * Checks if a command is an AI generation command
 */
export function isElementorCommand(action: string): boolean {
  return ELEMENTOR_COMMANDS.has(action)
}
