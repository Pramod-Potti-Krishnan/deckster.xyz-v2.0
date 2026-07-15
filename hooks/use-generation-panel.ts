'use client'

import { useState, useCallback, useRef } from 'react'
import { TextLabsComponentType } from '@/types/textlabs'
import type { RefineContext } from '@/hooks/use-element-refinement'
import type { ElementResearchMode } from '@/types/textlabs'

/**
 * Manages the GenerationPanel open/close state and selected element type.
 * Remembers the last-used element type within the session.
 * Tracks which blank element (if any) the panel is configuring.
 * Supports 'generate' and 'edit' modes for element creation vs editing.
 */
export function useGenerationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const lastTypeRef = useRef<TextLabsComponentType>('TEXT_BOX')
  const [elementType, setElementType] = useState<TextLabsComponentType>('TEXT_BOX')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blankElementId, setBlankElementId] = useState<string | null>(null)

  // Edit mode state
  const [mode, setMode] = useState<'generate' | 'edit' | 'refine'>('generate')
  const [regenerateEnabled, setRegenerateEnabled] = useState(false)
  const [editElementId, setEditElementId] = useState<string | null>(null)
  const [refineContext, setRefineContext] = useState<RefineContext | null>(null)
  const [researchMode, setResearchMode] = useState<ElementResearchMode>('auto')
  const [researchWeb, setResearchWeb] = useState(false)
  const [researchUploadedDocs, setResearchUploadedDocs] = useState(true)

  const openPanel = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(null)
    setMode('generate')
    setEditElementId(null)
    setRefineContext(null)
    setRegenerateEnabled(false)
    setIsOpen(true)
    setError(null)
  }, [])

  /** Open panel for a specific blank element on the canvas */
  const openPanelForElement = useCallback((type: TextLabsComponentType, elementId: string) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(elementId)
    setMode('generate')
    setEditElementId(null)
    setRefineContext(null)
    setRegenerateEnabled(false)
    setIsOpen(true)
    setError(null)
  }, [])

  /** Open panel in edit mode for an existing element */
  const openPanelForEdit = useCallback((type: TextLabsComponentType, elementId: string) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(null)
    setMode('edit')
    setEditElementId(elementId)
    setRefineContext(null)
    setRegenerateEnabled(false)
    setIsOpen(true)
    setError(null)
  }, [])

  /** Open panel in refine mode for an existing element. */
  const openPanelForRefine = useCallback((type: TextLabsComponentType, context: RefineContext) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(null)
    setMode('refine')
    setEditElementId(context.elementId)
    setRefineContext(context)
    setRegenerateEnabled(false)
    setIsOpen(true)
    setError(null)
  }, [])

  const closePanel = useCallback(() => {
    if (!isGenerating) {
      setIsOpen(false)
      setBlankElementId(null)
      setMode('generate')
      setEditElementId(null)
      setRefineContext(null)
      setRegenerateEnabled(false)
      setError(null)
    }
  }, [isGenerating])

  const changeElementType = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    lastTypeRef.current = type
    setError(null)
  }, [])

  // Re-open panel with last-used element type
  const reopenPanel = useCallback(() => {
    setElementType(lastTypeRef.current)
    setBlankElementId(null)
    setMode('generate')
    setEditElementId(null)
    setRefineContext(null)
    setRegenerateEnabled(false)
    setIsOpen(true)
    setError(null)
  }, [])

  return {
    isOpen,
    elementType,
    isGenerating,
    error,
    blankElementId,
    mode,
    regenerateEnabled,
    editElementId,
    refineContext,
    researchMode,
    researchWeb,
    researchUploadedDocs,
    openPanel,
    openPanelForElement,
    openPanelForEdit,
    openPanelForRefine,
    closePanel,
    changeElementType,
    reopenPanel,
    setIsGenerating,
    setError,
    setRegenerateEnabled,
    setResearchMode,
    setResearchWeb,
    setResearchUploadedDocs,
  }
}
