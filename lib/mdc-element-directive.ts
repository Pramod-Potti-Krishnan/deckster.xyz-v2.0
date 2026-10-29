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
import { TEXTBOX_REQUEST_FIDELITY_ENABLED } from '@/lib/textbox-request-fidelity'
import { mdcElementFieldsPatch } from '@/lib/mdc-element-fields' // MDC-ELEMENT-FIELDS: the Director's icon_label_mode / label_text / shape_type (NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS, default off)

const BASE = {
  count: 1,
  layout: 'horizontal' as const,
  advancedModified: false,
  z_index: 1,
}

// A chat-invoked add names its own count in the prompt; Text Labs resolves it
// when the request carries no count (request fidelity flag).
const PROMPT_COUNT = TEXTBOX_REQUEST_FIDELITY_ENABLED ? { countAuto: true } : {}

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
      return { ...BASE, ...PROMPT_COUNT, prompt, componentType: 'TEXT_BOX', itemsPerInstance: 1, textboxConfig: {}, semanticRole: 'BODY_TEXT', geometryMode: 'AUTO' }
    case 'METRICS':
      return { ...BASE, ...PROMPT_COUNT, prompt, componentType: 'METRICS', metricsConfig: {}, metricsFitMode: 'AUTO' }
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
// MDC-ELEMENT-FIELDS: with NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS on, a valid icon_label_mode / label_text / shape_type on the directive payload sets the form data's iconLabelConfig / prompt / shapeConfig as the Element panel's own form does (lib/mdc-element-fields.ts); anything else, and the flag off, leave the form data as built above. Mutates and returns the object buildFormDataForDirective just made.
export function applyDirectiveElementFields(formData: TextLabsFormData, fields: unknown): TextLabsFormData { const patch = mdcElementFieldsPatch(formData.componentType, fields); if (patch) Object.assign(formData, patch); return formData } // MDC-ELEMENT-FIELDS
