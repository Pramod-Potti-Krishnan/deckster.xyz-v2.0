const RENDERER_STATE_EVENTS = {
  updateCodeDisplayState: ['code_display', 'codeDisplayData'],
  updateKanbanState: ['kanban', 'kanbanData'],
  updateGanttState: ['gantt', 'ganttData'],
  updateChevronState: ['chevron', 'chevronData'],
  updateIdeaBoardState: ['idea_board', 'ideaBoardData'],
  updateCloudArchState: ['cloud_architecture', 'cloudArchData'],
  updateLogArchState: ['logical_architecture', 'logArchData'],
  updateLogicalArchState: ['logical_architecture', 'logicalArchData'],
  updateDataArchitectureState: ['data_architecture', 'dataArchitectureData'],
  updateDataArchState: ['data_architecture', 'dataArchData'],
} as const

export type DiagramRendererStateEvent = keyof typeof RENDERER_STATE_EVENTS
const MAX_RENDERER_STATE_BYTES = 256 * 1024

export interface DiagramRendererStateUpdate {
  elementId: string
  rendererType: typeof RENDERER_STATE_EVENTS[DiagramRendererStateEvent][0]
  state: Record<string, unknown>
  action?: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(minimum, Math.min(maximum, Math.round(numeric)))
}

export interface MergedDiagramRendererConfig {
  generationConfig: Record<string, unknown> | null
  diagramConfig: Record<string, unknown>
}

/**
 * Merge Layout's authoritative renderer-owned state into the form submitted
 * after a refine preflight. Panel-owned controls retain precedence; interactive
 * rail widths and renderer state always come from the live element snapshot.
 */
export function mergeLiveDiagramRendererConfig(
  currentGenerationConfig: Record<string, unknown> | null | undefined,
  currentDiagramConfig: Record<string, unknown> | null | undefined,
  liveGenerationConfig: Record<string, unknown> | null | undefined,
): MergedDiagramRendererConfig {
  const current = record(currentGenerationConfig)
  const live = record(liveGenerationConfig)
  const liveSettings = record(live?.settings)
  const currentSettings = record(current?.settings)
  const liveRendererStates = record(live?.renderer_states)
  const liveRendererStateActions = record(live?.renderer_state_actions)
  const liveRendererStateContentDirty = record(
    live?.renderer_state_content_dirty,
  )
  const liveGanttState = record(liveRendererStates?.gantt)
  const liveChevronState = record(liveRendererStates?.chevron)

  const taskColumnWidth = boundedInteger(
    liveSettings?.task_column_width_px
      ?? live?.task_column_width_px
      ?? liveGanttState?.task_column_width_px,
    270,
    405,
  )
  const rowLabelWidth = boundedInteger(
    liveSettings?.row_label_width_px
      ?? live?.row_label_width_px
      ?? liveChevronState?.row_label_width_px,
    180,
    270,
  )
  const rendererOwnedSettings: Record<string, number> = {
    ...(taskColumnWidth !== null ? { task_column_width_px: taskColumnWidth } : {}),
    ...(rowLabelWidth !== null ? { row_label_width_px: rowLabelWidth } : {}),
  }
  const diagramConfig = {
    ...(currentDiagramConfig ?? {}),
    ...rendererOwnedSettings,
  }

  if (!live && !current) {
    return { generationConfig: null, diagramConfig }
  }

  const generationConfig: Record<string, unknown> = {
    ...(live ?? {}),
    ...(current ?? {}),
    settings: {
      ...(liveSettings ?? {}),
      ...(currentSettings ?? {}),
      ...rendererOwnedSettings,
    },
    ...(liveRendererStates ? { renderer_states: liveRendererStates } : {}),
    ...(liveRendererStateActions
      ? { renderer_state_actions: liveRendererStateActions }
      : {}),
    ...(liveRendererStateContentDirty
      ? { renderer_state_content_dirty: liveRendererStateContentDirty }
      : {}),
    ...rendererOwnedSettings,
  }
  return { generationConfig, diagramConfig }
}

export function isDiagramRendererStateEvent(value: unknown): value is DiagramRendererStateEvent {
  return typeof value === 'string' && value in RENDERER_STATE_EVENTS
}

export function parseDiagramRendererStateUpdate(
  message: unknown,
): DiagramRendererStateUpdate | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null
  const payload = message as Record<string, unknown>
  if (!isDiagramRendererStateEvent(payload.type)) return null
  if (
    typeof payload.elementId !== 'string'
    || !/^[A-Za-z0-9_.:-]{1,200}$/.test(payload.elementId)
  ) return null

  const [rendererType, stateKey] = RENDERER_STATE_EVENTS[payload.type]
  const rawState = payload[stateKey] ?? payload.state
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return null
  try {
    const serialized = JSON.stringify(rawState)
    if (serialized.length > MAX_RENDERER_STATE_BYTES) return null
    const state = JSON.parse(serialized) as Record<string, unknown>
    const action = typeof payload.action === 'string'
      && /^[A-Za-z0-9_.:-]{1,64}$/.test(payload.action)
      ? payload.action
      : undefined
    return { elementId: payload.elementId, rendererType, state, ...(action ? { action } : {}) }
  } catch {
    return null
  }
}
