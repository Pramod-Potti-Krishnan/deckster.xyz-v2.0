'use client'

import { useCallback } from 'react'
import type { RefineElementRequest } from '@/components/presentation-viewer'
import type {
  DiagramGenerationConfig,
  TextLabsComponentType,
  TextLabsDiagramSubtype,
  TextLabsPositionConfig,
  TextSemanticRole,
  TextSlotKind,
} from '@/types/textlabs'

export interface RefineContext {
  elementId: string
  elementType: TextLabsComponentType
  slideIndex: number
  gridPosition: TextLabsPositionConfig | null
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
  styleOwner: string | null
  themeVariantSource: string | null
  semanticRole: TextSemanticRole | null
  slotName: string | null
  slotKind: TextSlotKind | null
  accessoryType: string | null
  citationsUsed: Array<Record<string, unknown>>
  metricsColorVariant: string | null
  researchProvenance: Record<string, unknown> | null
  diagramSubtype: TextLabsDiagramSubtype | null
  generationConfig: Record<string, unknown> | DiagramGenerationConfig | null
  existingElement: Record<string, unknown>
  slideContext: Record<string, unknown> | null
  deckContext: Record<string, unknown> | null
  research: {
    store_name?: string | null
    session_id?: string | null
  }
}

interface UseElementRefinementParams {
  slideContextByIndex: Record<number, unknown> | null | undefined
  deckContext: Record<string, unknown> | null | undefined
  sessionStoreName: string | null
  sessionId: string | null
  currentSlideIndex: number
}

function parseGridSpan(value: string | undefined): [number, number] | null {
  if (!value) return null
  const parts = value.split('/').map(part => Number(part.trim()))
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) return null
  return [parts[0], parts[1]]
}

function normalizeGridPosition(gridPosition: RefineElementRequest['gridPosition']): TextLabsPositionConfig | null {
  if (!gridPosition) return null

  const rowSpan = parseGridSpan(gridPosition.gridRow)
  const columnSpan = parseGridSpan(gridPosition.gridColumn)
  const startCol = gridPosition.startCol ?? columnSpan?.[0]
  const startRow = gridPosition.startRow ?? rowSpan?.[0]
  const width = gridPosition.width ?? (columnSpan ? columnSpan[1] - columnSpan[0] : undefined)
  const height = gridPosition.height ?? (rowSpan ? rowSpan[1] - rowSpan[0] : undefined)

  if (
    typeof startCol !== 'number' ||
    typeof startRow !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null
  }

  return {
    start_col: startCol,
    start_row: startRow,
    position_width: width,
    position_height: height,
    auto_position: false,
  }
}

const DIAGRAM_SUBTYPES = new Set<TextLabsDiagramSubtype>([
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

function normalizeDiagramSubtype(value: unknown): TextLabsDiagramSubtype | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/[-\s]/g, '_') as TextLabsDiagramSubtype
  return DIAGRAM_SUBTYPES.has(normalized) ? normalized : null
}

export function useElementRefinement({
  slideContextByIndex,
  deckContext,
  sessionStoreName,
  sessionId,
  currentSlideIndex,
}: UseElementRefinementParams) {
  return useCallback((payload: RefineElementRequest, elementType: TextLabsComponentType): RefineContext => {
    const slideIndex = payload.slideIndex ?? currentSlideIndex
    const gridPosition = normalizeGridPosition(payload.gridPosition)
    const slideContext = slideContextByIndex?.[slideIndex]
    const diagramSubtype = normalizeDiagramSubtype(payload.generationConfig?.diagram_type)
      ?? normalizeDiagramSubtype(payload.diagramSubtype)

    return {
      elementId: payload.elementId,
      elementType,
      slideIndex,
      gridPosition,
      themeVariantId: payload.themeVariantId ?? null,
      themeBindings: payload.themeBindings ?? null,
      styleOwner: payload.styleOwner ?? null,
      themeVariantSource: payload.themeVariantSource ?? null,
      semanticRole: payload.semanticRole ?? null,
      slotName: payload.slotName ?? null,
      slotKind: payload.slotKind ?? null,
      accessoryType: payload.accessoryType ?? null,
      generationConfig: payload.generationConfig ?? null,
      citationsUsed: payload.citationsUsed ?? [],
      metricsColorVariant: payload.metricsColorVariant ?? null,
      researchProvenance: payload.researchProvenance ?? null,
      diagramSubtype,
      existingElement: {
        element_id: payload.elementId,
        component_type: elementType,
        renderer_type: payload.elementType,
        theme_variant_id: payload.themeVariantId ?? null,
        theme_bindings: payload.themeBindings ?? null,
        style_owner: payload.styleOwner ?? null,
        theme_variant_source: payload.themeVariantSource ?? null,
        research_provenance: payload.researchProvenance ?? null,
        semantic_role: payload.semanticRole ?? null,
        slot_name: payload.slotName ?? null,
        slot_kind: payload.slotKind ?? null,
        accessory_type: payload.accessoryType ?? null,
        generation_config: payload.generationConfig ?? null,
        citations_used: payload.citationsUsed ?? [],
        metrics_color_variant: payload.metricsColorVariant ?? null,
        diagram_subtype: diagramSubtype,
        content: payload.content ?? null,
        formatting: payload.formatting ?? null,
        properties: payload.properties ?? null,
        grid_position: payload.gridPosition ?? null,
      },
      slideContext: slideContext && typeof slideContext === 'object'
        ? slideContext as Record<string, unknown>
        : null,
      deckContext: deckContext ?? null,
      research: {
        store_name: sessionStoreName,
        session_id: sessionId,
      },
    }
  }, [currentSlideIndex, deckContext, sessionId, sessionStoreName, slideContextByIndex])
}
