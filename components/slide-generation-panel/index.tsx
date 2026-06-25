'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Layout,
  List,
  Minus,
  Plus,
  Search,
  Sparkles,
  Type,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GenerationInput } from '@/components/generation-panel/shared/generation-input'
import { CollapsibleSection } from '@/components/generation-panel/shared/collapsible-section'
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
  NARRATIVE_OPTIONS,
  SHAPE_OPTIONS,
  buildInstruction,
  buildSelections,
  canUseImagePlacement,
  defaultShapeForContent,
  getShapeBucket,
  imageOptionsFor,
  isBuiltResponse,
  isNeedsInputResponse,
  isHeroLayout,
  layoutDefaults,
  normalizeQuestions,
  responseErrorMessage,
  subtypeFromSelections,
  type CanvasType,
  type ContentType,
  type HeroStyle,
  type HeroVariant,
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

type OpenSections = Record<'slideSetup' | 'grounding', boolean>
type Option<T extends string> = { value: T; label: string }

const INITIAL_OPEN_SECTIONS: OpenSections = {
  slideSetup: true,
  grounding: true,
}

const KG_CARD_ENABLED = process.env.NEXT_PUBLIC_SLIDE_COMPOSER_KG_ENABLED === 'true'

const SLIDE_TYPE_CARDS: Array<{
  value: LayoutChoice
  label: string
  description: string
  icon: LucideIcon
}> = [
  { value: 'content_text', label: 'Content slide', description: 'Text, charts, diagrams', icon: FileText },
  { value: 'hero_title', label: 'Title slide', description: 'Opening hero', icon: Type },
  { value: 'hero_section', label: 'Section divider', description: 'Chapter break', icon: List },
  { value: 'hero_closing', label: 'Closing slide', description: 'Wrap-up hero', icon: CheckCircle2 },
]

const HERO_STYLE_OPTIONS: Record<string, Array<{ value: HeroStyle; label: string }>> = {
  hero_title: [
    { value: 'editorial', label: 'Editorial' },
    { value: 'highlight_word', label: 'Highlight word' },
    { value: 'accent_bar', label: 'Accent bar' },
  ],
  hero_section: [
    { value: 'number_left', label: 'Number left' },
    { value: 'panel_left', label: 'Panel left' },
    { value: 'number_watermark', label: 'Watermark number' },
  ],
  hero_closing: [
    { value: 'thankyou', label: 'Thank you' },
    { value: 'split_contact', label: 'Contact card' },
    { value: 'quote', label: 'Quote' },
  ],
}

export function SlideGenerationPanel({
  isOpen,
  onClose,
  currentSlide,
  sessionId,
  presentationId,
  research,
  enabled,
  onBuilt,
}: SlideGenerationPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedLayout, setSelectedLayout] = useState<LayoutChoice>(AUTO_VALUE)
  const [showAdvanced, setShowAdvanced] = useState(true)
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
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [useDeepResearch, setUseDeepResearch] = useState(false)
  const [webSearchMaxQueries, setWebSearchMaxQueries] = useState(3)
  const [useUploadedDocuments, setUseUploadedDocuments] = useState(false)
  const [useKnowledgeGraph, setUseKnowledgeGraph] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [heroStyle, setHeroStyle] = useState<OptionalChoice<HeroStyle>>(AUTO_VALUE)
  const [eyebrow, setEyebrow] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')
  const [contactLinkedin, setContactLinkedin] = useState('')
  const [attribution, setAttribution] = useState('')
  const [heroBackgroundImage, setHeroBackgroundImage] = useState(false)
  const [heroLight, setHeroLight] = useState(false)
  const [openSections, setOpenSections] = useState<OpenSections>(INITIAL_OPEN_SECTIONS)

  const questions = useMemo(() => normalizeQuestions(needsInput), [needsInput])
  const shapeBucket = getShapeBucket(contentType)
  const shapeOptions = shapeBucket ? SHAPE_OPTIONS[shapeBucket] : []
  const isHero = isHeroLayout(selectedLayout) || contentType === 'hero'
  const showImagePlacement = canUseImagePlacement(contentType, shapeSubtype)
  const imageOptions = imageOptionsFor(contentType, shapeSubtype)
  const heroStyleOptions = selectedLayout !== AUTO_VALUE ? HERO_STYLE_OPTIONS[selectedLayout] ?? [] : []
  const hasUploadedFiles = Boolean(research.useUploadedDocuments)
  const heroVariant: HeroVariant = heroBackgroundImage
    ? heroLight ? 'photo_light' : 'photo_dark'
    : heroLight ? 'solid_light' : 'solid_dark'
  const allowHeroImage = isHero && (heroBackgroundImage || heroLight)
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
      heroStyle,
      eyebrow,
      contactEmail,
      contactPhone,
      contactWebsite,
      contactLinkedin,
      attribution,
      heroVariant,
      allowHeroImage,
    }),
    [
      allowHeroImage,
      attribution,
      contactEmail,
      contactLinkedin,
      contactPhone,
      contactWebsite,
      contentType,
      effectiveCanvasType,
      eyebrow,
      heroStyle,
      heroVariant,
      narrativeRole,
      selectedLayout,
      shapeSubtype,
    ],
  )

  function handleLayoutChange(layout: LayoutChoice) {
    setSelectedLayout(layout)

    const defaults = layoutDefaults(layout)
    setCanvasType(defaults.canvas_type ?? AUTO_VALUE)
    setContentType(defaults.content_type ?? AUTO_VALUE)
    setNarrativeRole(defaults.narrative_role ?? AUTO_VALUE)
    setShapeSubtype(subtypeFromSelections(defaults))
    setHeroStyle(defaultHeroStyle(layout))
    setEyebrow('')
    setContactEmail('')
    setContactPhone('')
    setContactWebsite('')
    setContactLinkedin('')
    setAttribution('')
    setHeroBackgroundImage(false)
    setHeroLight(false)
    setError(null)
    setSuccessMessage(null)
  }

  function handleContentTypeChange(value: OptionalChoice<ContentType>) {
    const defaultShape = defaultShapeForContent(value)
    setContentType(value)
    setShapeSubtype(defaultShape)
    const nextImageOptions = imageOptionsFor(value, defaultShape)
    if (!nextImageOptions.some(option => option.value === canvasType)) {
      setCanvasType(value === AUTO_VALUE ? AUTO_VALUE : 'C1')
    }
    setError(null)
    setSuccessMessage(null)
  }

  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {
    setShapeSubtype(value)
    const nextImageOptions = imageOptionsFor(contentType, value)
    if (!nextImageOptions.some(option => option.value === canvasType)) {
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
            use_uploaded_documents: hasUploadedFiles && useUploadedDocuments,
            use_web_search: useWebSearch,
            use_deep_research: useDeepResearch,
            use_knowledge_graph: KG_CARD_ENABLED && useKnowledgeGraph,
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
    hasUploadedFiles,
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
          mandatoryConfig={null}
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {SLIDE_TYPE_CARDS.map(card => (
                  <SlideTypeCard
                    key={card.value}
                    card={card}
                    selected={selectedLayout === card.value}
                    onClick={() => handleLayoutChange(card.value)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleLayoutChange(AUTO_VALUE)}
                className={cn(
                  'text-[11px] font-medium transition-colors',
                  selectedLayout === AUTO_VALUE
                    ? 'text-primary'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                Let AI choose
              </button>

              {!isHero && selectedLayout !== AUTO_VALUE && (
                <div className="space-y-2">
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
                  </div>
                  {showImagePlacement && imageOptions.length > 0 && (
                    <ImageOptionRow
                      value={canvasType}
                      options={imageOptions}
                      onChange={setCanvasType}
                    />
                  )}
                </div>
              )}

              {isHero && (
                <div className="space-y-2">
                  <SegmentedRow
                    label="Hero style"
                    value={heroStyle}
                    options={heroStyleOptions}
                    onChange={setHeroStyle}
                  />
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Kicker line</span>
                    <Input
                      value={eyebrow}
                      onChange={(event) => setEyebrow(event.target.value)}
                      placeholder="Optional"
                      className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800"
                    />
                  </label>
                  {selectedLayout === 'hero_closing' && heroStyle === 'split_contact' && (
                    <div className="grid grid-cols-2 gap-2">
                      <HeroTextInput label="Email" value={contactEmail} onChange={setContactEmail} />
                      <HeroTextInput label="Phone" value={contactPhone} onChange={setContactPhone} />
                      <HeroTextInput label="Website" value={contactWebsite} onChange={setContactWebsite} />
                      <HeroTextInput label="LinkedIn" value={contactLinkedin} onChange={setContactLinkedin} />
                    </div>
                  )}
                  {selectedLayout === 'hero_closing' && heroStyle === 'quote' && (
                    <HeroTextInput label="Attribution" value={attribution} onChange={setAttribution} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleRow
                      label="Background image"
                      description="Experimental"
                      pressed={heroBackgroundImage}
                      onClick={() => setHeroBackgroundImage(prev => !prev)}
                    />
                    <ToggleRow
                      label="Light / colored"
                      pressed={heroLight}
                      onClick={() => setHeroLight(prev => !prev)}
                    />
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showMoreOptions && 'rotate-180')} />
                  More options
                </button>
                {showMoreOptions && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Grounding */}
          <CollapsibleSection
            title="Grounding"
            isOpen={openSections.grounding}
            onToggle={() => toggleSection('grounding')}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <ResearchCard
                  icon={Search}
                  label="Web search"
                  description="Use live web grounding"
                  pressed={useWebSearch}
                  onClick={() => setUseWebSearch(prev => !prev)}
                />
                <ResearchCard
                  icon={Sparkles}
                  label="Deep research"
                  badge="Premium"
                  description="Multi-step research pass"
                  pressed={useDeepResearch}
                  onClick={() => setUseDeepResearch(prev => !prev)}
                />
                <ResearchCard
                  icon={UploadCloud}
                  label="Use my uploaded files"
                  description={hasUploadedFiles ? 'Use files attached to this session' : 'No files uploaded'}
                  pressed={hasUploadedFiles && useUploadedDocuments}
                  disabled={!hasUploadedFiles}
                  onClick={() => setUseUploadedDocuments(prev => !prev)}
                />
                {KG_CARD_ENABLED && (
                  <ResearchCard
                    icon={FileText}
                    label="Knowledge graph"
                    description="Use saved domain memory"
                    pressed={useKnowledgeGraph}
                    onClick={() => setUseKnowledgeGraph(prev => !prev)}
                  />
                )}
              </div>

              {(useWebSearch || useDeepResearch) && (
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
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}

function defaultHeroStyle(layout: LayoutChoice): OptionalChoice<HeroStyle> {
  if (layout === 'hero_title') return 'editorial'
  if (layout === 'hero_section') return 'number_left'
  if (layout === 'hero_closing') return 'thankyou'
  return AUTO_VALUE
}

function SlideTypeCard({
  card,
  selected,
  onClick,
}: {
  card: (typeof SLIDE_TYPE_CARDS)[number]
  selected: boolean
  onClick: () => void
}) {
  const Icon = card.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative min-h-[72px] rounded-md border p-2 text-left transition-colors',
        selected
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        {selected && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />}
      </div>
      <div className="mt-2">
        <div className="text-xs font-medium">{card.label}</div>
        <div className={cn('mt-0.5 text-[10px]', selected ? 'text-primary/80' : 'text-gray-400 dark:text-slate-500')}>
          {card.description}
        </div>
      </div>
    </button>
  )
}

function ImageOptionRow({
  value,
  options,
  onChange,
}: {
  value: OptionalChoice<CanvasType>
  options: Array<{ value: OptionalChoice<CanvasType>; label: string }>
  onChange: (value: OptionalChoice<CanvasType>) => void
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Image option</span>
      <div className="flex flex-wrap gap-1">
        {options.map(option => {
          const selected = value === option.value || (option.value === 'C1' && value !== AUTO_VALUE && !value.startsWith('I'))
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                selected
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: OptionalChoice<T>
  options: Array<Option<T>>
  onChange: (value: OptionalChoice<T>) => void
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
              value === option.value
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function HeroTextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Optional"
        className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800"
      />
    </label>
  )
}

function ResearchCard({
  icon: Icon,
  label,
  description,
  badge,
  pressed,
  onClick,
  disabled = false,
}: {
  icon: LucideIcon
  label: string
  description: string
  badge?: string
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
        'flex items-center gap-2 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        pressed
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-medium">
          {label}
          {badge && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-[10px] text-gray-400 dark:text-slate-500">{description}</span>
      </span>
      {pressed && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />}
    </button>
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
  description,
  pressed,
  onClick,
  disabled = false,
}: {
  label: string
  description?: string
  pressed: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-gray-600 dark:text-slate-300">{label}</span>
        {description && <span className="block truncate text-[9px] text-gray-400 dark:text-slate-500">{description}</span>}
      </span>
      <ToggleButton pressed={pressed} onClick={onClick} disabled={disabled} />
    </div>
  )
}
