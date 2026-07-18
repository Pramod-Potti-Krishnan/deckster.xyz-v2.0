'use client'

import { type ReactNode, useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { defaultElementResearchSelection, isNonResearchVisualElement } from '@/lib/element-research-policy'
import { TemplateSlotCatalog, TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
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
import { GenerationPanelProps, ElementContext, GenerationPanelDraft, MandatoryConfig } from './types'
import { parseTemplateSlotCatalog } from '@/lib/text-slot-catalog'
import { ResearchControls } from './shared/research-controls'

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function useMemoFromSavedGenerationConfig(
  savedConfig: Record<string, unknown> | null | undefined,
  elementType: TextLabsComponentType,
  mode: GenerationPanelProps['mode'],
): GenerationPanelDraft | null {
  return useMemo(() => {
    if (!savedConfig || (mode !== 'edit' && mode !== 'refine')) return null
    const savedFormData = readObject(savedConfig.formData)
    if (savedFormData?.componentType) {
      return {
        prompt: typeof savedFormData.prompt === 'string'
          ? savedFormData.prompt
          : typeof savedConfig.prompt === 'string'
            ? savedConfig.prompt
            : '',
        showAdvanced: Boolean(savedConfig.showAdvanced ?? savedFormData.advancedModified),
        formData: savedFormData as unknown as TextLabsFormData,
      }
    }
    const prompt = typeof savedConfig.prompt === 'string' ? savedConfig.prompt : ''
    if (elementType !== 'TABLE') {
      return prompt ? { prompt, showAdvanced: Boolean(savedConfig.showAdvanced) } : null
    }
    const tableConfig = readObject(savedConfig.tableConfig ?? savedConfig.table_config) ?? { structure_mode: 'AUTO' }
    const positionConfig = readObject(savedConfig.positionConfig ?? savedConfig.position_config)
    const paddingConfig = readObject(savedConfig.paddingConfig ?? savedConfig.padding_config)
    const count = readNumber(savedConfig.count) ?? 1
    const advancedModified = Boolean(
      savedConfig.advancedModified
      ?? savedConfig.advanced_modified
      ?? savedConfig.showAdvanced
      ?? Object.keys(tableConfig).some(key => key !== 'structure_mode'),
    )
    return {
      prompt,
      showAdvanced: Boolean(savedConfig.showAdvanced ?? advancedModified),
      formData: {
        componentType: 'TABLE',
        prompt,
        count,
        layout: 'horizontal',
        advancedModified,
        z_index: readNumber(savedConfig.zIndex ?? savedConfig.z_index),
        tableConfig,
        positionConfig: positionConfig as unknown as TextLabsFormData['positionConfig'],
        paddingConfig: paddingConfig as unknown as TextLabsFormData['paddingConfig'],
        generationConfig: savedConfig,
      } as TextLabsFormData,
    }
  }, [elementType, mode, savedConfig])
}

export function GenerationPanel({
  isOpen,
  activationId,
  draftKey,
  draft,
  onDraftChange,
  elementType,
  onClose,
  onGenerate,
  onElementTypeChange,
  isGenerating,
  error,
  slideIndex,
  presentationId,
  elementContext,
  mode,
  getTemplateSlotCatalog,
  existingTextTarget,
  existingInfographicTarget,
  existingDiagramTarget,
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
  const panelTargetKey = `${activationId}:${draftKey ?? 'new'}:${elementType}:${existingTextTarget?.elementId ?? 'none'}`

  // Form registers its submit function here
  const submitFnRef = useRef<{ key: string; submit: () => void } | null>(null)

  const registerSubmit = useCallback((fn: () => void) => {
    submitFnRef.current = { key: panelTargetKey, submit: fn }
  }, [panelTargetKey])

  const handleFooterGenerate = useCallback(() => {
    const registration = submitFnRef.current
    if (registration?.key === panelTargetKey) registration.submit()
  }, [panelTargetKey])

  const handleResearchEnabledChange = useCallback((enabled: boolean) => {
    onResearchModeChange(enabled ? 'on' : 'off')
    const defaults = defaultElementResearchSelection(enabled, researchCapabilities)
    onResearchWebChange(defaults.web)
    onResearchUploadedDocsChange(defaults.uploadedDocuments)
    onResearchKnowledgeGraphChange(defaults.knowledgeGraph)
    onDraftChange?.({
      researchMode: enabled ? 'on' : 'off',
      researchWeb: defaults.web,
      researchUploadedDocs: defaults.uploadedDocuments,
      researchKnowledgeGraph: defaults.knowledgeGraph,
    })
  }, [
    onDraftChange,
    onResearchKnowledgeGraphChange,
    onResearchModeChange,
    onResearchUploadedDocsChange,
    onResearchWebChange,
    researchCapabilities,
  ])

  // Prompt state — lifted to panel level, passed to forms
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [slotCatalog, setSlotCatalog] = useState<TemplateSlotCatalog>({ slots: [] })
  const [slotCatalogLoading, setSlotCatalogLoading] = useState(false)
  const [slotCatalogError, setSlotCatalogError] = useState<string | null>(null)

  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value)
    onDraftChange?.({ prompt: value })
  }, [onDraftChange])

  const handleShowAdvancedToggle = useCallback(() => {
    setShowAdvanced(previous => {
      const next = !previous
      onDraftChange?.({ showAdvanced: next })
      return next
    })
  }, [onDraftChange])

  const handleResearchWebChange = useCallback((enabled: boolean) => {
    onResearchWebChange(enabled)
    onDraftChange?.({ researchWeb: enabled })
  }, [onDraftChange, onResearchWebChange])

  const handleResearchUploadedDocsChange = useCallback((enabled: boolean) => {
    onResearchUploadedDocsChange(enabled)
    onDraftChange?.({ researchUploadedDocs: enabled })
  }, [onDraftChange, onResearchUploadedDocsChange])

  const handleResearchKnowledgeGraphChange = useCallback((enabled: boolean) => {
    onResearchKnowledgeGraphChange(enabled)
    onDraftChange?.({ researchKnowledgeGraph: enabled })
  }, [onDraftChange, onResearchKnowledgeGraphChange])

  const handleFormSubmit = useCallback(async (formData: TextLabsFormData) => {
    onDraftChange?.({
      prompt: formData.prompt,
      showAdvanced,
      formData,
      researchMode,
      researchWeb,
      researchUploadedDocs,
      researchKnowledgeGraph,
    })
    await onGenerate(formData)
  }, [
    onDraftChange,
    onGenerate,
    researchKnowledgeGraph,
    researchMode,
    researchUploadedDocs,
    researchWeb,
    showAdvanced,
  ])

  // Mandatory controls are registered by the mounted form. Scope the
  // registration to the current activation so a previous element's controls
  // can never flash in a newly opened panel. Keeping this in state also avoids
  // the parent hydration effect clearing a control after the child's
  // registration effect has run.
  const [mandatoryConfigState, setMandatoryConfigState] = useState<{
    key: string
    config: MandatoryConfig | MandatoryConfig[] | null
  }>({ key: panelTargetKey, config: null })

  const registerMandatoryConfig = useCallback((config: MandatoryConfig | MandatoryConfig[] | null) => {
    setMandatoryConfigState({ key: panelTargetKey, config })
  }, [panelTargetKey])
  const mandatoryConfig = mandatoryConfigState.key === panelTargetKey
    ? mandatoryConfigState.config
    : null

  const persistedGenerationDraft = useMemoFromSavedGenerationConfig(
    existingTextTarget?.generationConfig,
    elementType,
    mode,
  )
  const effectiveDraft = draft ?? persistedGenerationDraft

  // Every new target activation hydrates from its remembered draft when one
  // exists. Same-target reopen keeps the mounted form state intact.
  useEffect(() => {
    setPrompt(effectiveDraft?.prompt ?? effectiveDraft?.formData?.prompt ?? '')
    const savedFormGenerationConfig = readObject(effectiveDraft?.formData?.generationConfig)
    setShowAdvanced(Boolean(
      effectiveDraft?.showAdvanced
        ?? savedFormGenerationConfig?.showAdvanced
        ?? effectiveDraft?.formData?.advancedModified
        ?? false,
    ))
  }, [activationId, draftKey, elementType, existingTextTarget?.elementId])

  useEffect(() => {
    if (!isOpen || elementType !== 'TEXT_BOX') return
    let cancelled = false
    if (!getTemplateSlotCatalog) {
      setSlotCatalog({ slots: [] })
      setSlotCatalogLoading(false)
      setSlotCatalogError('Template roles are unavailable; Body text remains available.')
      return
    }
    setSlotCatalogLoading(true)
    setSlotCatalogError(null)
    void getTemplateSlotCatalog(slideIndex)
      .then(response => {
        if (cancelled) return
        const catalog = parseTemplateSlotCatalog(response)
        setSlotCatalog(catalog)
        if (!catalog.slots.length) {
          setSlotCatalogError('This template exposes no structural text slots; Body text remains available.')
        }
      })
      .catch(error => {
        if (cancelled) return
        console.warn('[GenerationPanel] Template slot catalog unavailable:', error)
        setSlotCatalog({ slots: [] })
        setSlotCatalogError('Template roles could not be loaded; Body text remains available.')
      })
      .finally(() => {
        if (!cancelled) setSlotCatalogLoading(false)
      })
    return () => { cancelled = true }
  }, [elementType, getTemplateSlotCatalog, isOpen, slideIndex])

  // Visibility logic
  const showGenerationInput = mode === 'generate' || mode === 'refine'
  const supportsResearch = !isNonResearchVisualElement(elementType)

  const researchControls = showGenerationInput && supportsResearch ? (
    <ResearchControls
      researchMode={researchMode}
      researchWeb={researchWeb}
      researchUploadedDocs={researchUploadedDocs}
      researchKnowledgeGraph={researchKnowledgeGraph}
      researchCapabilities={researchCapabilities}
      onResearchEnabledChange={handleResearchEnabledChange}
      onResearchWebChange={handleResearchWebChange}
      onResearchUploadedDocsChange={handleResearchUploadedDocsChange}
      onResearchKnowledgeGraphChange={handleResearchKnowledgeGraphChange}
    />
  ) : null

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
        handleFooterGenerate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFooterGenerate, isOpen, isGenerating, onClose, showGenerationInput])

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
        />

        {/* Canvas position indicator */}
        {elementContext && elementType !== 'CHART' && (
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Position from canvas ({elementContext.width}&times;{elementContext.height} cells)
          </div>
        )}

        {/* Regenerate is a direct viewer action; edit mode never needs a second toggle. */}
        {showGenerationInput && (
          <GenerationInput
            prompt={prompt}
            onPromptChange={handlePromptChange}
            mandatoryConfig={mandatoryConfig}
            showAdvanced={showAdvanced}
            onToggleAdvanced={handleShowAdvancedToggle}
            onSubmit={handleFooterGenerate}
            isGenerating={isGenerating}
            error={error}
            placeholder={elementType === 'CHART' ? 'e.g., Show quarterly revenue growth for 2024' : undefined}
          />
        )}

        {elementType !== 'TEXT_BOX' && elementType !== 'METRICS' && elementType !== 'TABLE' && elementType !== 'DIAGRAM' && researchControls}

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <FormRouter
            key={`${activationId}:${elementType}:${draftKey ?? 'new'}`}
            elementType={elementType}
            onSubmit={handleFormSubmit}
            registerSubmit={registerSubmit}
            isGenerating={isGenerating}
            slideIndex={slideIndex}
            presentationId={presentationId}
            elementContext={elementContext}
            prompt={prompt}
            showAdvanced={showAdvanced}
            registerMandatoryConfig={registerMandatoryConfig}
            researchControls={
              elementType === 'TEXT_BOX' ||
              elementType === 'METRICS' ||
              elementType === 'TABLE' ||
              elementType === 'DIAGRAM'
                ? researchControls
                : null
            }
            slotCatalog={slotCatalog}
            slotCatalogLoading={slotCatalogLoading}
            slotCatalogError={slotCatalogError}
            existingTextTarget={existingTextTarget}
            initialDraft={effectiveDraft}
            onDraftChange={onDraftChange}
            existingInfographicTarget={existingInfographicTarget}
            panelMode={mode}
            existingDiagramTarget={existingDiagramTarget}
          />
        </div>
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
  presentationId,
  elementContext,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  researchControls,
  slotCatalog,
  slotCatalogLoading,
  slotCatalogError,
  existingTextTarget,
  initialDraft,
  onDraftChange,
  existingInfographicTarget,
  panelMode,
  existingDiagramTarget,
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
  registerMandatoryConfig: (config: MandatoryConfig | MandatoryConfig[] | null) => void
  researchControls?: ReactNode
  slotCatalog: TemplateSlotCatalog
  slotCatalogLoading: boolean
  slotCatalogError?: string | null
  existingTextTarget?: GenerationPanelProps['existingTextTarget']
  initialDraft?: GenerationPanelProps['draft']
  onDraftChange?: GenerationPanelProps['onDraftChange']
  existingInfographicTarget?: GenerationPanelProps['existingInfographicTarget']
  panelMode: GenerationPanelProps['mode']
  existingDiagramTarget?: GenerationPanelProps['existingDiagramTarget']
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
      return <TextBoxForm {...commonProps} researchControls={researchControls} slotCatalog={slotCatalog} slotCatalogLoading={slotCatalogLoading} slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} />
    case 'METRICS':
      return <MetricsForm {...commonProps} researchControls={researchControls} existingTextTarget={existingTextTarget} initialDraft={initialDraft} />
    case 'TABLE':
      return <TableForm {...commonProps} researchControls={researchControls} initialDraft={initialDraft} onDraftChange={onDraftChange} />
    case 'CHART':
      return <ChartForm {...commonProps} />
    case 'IMAGE':
      return <ImageForm {...commonProps} />
    case 'ICON_LABEL':
      return <IconLabelForm {...commonProps} />
    case 'SHAPE':
      return <ShapeForm {...commonProps} />
    case 'INFOGRAPHIC':
      return (
        <InfographicForm
          {...commonProps}
          initialDraft={initialDraft}
          panelMode={panelMode}
          existingTarget={existingInfographicTarget}
        />
      )
    case 'DIAGRAM':
      return <DiagramForm {...commonProps} researchControls={researchControls} existingDiagramTarget={existingDiagramTarget} />
    default:
      return null
  }
}

export { GenerationPanel as default }
