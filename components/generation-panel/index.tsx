'use client'

import { useRef, useCallback } from 'react'
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
import { GenerationPanelProps } from './types'

export function GenerationPanel({
  isOpen,
  elementType,
  onClose,
  onGenerate,
  onElementTypeChange,
  isGenerating,
  error,
  slideIndex,
}: GenerationPanelProps) {
  // Form registers its submit function here
  const submitFnRef = useRef<(() => void) | null>(null)

  const registerSubmit = useCallback((fn: () => void) => {
    submitFnRef.current = fn
  }, [])

  const handleFooterGenerate = useCallback(() => {
    submitFnRef.current?.()
  }, [])

  return (
    <div
      className={`flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'w-[clamp(300px,32vw,380px)] opacity-100' : 'w-0 opacity-0'
      }`}
      style={{ minWidth: isOpen ? '300px' : '0' }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <GenerationPanelHeader
            elementType={elementType}
            onClose={onClose}
            onElementTypeChange={onElementTypeChange}
          />

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <FormRouter
              elementType={elementType}
              onSubmit={onGenerate}
              registerSubmit={registerSubmit}
              isGenerating={isGenerating}
              slideIndex={slideIndex}
            />
          </div>

          {/* Footer */}
          <GenerationPanelFooter
            onGenerate={handleFooterGenerate}
            isGenerating={isGenerating}
            error={error}
          />
        </>
      )}
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
}: {
  elementType: TextLabsComponentType
  onSubmit: (formData: TextLabsFormData) => Promise<void>
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  slideIndex: number
}) {
  switch (elementType) {
    case 'TEXT_BOX':
      return (
        <TextBoxForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
        />
      )
    case 'METRICS':
      return (
        <MetricsForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
        />
      )
    case 'TABLE':
      return (
        <TableForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
        />
      )
    case 'CHART':
      return (
        <ChartForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
        />
      )
    case 'IMAGE':
      return (
        <ImageForm
          onSubmit={onSubmit}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
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
        />
      )
    // Phase 5
    case 'INFOGRAPHIC':
    case 'DIAGRAM':
      return (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-500">
            {elementType} form coming soon
          </p>
        </div>
      )
    default:
      return null
  }
}

export { GenerationPanel as default }
