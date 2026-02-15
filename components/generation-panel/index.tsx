'use client'

import { useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
import { GenerationPanelHeader } from './header'
import { GenerationPanelFooter } from './footer'
import { TextBoxForm } from './forms/text-box-form'
import { MetricsForm } from './forms/metrics-form'
import { TableForm } from './forms/table-form'
import { ChartForm } from './forms/chart-form'
import { ImageForm } from './forms/image-form'
import { IconLabelForm } from './forms/icon-label-form'
import { ShapeForm } from './forms/shape-form'
import { InfographicForm } from './forms/infographic-form'
import { DiagramForm } from './forms/diagram-form'
import { GenerationPanelProps, ElementContext } from './types'

export function GenerationPanel({
  isOpen,
  elementType,
  onClose,
  onGenerate,
  onElementTypeChange,
  isGenerating,
  error,
  slideIndex,
  elementContext,
}: GenerationPanelProps) {
  // Form registers its submit function here
  const submitFnRef = useRef<(() => void) | null>(null)

  const registerSubmit = useCallback((fn: () => void) => {
    submitFnRef.current = fn
  }, [])

  const handleFooterGenerate = useCallback(() => {
    submitFnRef.current?.()
  }, [])

  // Keyboard shortcuts: Escape to close, Cmd/Ctrl+Enter to generate
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) {
        e.preventDefault()
        submitFnRef.current?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose])

  return (
    <div
      className={cn(
        "absolute inset-0 bg-white text-gray-900 shadow-2xl z-20 flex flex-col",
        "transform transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
      )}
    >
      {/* Header */}
      <GenerationPanelHeader
        elementType={elementType}
        onClose={onClose}
        onElementTypeChange={onElementTypeChange}
      />

      {/* Canvas position indicator */}
      {elementContext && (
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Position from canvas ({elementContext.width}&times;{elementContext.height} cells)
        </div>
      )}

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <FormRouter
          elementType={elementType}
          onSubmit={onGenerate}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          slideIndex={slideIndex}
          elementContext={elementContext}
        />
      </div>

      {/* Footer */}
      <GenerationPanelFooter
        onGenerate={handleFooterGenerate}
        isGenerating={isGenerating}
        error={error}
      />
    </div>
  )
}

// Routes to the correct form based on element type
function FormRouter({
  elementType,
  onSubmit,
  registerSubmit,
  isGenerating,
  slideIndex,
  elementContext,
}: {
  elementType: TextLabsComponentType
  onSubmit: (formData: TextLabsFormData) => Promise<void>
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  slideIndex: number
  elementContext?: ElementContext | null
}) {
  switch (elementType) {
    case 'TEXT_BOX':
      return (
        <TextBoxForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'METRICS':
      return (
        <MetricsForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'TABLE':
      return (
        <TableForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'CHART':
      return (
        <ChartForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'IMAGE':
      return (
        <ImageForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'ICON_LABEL':
      return (
        <IconLabelForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
        />
      )
    case 'SHAPE':
      return (
        <ShapeForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'INFOGRAPHIC':
      return (
        <InfographicForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    case 'DIAGRAM':
      return (
        <DiagramForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          elementContext={elementContext}
        />
      )
    default:
      return null
  }
}

export { GenerationPanel as default }
