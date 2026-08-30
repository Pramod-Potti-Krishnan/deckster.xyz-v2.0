/**
 * MDC K5 — element_directive execution (P8, plan §6.5 / A6).
 *
 * Builds a minimal TextLabsFormData for a chat-invoked element so the
 * directive runs through the SAME pipeline as the element panel
 * (useTextLabsGeneration.handleGenerate) — capability parity by construction.
 * v1 supports the simple panel types; unsupported types return null and the
 * FE reports 'failed' so the Director answers honestly.
 */

import type { TextLabsFormData } from '@/types/textlabs'

const BASE = {
  count: 1,
  layout: 'horizontal' as const,
  advancedModified: false,
  z_index: 1,
}

/** Directive element types executable headless in v1. */
export const DIRECTIVE_TYPES = [
  'TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE',
] as const

export function buildFormDataForDirective(
  elementType: string,
  prompt: string,
): TextLabsFormData | null {
  switch (elementType) {
    case 'TEXT_BOX':
      // semanticRole/geometryMode became required upstream — mirror the panel's
      // defaults (BODY_TEXT + AUTO) for chat-invoked adds.
      return { ...BASE, prompt, componentType: 'TEXT_BOX', itemsPerInstance: 1, textboxConfig: {}, semanticRole: 'BODY_TEXT', geometryMode: 'AUTO' }
    case 'METRICS':
      return { ...BASE, prompt, componentType: 'METRICS', metricsConfig: {}, metricsFitMode: 'AUTO' }
    case 'TABLE':
      return { ...BASE, prompt, componentType: 'TABLE', tableConfig: {} }
    case 'CHART':
      return { ...BASE, prompt, componentType: 'CHART', chartConfig: {} }
    case 'IMAGE':
      return { ...BASE, prompt, componentType: 'IMAGE', imageConfig: {} }
    case 'ICON_LABEL':
      return { ...BASE, prompt, componentType: 'ICON_LABEL', iconLabelConfig: {} }
    case 'SHAPE':
      return { ...BASE, prompt, componentType: 'SHAPE', shapeConfig: {} }
    default:
      return null
  }
}
