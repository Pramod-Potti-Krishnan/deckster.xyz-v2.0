'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { defaultElementResearchSelection } from '@/lib/element-research-policy'
import { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
import { Switch } from '@/components/ui/switch'
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
  onReopen,
  onGenerate,
  onElementTypeChange,
  isGenerating,
  error,
  slideIndex,
  presentationId,
  elementContext,
  mode,
  regenerateEnabled,
  onRegenerateToggle,
  researchMode,
  researchWeb,
  researchUploadedDocs,
  researchKnowledgeGraph,
  researchCapabilities,
  onResearchModeChange,
  onResearchWebChange,
  onResearchUploadedDocsChange,
  onResearchKnowledgeGraphChange,
}: GenerationPanelProps) {
  // Form registers its submit function here
  const submitFnRef = useRef<(() => void) | null>(null)

  const registerSubmit = useCallback((fn: () => void) => {
    submitFnRef.current = fn
  }, [])

  const handleFooterGenerate = useCallback(() => {
    submitFnRef.current?.()
  }, [])

  const handleResearchEnabledChange = useCallback((enabled: boolean) => {
    onResearchModeChange(enabled ? 'on' : 'off')
    const defaults = defaultElementResearchSelection(enabled, researchCapabilities)
    onResearchWebChange(defaults.web)
    onResearchUploadedDocsChange(defaults.uploadedDocuments)
    onResearchKnowledgeGraphChange(defaults.knowledgeGraph)
  }, [
    onResearchKnowledgeGraphChange,
    onResearchModeChange,
    onResearchUploadedDocsChange,
    onResearchWebChange,
    researchCapabilities,
  ])

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

  // Force showAdvanced=true when entering edit/refine mode
  useEffect(() => {
    if (mode === 'edit' || mode === 'refine') {
      setShowAdvanced(true)
    }
  }, [mode])

  // Visibility logic
  const showGenerationInput = mode === 'generate' || mode === 'refine' || regenerateEnabled
  const showFormBody = mode === 'edit' || mode === 'refine' || showAdvanced

  // Keyboard shortcuts: Escape to close, Cmd/Ctrl+Enter to generate
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating && showGenerationInput) {
        e.preventDefault()
        submitFnRef.current?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose, showGenerationInput])

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none">
      {/* Panel content */}
      <div
        className={cn(
          "flex-1 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0 max-w-0"
        )}
      >
        {/* Header */}
        <GenerationPanelHeader
          elementType={elementType}
          onClose={onClose}
          onElementTypeChange={mode === 'edit' || mode === 'refine' ? undefined : onElementTypeChange}
          mode={mode}
          regenerateEnabled={regenerateEnabled}
          onRegenerateToggle={onRegenerateToggle}
        />

        {/* Canvas position indicator */}
        {elementContext && (
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Position from canvas ({elementContext.width}&times;{elementContext.height} cells)
          </div>
        )}

        {/* Chat-style generation input — hidden in edit mode when regenerate is OFF */}
        {showGenerationInput && (
          <>
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
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Research</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your prompt leads; slide, deck, then research provide supporting context.
                  </div>
                </div>
                <Switch
                  aria-label="Enable research"
                  checked={researchMode === 'on'}
                  onCheckedChange={handleResearchEnabledChange}
                  className="scale-90"
                />
              </div>
              <div className="mt-2 grid gap-1.5">
                <ResearchSourceSwitch
                  label="Web Search"
                  checked={researchWeb}
                  researchEnabled={researchMode === 'on'}
                  capability={researchCapabilities.web}
                  onCheckedChange={onResearchWebChange}
                />
                <ResearchSourceSwitch
                  label="Uploaded Documents"
                  checked={researchUploadedDocs}
                  researchEnabled={researchMode === 'on'}
                  capability={researchCapabilities.uploaded_documents}
                  onCheckedChange={onResearchUploadedDocsChange}
                />
                <ResearchSourceSwitch
                  label="Knowledge Graph"
                  checked={researchKnowledgeGraph}
                  researchEnabled={researchMode === 'on'}
                  capability={researchCapabilities.knowledge_graph}
                  onCheckedChange={onResearchKnowledgeGraphChange}
                />
              </div>
            </div>
          </>
        )}

        {/* Scrollable form area — always visible in edit mode, toggled by advanced in generate mode */}
        <div className={`flex-1 overflow-y-auto px-3 py-3 ${!showFormBody ? 'hidden' : ''}`}>
          <FormRouter
            elementType={elementType}
            onSubmit={onGenerate}
            registerSubmit={registerSubmit}
            isGenerating={isGenerating}
            slideIndex={slideIndex}
            presentationId={presentationId}
            elementContext={elementContext}
            prompt={prompt}
            showAdvanced={showAdvanced}
            registerMandatoryConfig={registerMandatoryConfig}
          />
        </div>
      </div>

    </div>
  )
}

function ResearchSourceSwitch({
  label,
  checked,
  researchEnabled,
  capability,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  researchEnabled: boolean
  capability: { available: boolean; reason?: string | null }
  onCheckedChange: (enabled: boolean) => void
}) {
  const disabled = !researchEnabled || !capability.available
  return (
    <div className="flex items-start justify-between gap-3 rounded-md px-1 py-1">
      <div className="min-w-0">
        <div className={cn(
          'text-[11px] font-medium',
          disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200',
        )}>
          {label}
        </div>
        {!capability.available && capability.reason && (
          <div className="text-[10px] leading-4 text-amber-600 dark:text-amber-400">
            {capability.reason}
          </div>
        )}
      </div>
      <Switch
        aria-label={`Use ${label}`}
        checked={researchEnabled && capability.available && checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="scale-75"
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
  presentationId,
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
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}) {
  const commonProps = {
    onSubmit,
    registerSubmit,
    isGenerating,
    presentationId,
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
      return <IconLabelForm onSubmit={onSubmit} registerSubmit={registerSubmit} isGenerating={isGenerating} presentationId={presentationId} prompt={prompt} showAdvanced={showAdvanced} registerMandatoryConfig={registerMandatoryConfig} />
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
