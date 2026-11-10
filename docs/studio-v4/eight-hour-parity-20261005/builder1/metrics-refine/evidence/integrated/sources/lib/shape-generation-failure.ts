import { TextLabsRequestError } from '@/lib/textlabs-client'
import type { TextLabsFormData } from '@/types/textlabs'

const SHAPE_TYPED_FAILURE_RECOVERY_ENABLED =
  process.env.NEXT_PUBLIC_SHAPE_TYPED_FAILURE_RECOVERY_ENABLED === 'true'

export function shapeTypedFailureGuidance(
  formData: TextLabsFormData,
  error: unknown,
): string | null {
  if (!SHAPE_TYPED_FAILURE_RECOVERY_ENABLED || formData.componentType !== 'SHAPE') return null

  const shapeType: unknown = formData.shapeConfig?.shape_type
  if (shapeType != null && shapeType !== 'custom' && shapeType !== 'auto') return null
  if (
    !(error instanceof TextLabsRequestError)
    || error.kind !== 'application'
    || error.errorCode !== 'SHAPE_GEOMETRY_UNVERIFIABLE'
    || error.retryable !== false
    || error.ambiguousCompletion !== false
  ) return null

  return 'Try a simpler shape description or choose a preset.'
}
