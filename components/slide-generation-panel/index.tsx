'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Layout, Minus, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GenerationInput } from '@/components/generation-panel/shared/generation-input'
import { CollapsibleSection } from '@/components/generation-panel/shared/collapsible-section'
import { MandatoryConfig } from '@/components/generation-panel/types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SlideLayoutType } from '@/types/elements'
import {
  AUTO_VALUE,
  CONTENT_OPTIONS,
  IMAGE_PLACEMENT_OPTIONS,
  NARRATIVE_OPTIONS,
  SHAPE_OPTIONS,
  buildInstruction,
  buildSelections,
  canUseImagePlacement,
  defaultShapeForContent,
  getLayoutDescription,
  getLayoutLabel,
  getShapeBucket,
  isBuiltResponse,
  isNeedsInputResponse,
  isHeroLayout,
  layoutDefaults,
  normalizeQuestions,
  responseErrorMessage,
  slideTypeGroups,
  subtypeFromSelections,
  type CanvasType,
  type ContentType,
  type LayoutChoice,
  type NarrativeRole,
  type OptionalChoice,
  type ShapeSubtype,
  type SlideComposeBuiltResult,
  type SlideComposeNeedsInputResult,
} from './compose-helpers'

export type { SlideComposeBuiltResult, SlideComposeNeedsInputResult } from './compose-helpers'

interface SlideComposerResearchState {
  useUploadedDocuments: boolean
  useWebSearch: boolean
  useDeepResearch: boolean
  useKnowledgeGraph: boolean
}

interface SlideGenerationPanelProps {
  isOpen: boolean
  onClose: () => void
  currentSlide: number
  currentLayout?: SlideLayoutType
  sessionId: string
  presentationId: string | null
  research: SlideComposerResearchState
  enabled: boolean
  onBuilt: (result: SlideComposeBuiltResult) => void
}

type OpenSections = Record<'slideSetup' | 'grounding' | 'comingSoon', boolean>
type Option<T extends string> = { value: T; label: string }

const INITIAL_OPEN_SECTIONS: OpenSections = {
  slideSetup: true,
  grounding: true,
  comingSoon: false,
}

export function SlideGenerationPanel({
  isOpen,
  onClose,
  currentSlide,
  sessionId,
  presentationId,
  research: _research,
  enabled,
  onBuilt,
}: SlideGenerationPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedLayout, setSelectedLayout] = useState<LayoutChoice>(AUTO_VALUE)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [needsInput, setNeedsInput] = useState<SlideComposeNeedsInputResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [canvasType, setCanvasType] = useState<OptionalChoice<CanvasType>>(AUTO_VALUE)
  const [contentType, setContentType] = useState<OptionalChoice<ContentType>>(AUTO_VALUE)
  const [shapeSubtype, setShapeSubtype] = useState<OptionalChoice<ShapeSubtype>>(AUTO_VALUE)
  const [narrativeRole, setNarrativeRole] = useState<OptionalChoice<NarrativeRole>>(AUTO_VALUE)
  const [keyMessage, setKeyMessage] = useState('')
  const [groundWithResearch, setGroundWithResearch] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [useDeepResearch, setUseDeepResearch] = useState(false)
  const [webSearchMaxQueries, setWebSearchMaxQueries] = useState(3)
  const [useUploadedDocuments, setUseUploadedDocuments] = useState(false)
  const [useKnowledgeGraph, setUseKnowledgeGraph] = useState(false)
  const [openSections, setOpenSections] = useState<OpenSections>(INITIAL_OPEN_SECTIONS)

  const questions = useMemo(() => normalizeQuestions(needsInput), [needsInput])
  const shapeBucket = getShapeBucket(contentType)
  const shapeOptions = shapeBucket ? SHAPE_OPTIONS[shapeBucket] : []
  const isHero = isHeroLayout(selectedLayout) || contentType === 'hero'
  const showImagePlacement = canUseImagePlacement(contentType, shapeSubtype)
  const effectiveCanvasType = showImagePlacement
    ? canvasType
    : contentType !== AUTO_VALUE && contentType !== 'hero'
      ? 'C1'
      : canvasType
  const selections = useMemo(
    () => buildSelections({
      layout: selectedLayout,
      canvasType: effectiveCanvasType,
      contentType,
      shapeSubtype,
      narrativeRole,
    }),
    [contentType, effectiveCanvasType, narrativeRole, selectedLayout, shapeSubtype],
  )

  const mandatoryConfig: MandatoryConfig = {
    fieldLabel: 'Slide Layout',
    displayLabel: getLayoutLabel(selectedLayout),
    optionGroups: slideTypeGroups,
    onChange: (value: string) => handleLayoutChange(value as LayoutChoice),
    promptPlaceholder: 'Describe the slide you want to generate or edit...',
  }

  function handleLayoutChange(layout: LayoutChoice) {
    setSelectedLayout(layout)

    const defaults = layoutDefaults(layout)
    setCanvasType(defaults.canvas_type ?? AUTO_VALUE)
    setContentType(defaults.content_type ?? AUTO_VALUE)
    setNarrativeRole(defaults.narrative_role ?? AUTO_VALUE)
    setShapeSubtype(subtypeFromSelections(defaults))
    setError(null)
    setSuccessMessage(null)
  }

  function handleContentTypeChange(value: OptionalChoice<ContentType>) {
    setContentType(value)
    setShapeSubtype(defaultShapeForContent(value))
    if (!canUseImagePlacement(value, defaultShapeForContent(value))) {
      setCanvasType(value === AUTO_VALUE ? AUTO_VALUE : 'C1')
    }
    setError(null)
    setSuccessMessage(null)
  }

  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {
    setShapeSubtype(value)
    if (!canUseImagePlacement(contentType, value)) {
      setCanvasType(contentType === AUTO_VALUE || contentType === 'hero' ? AUTO_VALUE : 'C1')
    }
    setError(null)
    setSuccessMessage(null)
  }

  const handleGenerate = useCallback(async () => {
    const instruction = buildInstruction(prompt, keyMessage, questions, answers)
    const hasSelections = Object.keys(selections).length > 0

    setError(null)
    setSuccessMessage(null)

    if (!enabled) {
      setError('Slide Composer is disabled.')
      return
    }

    if (!sessionId) {
      setError('No active builder session is available yet.')
      return
    }

    if (!instruction && !hasSelections) {
      setError('Describe the slide or choose an optional slide setting.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/slides/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          presentation_id: presentationId,
          insert_after_index: presentationId ? Math.max(0, currentSlide - 1) : null,
          instruction,
          selections: hasSelections ? selections : undefined,
          research: {
            use_uploaded_documents: groundWithResearch && useUploadedDocuments,
            use_web_search: groundWithResearch && useWebSearch,
            use_deep_research: groundWithResearch && useWebSearch && useDeepResearch,
            use_knowledge_graph: groundWithResearch && useKnowledgeGraph,
            web_search_max_queries: webSearchMaxQueries,
          },
          assume_on_missing: false,
        }),
      })

      const data: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(responseErrorMessage(data))
      }

      if (isNeedsInputResponse(data)) {
        setNeedsInput(data)
        setAnswers({})
        return
      }

      if (isBuiltResponse(data)) {
        setNeedsInput(null)
        setAnswers({})
        setPrompt('')
        setKeyMessage('')
        setSuccessMessage(`Built slide ${data.slide_index + 1}.`)
        onBuilt(data)
        return
      }

      throw new Error(responseErrorMessage(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slide Composer failed')
    } finally {
      setIsGenerating(false)
    }
  }, [
    answers,
    currentSlide,
    enabled,
    keyMessage,
    onBuilt,
    presentationId,
    prompt,
    questions,
    selections,
    sessionId,
    groundWithResearch,
    useDeepResearch,
    useKnowledgeGraph,
    useUploadedDocuments,
    useWebSearch,
    webSearchMaxQueries,
  ])

  const toggleSection = useCallback((key: keyof OpenSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) {
        e.preventDefault()
        void handleGenerate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose, handleGenerate])

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none">
      <div
        className={cn(
          "flex-1 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0 max-w-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Layout className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Slide</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">Generate or edit slide content</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 transition-colors"
            title="Close panel"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Slide context bar */}
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">
            {presentationId ? (
              <>
                Inserts after <span className="font-semibold">Slide {currentSlide}</span>
              </>
            ) : (
              <>
                Editing <span className="font-semibold">Slide {currentSlide}</span>
              </>
            )}
          </p>
        </div>

        {/* Generation input */}
        <GenerationInput
          prompt={prompt}
          onPromptChange={(value) => {
            setPrompt(value)
            setNeedsInput(null)
            setError(null)
            setSuccessMessage(null)
          }}
          mandatoryConfig={mandatoryConfig}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced(prev => !prev)}
          onSubmit={() => void handleGenerate()}
          isGenerating={isGenerating}
          error={error}
        />

        {successMessage && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {needsInput && (
          <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-amber-800">More input needed</p>
                {questions.map((question) => (
                  <label key={question.slot} className="block space-y-1">
                    <span className="text-[11px] text-amber-800">{question.ask}</span>
                    <Textarea
                      value={answers[question.slot] ?? ''}
                      onChange={(event) => setAnswers(prev => ({ ...prev, [question.slot]: event.target.value }))}
                      rows={2}
                      className="min-h-0 border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus-visible:ring-amber-300"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                  className="rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advanced sections */}
        <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 ${!showAdvanced ? 'hidden' : ''}`}>
          {/* Slide setup */}
          <CollapsibleSection
            title="Slide setup"
            isOpen={openSections.slideSetup}
            onToggle={() => toggleSection('slideSetup')}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-200">{getLayoutLabel(selectedLayout)}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">
                  {selectedLayout === AUTO_VALUE ? 'optional' : selectedLayout}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">{getLayoutDescription(selectedLayout)}</p>

              {!isHero && (
                <div className="grid grid-cols-2 gap-2">
                  <CompactSelect
                    label="Content type"
                    value={contentType}
                    onValueChange={handleContentTypeChange}
                    options={CONTENT_OPTIONS}
                  />
                  <CompactSelect
                    label="Layout style"
                    value={shapeSubtype}
                    onValueChange={handleShapeChange}
                    options={shapeOptions}
                    disabled={!shapeBucket}
                  />
                  {showImagePlacement && (
                    <div className="col-span-2">
                      <CompactSelect
                        label="Image placement"
                        value={canvasType.startsWith('I') ? canvasType : AUTO_VALUE}
                        onValueChange={setCanvasType}
                        options={IMAGE_PLACEMENT_OPTIONS}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <CompactSelect
                  label="Purpose"
                  value={narrativeRole}
                  onValueChange={setNarrativeRole}
                  options={NARRATIVE_OPTIONS}
                />
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Key message</span>
                  <Input
                    value={keyMessage}
                    onChange={(event) => setKeyMessage(event.target.value)}
                    placeholder="Optional"
                    className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800"
                  />
                </label>
              </div>
            </div>
          </CollapsibleSection>

          {/* Grounding */}
          <CollapsibleSection
            title="Grounding"
            isOpen={openSections.grounding}
            onToggle={() => toggleSection('grounding')}
          >
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Ground with research
                </span>
                <ToggleButton
                  pressed={groundWithResearch}
                  onClick={() => setGroundWithResearch(prev => !prev)}
                />
              </div>
              {groundWithResearch && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleRow
                      label="Web search"
                      pressed={useWebSearch}
                      onClick={() => {
                        setUseWebSearch(prev => {
                          if (prev) setUseDeepResearch(false)
                          return !prev
                        })
                      }}
                    />
                    <ToggleRow
                      label="Deep research"
                      pressed={useDeepResearch}
                      disabled={!useWebSearch}
                      onClick={() => setUseDeepResearch(prev => !prev)}
                    />
                    <ToggleRow
                      label="Uploaded docs"
                      pressed={useUploadedDocuments}
                      onClick={() => setUseUploadedDocuments(prev => !prev)}
                    />
                    <ToggleRow
                      label="Knowledge graph"
                      pressed={useKnowledgeGraph}
                      onClick={() => setUseKnowledgeGraph(prev => !prev)}
                    />
                  </div>
                  {useWebSearch && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                        Max queries
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setWebSearchMaxQueries(prev => Math.max(1, prev - 1))}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          title="Decrease max queries"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs text-gray-700 dark:text-slate-200">{webSearchMaxQueries}</span>
                        <button
                          type="button"
                          onClick={() => setWebSearchMaxQueries(prev => Math.min(10, prev + 1))}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          title="Increase max queries"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Coming soon */}
          <CollapsibleSection
            title="Coming soon"
            isOpen={openSections.comingSoon}
            onToggle={() => toggleSection('comingSoon')}
          >
            <div className="space-y-3 opacity-75" aria-disabled="true">
              <div className="bg-gray-50 dark:bg-slate-800 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Layout preview coming soon</p>
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Title</label>
                <div className="mt-1 h-8 rounded-md bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 px-2 flex items-center">
                  <span className="text-xs text-gray-300">Title text</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Subtitle</label>
                <div className="mt-1 h-8 rounded-md bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 px-2 flex items-center">
                  <span className="text-xs text-gray-300">Subtitle text</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Body</label>
                <div className="mt-1 h-16 rounded-md bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 px-2 pt-2">
                  <span className="text-xs text-gray-300">Body content</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Color, gradient, and background image options — Coming soon</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Heading font, body font, size scale — Coming soon</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Image, chart, and diagram configuration — Coming soon</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Slide transitions and timing — Coming soon</p>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}

function CompactSelect<T extends string>({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
}: {
  label: string
  value: OptionalChoice<T>
  onValueChange: (value: OptionalChoice<T>) => void
  options: Array<Option<T>>
  disabled?: boolean
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <Select
        value={disabled ? AUTO_VALUE : value}
        onValueChange={(next) => onValueChange(next as OptionalChoice<T>)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO_VALUE}>Auto / let AI decide</SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function ToggleButton({
  pressed,
  onClick,
  disabled = false,
}: {
  pressed: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
      )}
    >
      {pressed ? 'On' : 'Off'}
    </button>
  )
}

function ToggleRow({
  label,
  pressed,
  onClick,
  disabled = false,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
      <span className="min-w-0 truncate text-[11px] text-gray-600 dark:text-slate-300">{label}</span>
      <ToggleButton pressed={pressed} onClick={onClick} disabled={disabled} />
    </div>
  )
}
