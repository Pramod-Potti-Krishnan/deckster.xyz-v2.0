import type { ElementGenerationContext, TextLabsAllComponentType } from '@/types/textlabs'

const MAX_ELEMENTS = 100
const MAX_SUMMARY_CHARS = 800
const MAX_REFERENCE_STRING_CHARS = 1600
const MAX_REFERENCE_ARRAY_ITEMS = 40
const MAX_REFERENCE_DEPTH = 5

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedReference(value: unknown, depth = 0): unknown {
  if (depth >= MAX_REFERENCE_DEPTH) return undefined
  if (typeof value === 'string') return value.slice(0, MAX_REFERENCE_STRING_CHARS)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_REFERENCE_ARRAY_ITEMS)
      .map(item => boundedReference(item, depth + 1))
      .filter(item => item !== undefined)
  }
  const record = asRecord(value)
  if (!record) return undefined
  return Object.fromEntries(
    Object.entries(record)
      .slice(0, MAX_REFERENCE_ARRAY_ITEMS)
      .map(([key, item]) => [key.slice(0, 100), boundedReference(item, depth + 1)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  )
}

export function parseSlideGenerationContext(
  response: unknown,
  expectedSlideIndex: number,
): Record<string, unknown> {
  const root = asRecord(response)
  if (!root || root.success !== true) {
    throw new Error('Invalid live slide context response')
  }
  const slideIndex = Number(root.slide_index ?? root.slideIndex)
  if (!Number.isInteger(slideIndex) || slideIndex !== expectedSlideIndex) {
    throw new Error('Live slide context returned a different slide')
  }
  if (!Array.isArray(root.elements)) {
    throw new Error('Live slide context is missing its elements')
  }

  const elements = root.elements.slice(0, MAX_ELEMENTS).map(raw => {
    const element = asRecord(raw) || {}
    const summary = typeof element.summary === 'string'
      ? element.summary.slice(0, MAX_SUMMARY_CHARS)
      : ''
    return {
      element_id: typeof element.element_id === 'string' ? element.element_id : null,
      renderer_type: typeof element.renderer_type === 'string' ? element.renderer_type : null,
      component_type: typeof element.component_type === 'string' ? element.component_type : null,
      position: boundedReference(element.position),
      summary,
      properties: boundedReference(element.properties),
      is_target: element.is_target === true,
    }
  })

  return {
    slide_index: slideIndex,
    slide_title: typeof root.slide_title === 'string'
      ? root.slide_title.slice(0, MAX_SUMMARY_CHARS)
      : '',
    slide_summary: typeof root.slide_summary === 'string'
      ? root.slide_summary.slice(0, MAX_SUMMARY_CHARS)
      : '',
    target_element_id: typeof root.target_element_id === 'string' ? root.target_element_id : null,
    elements,
    truncated: root.truncated === true || root.elements.length > MAX_ELEMENTS,
  }
}

export function buildElementGenerationContext(
  userPrompt: string,
  componentType: TextLabsAllComponentType,
  slide: Record<string, unknown>,
  deck?: Record<string, unknown> | null,
): ElementGenerationContext {
  return {
    generation_intent: {
      // Deliberately never truncate or synthesize the core user instruction.
      user_prompt: userPrompt,
      component_type: componentType,
    },
    reference_context: {
      slide: (boundedReference(slide) as Record<string, unknown> | null | undefined) ?? null,
      deck: (boundedReference(deck) as Record<string, unknown> | null | undefined) ?? null,
    },
  }
}
