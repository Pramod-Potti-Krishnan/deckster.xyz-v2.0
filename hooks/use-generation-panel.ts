'use client'

import { useState, useCallback, useRef } from 'react'
import { TextLabsComponentType } from '@/types/textlabs'

/**
 * Manages the GenerationPanel open/close state and selected element type.
 * Remembers the last-used element type within the session.
 * Tracks which blank element (if any) the panel is configuring.
 */
export function useGenerationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const lastTypeRef = useRef<TextLabsComponentType>('TEXT_BOX')
  const [elementType, setElementType] = useState<TextLabsComponentType>('TEXT_BOX')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blankElementId, setBlankElementId] = useState<string | null>(null)

  const openPanel = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(null)
    setIsOpen(true)
    setError(null)
  }, [])

  /** Open panel for a specific blank element on the canvas */
  const openPanelForElement = useCallback((type: TextLabsComponentType, elementId: string) => {
    setElementType(type)
    lastTypeRef.current = type
    setBlankElementId(elementId)
    setIsOpen(true)
    setError(null)
  }, [])

  const closePanel = useCallback(() => {
    if (!isGenerating) {
      setIsOpen(false)
      setBlankElementId(null)
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
    setIsOpen(true)
    setError(null)
  }, [])

  return {
    isOpen,
    elementType,
    isGenerating,
    error,
    blankElementId,
    openPanel,
    openPanelForElement,
    closePanel,
    changeElementType,
    reopenPanel,
    setIsGenerating,
    setError,
  }
}
