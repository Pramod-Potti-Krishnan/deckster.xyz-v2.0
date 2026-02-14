'use client'

import { useState, useCallback } from 'react'
import { TextLabsComponentType } from '@/types/textlabs'

/**
 * Manages the GenerationPanel open/close state and selected element type.
 */
export function useGenerationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [elementType, setElementType] = useState<TextLabsComponentType>('TEXT_BOX')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPanel = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
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
    setIsGenerating,
    setError,
  }
}
