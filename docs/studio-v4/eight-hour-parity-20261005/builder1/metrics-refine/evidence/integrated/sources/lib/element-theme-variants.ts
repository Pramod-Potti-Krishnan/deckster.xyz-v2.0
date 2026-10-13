import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import type { TextLabsComponentType } from '@/types/textlabs'

export interface ElementThemeAssignment {
  slotIndex: number
  componentType: TextLabsComponentType
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
}

const THEME_VARIANT_COMPONENT_TYPES = new Set<TextLabsComponentType>(['TEXT_BOX', 'METRICS'])

export function componentSupportsThemeVariants(value: unknown): boolean {
  const componentType = normalizeSemanticComponentType(value)
  return componentType !== null && THEME_VARIANT_COMPONENT_TYPES.has(componentType)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function parseElementThemeAssignments(
  response: unknown,
  expectedType: TextLabsComponentType,
  expectedCount: number,
): ElementThemeAssignment[] {
  const root = asRecord(response)
  if (!root || root.success !== true || !Array.isArray(root.assignments)) {
    throw new Error('Invalid theme variant assignment response')
  }

  const assignments = root.assignments.map((raw, index) => {
    const assignment = asRecord(raw)
    const slotIndex = Number(assignment?.slot_index)
    const componentType = normalizeSemanticComponentType(assignment?.component_type)
    const rawBindings = asRecord(assignment?.theme_bindings)
    const themeBindings = rawBindings
      ? Object.fromEntries(
          Object.entries(rawBindings).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      : null
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= expectedCount) {
      throw new Error(`Invalid theme assignment slot ${index}`)
    }
    if (componentType !== expectedType) {
      throw new Error(`Theme assignment ${index} has the wrong component type`)
    }
    return {
      slotIndex,
      componentType,
      themeVariantId: typeof assignment?.theme_variant_id === 'string'
        ? assignment.theme_variant_id
        : null,
      themeBindings,
    }
  })

  if (assignments.length !== expectedCount || new Set(assignments.map(item => item.slotIndex)).size !== expectedCount) {
    throw new Error('Theme assignment response does not cover every element slot')
  }
  return assignments.sort((a, b) => a.slotIndex - b.slotIndex)
}
