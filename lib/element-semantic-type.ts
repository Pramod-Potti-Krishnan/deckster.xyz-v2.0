import type { TextLabsAllComponentType, TextLabsComponentType } from '@/types/textlabs'

const COMPONENT_TYPES = new Set<TextLabsComponentType>([
  'TEXT_BOX',
  'METRICS',
  'TABLE',
  'CHART',
  'IMAGE',
  'ICON_LABEL',
  'SHAPE',
  'INFOGRAPHIC',
  'DIAGRAM',
])

const DIAGRAM_SUBTYPES = new Set([
  'CODE_DISPLAY',
  'KANBAN_BOARD',
  'GANTT_CHART',
  'CHEVRON_MATURITY',
  'IDEA_BOARD',
  'CLOUD_ARCHITECTURE',
  'LOGICAL_ARCHITECTURE',
  'DATA_ARCHITECTURE',
  'CUSTOM',
])

export function normalizeSemanticComponentType(value: unknown): TextLabsComponentType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/[-\s]/g, '_')
  if (COMPONENT_TYPES.has(normalized as TextLabsComponentType)) {
    return normalized as TextLabsComponentType
  }
  if (DIAGRAM_SUBTYPES.has(normalized)) return 'DIAGRAM'

  switch (normalized) {
    case 'TEXT':
    case 'TEXTBOX':
      return 'TEXT_BOX'
    case 'ICON':
      return 'ICON_LABEL'
    default:
      return null
  }
}

export function semanticTypeForInsertion(value: TextLabsAllComponentType): TextLabsComponentType {
  return normalizeSemanticComponentType(value) ?? 'TEXT_BOX'
}
