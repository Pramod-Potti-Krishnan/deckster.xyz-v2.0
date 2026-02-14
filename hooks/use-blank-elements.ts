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
}

/**
 * Tracks blank placeholder elements and their canvas positions.
 * Uses a Map in a ref for performance (position updates don't trigger re-renders).
 * A version counter triggers re-renders only on add/remove operations.
 */
export function useBlankElements() {
  const mapRef = useRef<Map<string, BlankElementInfo>>(new Map())
  const [version, setVersion] = useState(0)

  const addElement = useCallback((info: BlankElementInfo) => {
    mapRef.current.set(info.elementId, info)
    setVersion(v => v + 1)
  }, [])

  const removeElement = useCallback((elementId: string) => {
    mapRef.current.delete(elementId)
    setVersion(v => v + 1)
  }, [])

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
    }
  }, [])

  const getElement = useCallback((elementId: string): BlankElementInfo | undefined => {
    return mapRef.current.get(elementId)
  }, [])

  const isBlankElement = useCallback((elementId: string): boolean => {
    return mapRef.current.has(elementId)
  }, [])

  return {
    addElement,
    removeElement,
    updatePosition,
    getElement,
    isBlankElement,
    version, // subscribe to add/remove changes
  }
}
