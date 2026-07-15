'use client'

import { useCallback } from 'react'
import type { RefineElementRequest } from '@/components/presentation-viewer'
import type { TextLabsComponentType, TextLabsPositionConfig } from '@/types/textlabs'

export interface RefineContext {
  elementId: string
  elementType: TextLabsComponentType
  slideIndex: number
  gridPosition: TextLabsPositionConfig | null
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
  styleOwner: string | null
  themeVariantSource: string | null
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

    return {
      elementId: payload.elementId,
      elementType,
      slideIndex,
      gridPosition,
      themeVariantId: payload.themeVariantId ?? null,
      themeBindings: payload.themeBindings ?? null,
      styleOwner: payload.styleOwner ?? null,
      themeVariantSource: payload.themeVariantSource ?? null,
      existingElement: {
        element_id: payload.elementId,
        component_type: elementType,
        renderer_type: payload.elementType,
        theme_variant_id: payload.themeVariantId ?? null,
        theme_bindings: payload.themeBindings ?? null,
        style_owner: payload.styleOwner ?? null,
        theme_variant_source: payload.themeVariantSource ?? null,
        research_provenance: payload.researchProvenance ?? null,
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
