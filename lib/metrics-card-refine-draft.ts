/** Per-element draft admission only. The original multi-card generation draft
 * and request remain owned by their existing generation path. */
export interface GeneratedMetricsCardTarget {
  elementId: string
  elementType: string
  /** Independently admitted live native bounds. Omit when the insertion ACK
   * carries only identity; existing live geometry/preflight remains authoritative. */
  position?: {
    start_col: number
    start_row: number
    position_width: number
    position_height: number
  }
}

interface MetricsCardDraftShape {
  formData?: unknown
  metricsControls?: unknown
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Preserve unknown service/research/theme/manual fields. Normalize only the
 * group-instance fields consumed by the existing Metrics single-card form. */
function singleCardConfig(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...value, count: 1, metricsLayoutChoice: 'auto', layout: 'horizontal' }
  if ('metrics_layout_choice' in value) next.metrics_layout_choice = 'auto'
  if ('layoutChoice' in value) next.layoutChoice = 'auto'
  for (const key of ['metricsConfig', 'metrics_config']) {
    if (record(value[key])) next[key] = { ...value[key], layout: 'horizontal' }
  }
  if ('compose' in value) next.compose = false
  // One generated card is a concrete count of 1, never "Auto" (request fidelity flag).
  if ('countAuto' in value) next.countAuto = false
  delete next.elements
  return next
}

/** For the admitted METRICS per-card insertion metadata and refine context.
 * Service-returned fields remain authoritative; only group-instance settings
 * change. This must not be applied to the original aggregate request config. */
export function normalizeMetricsCardRefineGenerationConfig<T>(value: T, elementType: string): T {
  if (elementType !== 'METRICS' || !record(value)
    || (value.componentType !== undefined && value.componentType !== 'METRICS')) return value
  if (record(value.formData)) {
    if (value.formData.componentType !== undefined && value.formData.componentType !== 'METRICS') return value
    return { ...value, formData: singleCardConfig(value.formData) } as T
  }
  return singleCardConfig(value) as T
}

export function normalizeGeneratedMetricsCardDraft<T extends MetricsCardDraftShape>(
  draft: T,
  target: GeneratedMetricsCardTarget,
): T {
  if (target.elementType !== 'METRICS' || typeof target.elementId !== 'string' || !target.elementId.trim()
    || target.elementId !== target.elementId.trim()
    || (target.position !== undefined && (!record(target.position)
    || !['start_col', 'start_row', 'position_width', 'position_height'].every(key => {
      const value = target.position![key as keyof NonNullable<typeof target.position>]
      return typeof value === 'number' && Number.isFinite(value)
    })
    || target.position.start_col < 0 || target.position.start_row < 0
    || target.position.position_width <= 0 || target.position.position_height <= 0))
    || (record(draft.formData) && draft.formData.componentType !== 'METRICS')) return draft

  const positionConfig = target.position ? { ...target.position, auto_position: false } : undefined
  const next: MetricsCardDraftShape = { ...draft }
  if (record(draft.formData)) {
    const formData: Record<string, unknown> = singleCardConfig(draft.formData)
    if (positionConfig) formData.positionConfig = positionConfig
    else delete formData.positionConfig
    if (record(draft.formData.generationConfig)) {
      formData.generationConfig = normalizeMetricsCardRefineGenerationConfig(draft.formData.generationConfig, target.elementType)
    }
    next.formData = formData
  }
  if (record(draft.metricsControls)) {
    const controls: Record<string, unknown> = {
      ...draft.metricsControls,
      count: 1,
      layoutChoice: 'auto',
      geometryEdited: false,
    }
    if (positionConfig && target.position) {
      controls.positionConfig = positionConfig
      controls.geometryContext = {
        elementId: target.elementId,
        startCol: target.position.start_col,
        startRow: target.position.start_row,
        width: target.position.position_width,
        height: target.position.position_height,
      }
    } else {
      // The old controls describe the group/placeholder, not the inserted card.
      // Let the existing target-fenced live geometry path initialize the form.
      delete controls.positionConfig
      delete controls.geometryContext
    }
    next.metricsControls = controls
  }
  return next as T
}
