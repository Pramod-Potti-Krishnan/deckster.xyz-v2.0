import type {
  ElementResearchMode,
  TextLabsAllComponentType,
  TextLabsDiagramRequestType,
} from '@/types/textlabs'

export const FAST_ELEMENT_GENERATION_TIMEOUT_MS = 30_000
export const PLANNED_ELEMENT_GENERATION_TIMEOUT_MS = 150_000
export const INFOGRAPHIC_GENERATION_TIMEOUT_MS = 300_000

const DIAGRAM_SUBTYPES = new Set<TextLabsDiagramRequestType>([
  'CODE_DISPLAY',
  'KANBAN_BOARD',
  'GANTT_CHART',
  'CHEVRON_MATURITY',
  'IDEA_BOARD',
  'CLOUD_ARCHITECTURE',
  'LOGICAL_ARCHITECTURE',
  'DATA_ARCHITECTURE',
  'CUSTOM',
  'DIAGRAM_AUTO',
])

export function isDiagramGenerationType(
  componentType: TextLabsAllComponentType,
): boolean {
  return DIAGRAM_SUBTYPES.has(componentType as TextLabsDiagramRequestType)
}

/**
 * Client abort budget for one Text Labs request.
 *
 * Diagram generation may perform bounded structured planning even when the
 * user has not enabled Research, so it must not inherit the short deterministic
 * element timeout. This remains a client safety ceiling; downstream services
 * retain their own tighter per-call timeouts.
 */
export function resolveElementGenerationTimeoutMs(
  componentType: TextLabsAllComponentType,
  researchMode: ElementResearchMode,
): number {
  if (componentType === 'INFOGRAPHIC') return INFOGRAPHIC_GENERATION_TIMEOUT_MS
  if (isDiagramGenerationType(componentType)) return PLANNED_ELEMENT_GENERATION_TIMEOUT_MS
  return researchMode === 'off'
    ? FAST_ELEMENT_GENERATION_TIMEOUT_MS
    : PLANNED_ELEMENT_GENERATION_TIMEOUT_MS
}
