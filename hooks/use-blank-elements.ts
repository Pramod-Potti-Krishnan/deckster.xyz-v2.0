'use client'

import { useRef, useState, useCallback } from 'react'
import { TextLabsComponentType } from '@/types/textlabs'

export interface BlankElementInfo {
  elementId: string
  componentType: TextLabsComponentType
  slideIndex: number
  startCol: number
  startRow: number
  width: number
  height: number
  status: 'blank' | 'generating'
}

/**
 * Tracks blank placeholder elements and their canvas positions.
 * Uses a Map in a ref for performance (position updates don't trigger re-renders).
 * A version counter triggers re-renders only on add/remove operations.
 * An activePosition state provides reactive updates for the tracked active element.
 */
export function useBlankElements() {
  const mapRef = useRef<Map<string, BlankElementInfo>>(new Map())
  const [version, setVersion] = useState(0)
  const [activeElementId, setActiveElementId] = useState<string | null>(null)
  const [activePosition, setActivePosition] = useState<BlankElementInfo | null>(null)

  const addElement = useCallback((info: BlankElementInfo) => {
    mapRef.current.set(info.elementId, info)
    setVersion(v => v + 1)
  }, [])

  const removeElement = useCallback((elementId: string) => {
    mapRef.current.delete(elementId)
    setVersion(v => v + 1)
    // Clear active if it was removed
    if (elementId === activeElementId) {
      setActiveElementId(null)
      setActivePosition(null)
    }
  }, [activeElementId])

  const updatePosition = useCallback((
    elementId: string,
    startCol: number,
    startRow: number,
    width: number,
    height: number
  ) => {
    const info = mapRef.current.get(elementId)
    if (info) {
      info.startCol = startCol
      info.startRow = startRow
      info.width = width
      info.height = height
      // If this is the tracked active element, update reactive state too
      if (elementId === activeElementId) {
        setActivePosition({ ...info })
      }
    }
  }, [activeElementId])

  const setStatus = useCallback((elementId: string, status: 'blank' | 'generating') => {
    const info = mapRef.current.get(elementId)
    if (info) {
      info.status = status
    }
  }, [])

  const getElement = useCallback((elementId: string): BlankElementInfo | undefined => {
    return mapRef.current.get(elementId)
  }, [])

  const isBlankElement = useCallback((elementId: string): boolean => {
    return mapRef.current.has(elementId)
  }, [])

  // Track which element is "active" (open in the generation panel)
  const trackElement = useCallback((elementId: string | null) => {
    setActiveElementId(elementId)
    if (elementId) {
      const info = mapRef.current.get(elementId)
      setActivePosition(info ? { ...info } : null)
    } else {
      setActivePosition(null)
    }
  }, [])

  return {
    addElement,
    removeElement,
    updatePosition,
    setStatus,
    getElement,
    isBlankElement,
    trackElement,
    activePosition, // reactive state for forms
    version, // subscribe to add/remove changes
  }
}
