"use client"

import { useState, useCallback } from 'react'
import { ElementType, ElementProperties } from '@/types/elements'

export interface SelectedElement {
  id: string
  type: ElementType
  properties: ElementProperties
}

export interface UseElementPanelReturn {
  // Panel visibility state
  showPanel: boolean
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void

  // Selected element
  selectedElement: SelectedElement | null

  // Actions
  selectElement: (id: string, type: ElementType, properties: ElementProperties) => void
  deselectElement: () => void
  updateElementProperties: (properties: Partial<ElementProperties>) => void
  closePanel: () => void
  openPanel: () => void
}

export function useElementPanel(): UseElementPanelReturn {
  const [showPanel, setShowPanel] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)

  // Select an element and open panel
  const selectElement = useCallback((id: string, type: ElementType, properties: ElementProperties) => {
    setSelectedElement({ id, type, properties })
    setShowPanel(true)
    setIsCollapsed(false)
  }, [])

  // Deselect element and collapse panel
  const deselectElement = useCallback(() => {
    setSelectedElement(null)
    setIsCollapsed(true)
  }, [])

  // Update properties of selected element
  const updateElementProperties = useCallback((properties: Partial<ElementProperties>) => {
    setSelectedElement(prev => {
      if (!prev) return null
      return {
        ...prev,
        properties: { ...prev.properties, ...properties } as ElementProperties,
      }
    })
  }, [])

  // Close panel completely
  const closePanel = useCallback(() => {
    setShowPanel(false)
    setSelectedElement(null)
  }, [])

  // Open panel (for toolbar insertion)
  const openPanel = useCallback(() => {
    setShowPanel(true)
    setIsCollapsed(false)
  }, [])

  return {
    showPanel,
    isCollapsed,
    setIsCollapsed,
    selectedElement,
    selectElement,
    deselectElement,
    updateElementProperties,
    closePanel,
    openPanel,
  }
}
