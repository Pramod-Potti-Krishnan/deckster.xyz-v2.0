'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
import { GenerationPanelHeader } from './header'
import { GenerationInput } from './shared/generation-input'
import { TextBoxForm } from './forms/text-box-form'
import { MetricsForm } from './forms/metrics-form'
import { TableForm } from './forms/table-form'
import { ChartForm } from './forms/chart-form'
import { ImageForm } from './forms/image-form'
import { IconLabelForm } from './forms/icon-label-form'
import { ShapeForm } from './forms/shape-form'
import { InfographicForm } from './forms/infographic-form'
import { DiagramForm } from './forms/diagram-form'
import { GenerationPanelProps, ElementContext, MandatoryConfig } from './types'

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

  // Prompt state — lifted to panel level, passed to forms
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(true)

  // Mandatory config — registered by each form
  const mandatoryConfigRef = useRef<MandatoryConfig | null>(null)
  const [, forceUpdate] = useState(0)

  const registerMandatoryConfig = useCallback((config: MandatoryConfig) => {
    mandatoryConfigRef.current = config
    forceUpdate(n => n + 1)
  }, [])

  // Reset prompt when element type changes
  useEffect(() => {
    setPrompt('')
  }, [elementType])

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

      {/* Chat-style generation input */}
      <GenerationInput
        prompt={prompt}
        onPromptChange={setPrompt}
        mandatoryConfig={mandatoryConfigRef.current}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(prev => !prev)}
        onSubmit={handleFooterGenerate}
        isGenerating={isGenerating}
        error={error}
      />

      {/* Scrollable form area — hidden (not unmounted) when advanced is off */}
      <div className={`flex-1 overflow-y-auto px-3 py-3 ${!showAdvanced ? 'hidden' : ''}`}>
        <FormRouter
          elementType={elementType}
          onSubmit={onGenerate}
          registerSubmit={registerSubmit}
          isGenerating={isGenerating}
          slideIndex={slideIndex}
          elementContext={elementContext}
          prompt={prompt}
          showAdvanced={showAdvanced}
          registerMandatoryConfig={registerMandatoryConfig}
        />
      </div>
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
  prompt,
  showAdvanced,
  registerMandatoryConfig,
}: {
  elementType: TextLabsComponentType
  onSubmit: (formData: TextLabsFormData) => Promise<void>
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  slideIndex: number
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}) {
  const commonProps = {
    onSubmit,
    registerSubmit,
    isGenerating,
    elementContext,
    prompt,
    showAdvanced,
    registerMandatoryConfig,
  }

  switch (elementType) {
    case 'TEXT_BOX':
      return <TextBoxForm {...commonProps} />
    case 'METRICS':
      return <MetricsForm {...commonProps} />
    case 'TABLE':
      return <TableForm {...commonProps} />
    case 'CHART':
      return <ChartForm {...commonProps} />
    case 'IMAGE':
      return <ImageForm {...commonProps} />
    case 'ICON_LABEL':
      return <IconLabelForm onSubmit={onSubmit} registerSubmit={registerSubmit} isGenerating={isGenerating} prompt={prompt} showAdvanced={showAdvanced} registerMandatoryConfig={registerMandatoryConfig} />
    case 'SHAPE':
      return <ShapeForm {...commonProps} />
    case 'INFOGRAPHIC':
      return <InfographicForm {...commonProps} />
    case 'DIAGRAM':
      return <DiagramForm {...commonProps} />
    default:
      return null
  }
}

export { GenerationPanel as default }
