'use client'

import { useState, useCallback, useRef } from 'react'
import { TextLabsComponentType } from '@/types/textlabs'

/**
 * Manages the GenerationPanel open/close state and selected element type.
 * Remembers the last-used element type within the session.
 */
export function useGenerationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const lastTypeRef = useRef<TextLabsComponentType>('TEXT_BOX')
  const [elementType, setElementType] = useState<TextLabsComponentType>('TEXT_BOX')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPanel = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    lastTypeRef.current = type
    setIsOpen(true)
    setError(null)
  }, [])

  const closePanel = useCallback(() => {
    if (!isGenerating) {
      setIsOpen(false)
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
    setIsOpen(true)
    setError(null)
  }, [])

  return {
    isOpen,
    elementType,
    isGenerating,
    error,
    openPanel,
    closePanel,
    changeElementType,
    reopenPanel,
    setIsGenerating,
    setError,
  }
}
