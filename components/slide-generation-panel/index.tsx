'use client'

import { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect, type ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileText,
  GitBranch,
  Layout,
  LayoutGrid,
  List,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import '@/components/builder/studio-panels.css'
import './studio-slide-generation.css'
import './studio-slide-generation-menus.css'
import { features } from '@/lib/config'
import { shouldYieldStudioSlidePanelShortcut } from '@/lib/studio-slide-shortcuts'
import { FALLBACK_THEME_PRESETS, type BuildThemeSelection } from '@/lib/theme-builder'
// Aliased: `useKnowledgeGraph` is already a local state name in this panel.
import { useKnowledgeGraph as useKnowledgeGraphEntitlement } from '@/hooks/use-knowledge-graph'
import { withAsyncSlideComposeFields } from '@/lib/slide-compose-async'
import { GenerationInput } from '@/components/generation-panel/shared/generation-input'
import { CollapsibleSection } from '@/components/generation-panel/shared/collapsible-section'
import type { SlideRefineTarget } from '@/lib/slide-refinement'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SlideLayoutType } from '@/types/elements'
import {
  AUTO_VALUE,
  SHAPE_OPTIONS,
  buildInstruction,
  buildSelections,
  canUseImagePlacement,
  defaultShapeForContent,
  getShapeBucket,
  isAcceptedResponse,
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
  type SlideComposeAcceptedJob,
  type SlideComposeBuiltResult,
  type SlideComposeNeedsInputResult,
} from './compose-helpers'

export type { SlideComposeAcceptedJob, SlideComposeBuiltResult, SlideComposeNeedsInputResult } from './compose-helpers'

function scTrace(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!features.slideComposerTraceEnabled && window.localStorage?.getItem('deckster.slideComposerTrace') !== 'true') return
  console.info('[SC_TRACE]', event, payload)
}

interface SlideComposerResearchState {
  useUploadedDocuments: boolean
  useWebSearch: boolean
  useDeepResearch: boolean
  useKnowledgeGraph: boolean
}

export interface SlideComposePanelEvent {
  jobId: string
  status: 'building' | 'built' | 'error'
  message?: string
}
export interface StudioSlideBuiltSelection {
  proof: object | null
  draftStillCurrent: boolean
}

interface SlideGenerationPanelProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'compose' | 'refine'
  refineTarget?: SlideRefineTarget | null
  currentSlide: number
  currentLayout?: SlideLayoutType
  sessionId: string
  presentationId: string | null
  research: SlideComposerResearchState
  buildThemeSelection: BuildThemeSelection
  activeBuildThemeProfileName?: string | null
  enabled: boolean
  studioOwner?: object
  onBuilt: (result: SlideComposeBuiltResult, selection?: StudioSlideBuiltSelection) => void
  onSelectionRequestStart?: (lane?: 'compose' | 'refine') => Promise<object | null>
  onAccepted?: (job: SlideComposeAcceptedJob) => void
  jobEvent?: SlideComposePanelEvent | null
}

type OpenSections = Record<'slideSetup' | 'grounding', boolean>
type HeroBackgroundChoice = Extract<HeroVariant, 'solid_dark' | 'solid_light' | 'photo_dark'>
type ShapeGlyph =
  | 'auto'
  | 'columns'
  | 'rows'
  | 'grid'
  | 'table'
  | 'chart_single'
  | 'chart_two_vertical'
  | 'chart_two_horizontal'
  | 'chart_three'
  | 'chart_quad'
  | 'spine_left'
  | 'spine_center'
  | 'spine_top'
  | 'diagram'

const INITIAL_OPEN_SECTIONS: OpenSections = {
  slideSetup: true,
  grounding: true,
}

// Default ON (KG v2 P0, D-KG appendix): the card is inert unless the user is
// entitled + subscribed and the KG backend is activated, so showing it is safe.
// Set NEXT_PUBLIC_SLIDE_COMPOSER_KG_ENABLED=false to hide explicitly.
const KG_CARD_ENABLED = process.env.NEXT_PUBLIC_SLIDE_COMPOSER_KG_ENABLED !== 'false'

const SLIDE_TYPE_OPTIONS: Array<{
  value: LayoutChoice
  label: string
  description: string
  icon: LucideIcon
}> = [
  { value: AUTO_VALUE, label: 'Let AI choose', description: 'Infer slide type', icon: Sparkles },
  { value: 'content_text', label: 'Content slide', description: 'Text, charts, diagrams', icon: FileText },
  { value: 'hero_title', label: 'Title slide', description: 'Opening hero', icon: Type },
  { value: 'hero_section', label: 'Section divider', description: 'Chapter break', icon: List },
  { value: 'hero_closing', label: 'Closing slide', description: 'Wrap-up hero', icon: CheckCircle2 },
]

const CONTENT_TYPE_OPTIONS: Array<{
  value: OptionalChoice<ContentType>
  label: string
  description: string
  icon: LucideIcon
}> = [
  { value: 'text_heavy_columns', label: 'Text', description: 'Text-heavy layout', icon: Type },
  { value: 'chart', label: 'Chart', description: 'Data visualization', icon: BarChart3 },
  { value: 'infographic', label: 'Infographic', description: 'Visual explanation', icon: LayoutGrid },
  { value: 'diagram_idea_board', label: 'Diagram', description: 'Structured diagram', icon: GitBranch },
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

const HERO_BACKGROUND_OPTIONS: Array<{ value: HeroBackgroundChoice; label: string }> = [
  { value: 'solid_dark', label: 'Dark' },
  { value: 'solid_light', label: 'Light' },
  { value: 'photo_dark', label: 'Photo (experimental)' },
]

const SHAPE_GLYPHS: Partial<Record<ShapeSubtype, ShapeGlyph>> = {
  text_heavy_columns: 'columns',
  text_heavy_rows: 'rows',
  text_heavy_grid: 'grid',
  table: 'table',
  single: 'chart_single',
  two_vertical: 'chart_two_vertical',
  two_horizontal: 'chart_two_horizontal',
  three_horizontal: 'chart_three',
  four_quadrant: 'chart_quad',
  vertical_left: 'spine_left',
  vertical_center: 'spine_center',
  horizontal_top: 'spine_top',
  horizontal_center: 'spine_center',
  idea_board: 'diagram',
  code_display: 'diagram',
  kanban_board: 'columns',
  gantt_chart: 'rows',
  multi_chevron_maturity_board: 'diagram',
  logical_architecture: 'diagram',
  cloud_architecture: 'diagram',
  data_architecture: 'diagram',
}

export function SlideGenerationPanel({
  isOpen,
  onClose,
  mode = 'compose',
  refineTarget = null,
  currentSlide,
  sessionId,
  presentationId,
  research,
  buildThemeSelection,
  activeBuildThemeProfileName,
  enabled,
  studioOwner,
  onBuilt,
  onSelectionRequestStart,
  onAccepted,
  jobEvent,
}: SlideGenerationPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedLayout, setSelectedLayout] = useState<LayoutChoice>(AUTO_VALUE)
  const [showAdvanced, setShowAdvanced] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [acceptedJobId, setAcceptedJobId] = useState<string | null>(null)
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
  // Same gate as the chat KG toggle: entitled + subscribed users only.
  const { isEntitled: kgEntitled, isSubscribed: kgSubscribed } = useKnowledgeGraphEntitlement()
  const kgCardVisible = KG_CARD_ENABLED && kgEntitled && kgSubscribed
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [heroStyle, setHeroStyle] = useState<OptionalChoice<HeroStyle>>(AUTO_VALUE)
  const [eyebrow, setEyebrow] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')
  const [contactLinkedin, setContactLinkedin] = useState('')
  const [attribution, setAttribution] = useState('')
  const [heroBackground, setHeroBackground] = useState<HeroBackgroundChoice>('solid_dark')
  const [openSections, setOpenSections] = useState<OpenSections>(INITIAL_OPEN_SECTIONS)
  const panelRootRef = useRef<HTMLDivElement>(null)
  const lastPanelContextKeyRef = useRef<string | null>(null)

  const isRefineMode = mode === 'refine'
  const refineSlideNumber = refineTarget ? refineTarget.slide_index + 1 : currentSlide
  const panelTitle = isRefineMode
    ? `Refine slide ${refineSlideNumber}${refineTarget?.title ? ` — ${refineTarget.title}` : ''}`
    : 'Slide'
  const panelSubtitle = isRefineMode ? 'Update the selected slide' : 'Generate or edit slide content'
  const questions = useMemo(() => normalizeQuestions(needsInput), [needsInput])
  const shapeBucket = getShapeBucket(contentType)
  const shapeOptions = shapeBucket ? SHAPE_OPTIONS[shapeBucket] : []
  const isHero = isHeroLayout(selectedLayout) || contentType === 'hero'
  const isDiagram = contentType !== AUTO_VALUE && contentType.startsWith('diagram_')
  const showImagePlacement = canUseImagePlacement(contentType, shapeSubtype)
  const imageOptions = imageOptionsFor(contentType, shapeSubtype)
  const heroStyleOptions = selectedLayout !== AUTO_VALUE ? HERO_STYLE_OPTIONS[selectedLayout] ?? [] : []
  const themeLabel = isRefineMode ? 'Deck theme' : getBuildThemeLabel(buildThemeSelection, activeBuildThemeProfileName)
  const shapeDropdownOptions = useMemo<Array<{ value: OptionalChoice<ShapeSubtype>; label: string; glyph: ShapeGlyph }>>(
    () => [
      { value: AUTO_VALUE, label: 'Auto', glyph: 'auto' as ShapeGlyph },
      ...shapeOptions.map(option => ({
        value: option.value,
        label: option.label,
        glyph: SHAPE_GLYPHS[option.value] ?? 'diagram',
      })),
    ],
    [shapeOptions],
  )
  const heroStyleDropdownOptions = useMemo(
    () => heroStyleOptions.map(option => ({
      value: option.value,
      label: option.label,
      icon: Layout,
    })),
    [heroStyleOptions],
  )

  useEffect(() => {
    if (!isOpen) {
      if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') lastPanelContextKeyRef.current = null
      return
    }

    const panelContextKey = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
      ? JSON.stringify([mode, sessionId, presentationId, isRefineMode ? refineTarget?.slide_id ?? 'index' : 'compose', isRefineMode ? refineTarget?.slide_index ?? currentSlide - 1 : currentSlide])
      : isRefineMode
      ? `refine:${refineTarget?.slide_id ?? 'index'}:${refineTarget?.slide_index ?? currentSlide - 1}`
      : 'compose'

    if (lastPanelContextKeyRef.current === panelContextKey) return
    lastPanelContextKeyRef.current = panelContextKey

    setPrompt('')
    setKeyMessage('')
    setError(null)
    setSuccessMessage(null)
    setAcceptedJobId(null)
    setNeedsInput(null)
    setAnswers({})

    if (isRefineMode) {
      setUseWebSearch(false)
      setUseDeepResearch(false)
      setUseUploadedDocuments(false)
      setUseKnowledgeGraph(false)
      return
    }

    setUseWebSearch(research.useWebSearch)
    setUseDeepResearch(research.useDeepResearch)
    setUseUploadedDocuments(research.useUploadedDocuments)
    setUseKnowledgeGraph(research.useKnowledgeGraph)
  }, [
    currentSlide,
    isOpen,
    isRefineMode,
    mode,
    sessionId,
    presentationId,
    refineTarget?.slide_id,
    refineTarget?.slide_index,
    research.useDeepResearch,
    research.useKnowledgeGraph,
    research.useUploadedDocuments,
    research.useWebSearch,
  ])

  useEffect(() => {
    if (!acceptedJobId || jobEvent?.jobId !== acceptedJobId) return
    if (jobEvent.status === 'built') {
      setError(null)
      setSuccessMessage(jobEvent.message || 'Slide built.')
      return
    }
    if (jobEvent.status === 'error') {
      setSuccessMessage(null)
      setError(jobEvent.message || 'Slide generation failed.')
    }
  }, [acceptedJobId, jobEvent])
  const hasUploadedFiles = Boolean(research.useUploadedDocuments)
  const heroVariant: HeroVariant = heroBackground
  const allowHeroImage = isHero && heroBackground !== 'solid_dark'
  const effectiveCanvasType = showImagePlacement
    ? canvasType
    : contentType !== AUTO_VALUE && contentType !== 'hero'
      ? 'C1'
      : canvasType
  const selections = useMemo(
    () => {
      const next = buildSelections({
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
      })
      delete next.narrative_role
      return next
    },
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
    if (!changeStudioComposeIntent('selectedLayout', layout)) return
    setSelectedLayout(layout)

    const defaults = layoutDefaults(layout)
    if (studioPanel) Object.assign(studioIntentValuesRef.current, {
      canvasType: defaults.canvas_type ?? AUTO_VALUE,
      contentType: defaults.content_type ?? AUTO_VALUE,
      shapeSubtype: subtypeFromSelections(defaults),
      heroStyle: defaultHeroStyle(layout), eyebrow: '', contactEmail: '', contactPhone: '',
      contactWebsite: '', contactLinkedin: '', attribution: '', heroBackground: 'solid_dark',
    })
    setCanvasType(defaults.canvas_type ?? AUTO_VALUE)
    setContentType(defaults.content_type ?? AUTO_VALUE)
    setNarrativeRole(AUTO_VALUE)
    setShapeSubtype(subtypeFromSelections(defaults))
    setHeroStyle(defaultHeroStyle(layout))
    setEyebrow('')
    setContactEmail('')
    setContactPhone('')
    setContactWebsite('')
    setContactLinkedin('')
    setAttribution('')
    setHeroBackground('solid_dark')
    setError(null)
    setSuccessMessage(null)
    setAcceptedJobId(null)
  }

  function handleContentTypeChange(value: OptionalChoice<ContentType>) {
    if (!changeStudioComposeIntent('contentType', value)) return
    const defaultShape = defaultShapeForContent(value)
    if (studioPanel) studioIntentValuesRef.current.shapeSubtype = defaultShape
    setContentType(value)
    setShapeSubtype(defaultShape)
    const nextImageOptions = imageOptionsFor(value, defaultShape)
    const currentCanvas = studioPanel ? studioIntentValuesRef.current.canvasType : canvasType
    if (!nextImageOptions.some(option => option.value === currentCanvas)) {
      if (studioPanel) studioIntentValuesRef.current.canvasType = value === AUTO_VALUE ? AUTO_VALUE : 'C1'
      setCanvasType(value === AUTO_VALUE ? AUTO_VALUE : 'C1')
    }
    setError(null)
    setSuccessMessage(null)
  }

  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {
    if (!changeStudioComposeIntent('shapeSubtype', value)) return
    setShapeSubtype(value)
    const currentContent = studioPanel ? studioIntentValuesRef.current.contentType as OptionalChoice<ContentType> : contentType
    const currentCanvas = studioPanel ? studioIntentValuesRef.current.canvasType : canvasType
    const nextImageOptions = imageOptionsFor(currentContent, value)
    if (!nextImageOptions.some(option => option.value === currentCanvas)) {
      const nextCanvas = currentContent === AUTO_VALUE || currentContent === 'hero' ? AUTO_VALUE : 'C1'
      if (studioPanel) studioIntentValuesRef.current.canvasType = nextCanvas
      setCanvasType(nextCanvas)
    }
    setError(null)
    setSuccessMessage(null)
  }

  // Studio keeps a pending request attached to its original draft/context.
  // A legitimate result still reaches the parent; it cannot clear a newer draft.
  const studioPanel = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const [studioLifetime, setStudioLifetime] = useState(() => ({ active: false, retired: false }))
  const studioLifetimeRef = useRef(studioLifetime)
  const studioContextKey = studioPanel ? JSON.stringify([isOpen, mode, sessionId, presentationId, currentSlide, refineTarget?.slide_id, refineTarget?.slide_index]) : ''
  const studioContextRef = useRef({ key: studioContextKey, owner: studioOwner })
  if (studioPanel && (studioContextRef.current.key !== studioContextKey || studioContextRef.current.owner !== studioOwner)) {
    studioContextRef.current = { key: studioContextKey, owner: studioOwner }
  }
  const studioContext = studioContextRef.current
  // Clarification belongs to the base request. Questions, answers and retry
  // state are deliberately excluded, so answering a real gate preserves it.
  const studioClarificationKey = studioPanel ? JSON.stringify([
    prompt, keyMessage, selections, buildThemeSelection, enabled,
    !isDiagram && hasUploadedFiles && useUploadedDocuments,
    !isDiagram && useWebSearch, !isDiagram && useDeepResearch,
    !isDiagram && kgCardVisible && useKnowledgeGraph, webSearchMaxQueries,
  ], (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value) : ''
  const studioClarificationRef = useRef({ key: studioClarificationKey, context: studioContext, lifetime: studioLifetime })
  const retireClarification = studioPanel && (
    studioClarificationRef.current.key !== studioClarificationKey
    || studioClarificationRef.current.context !== studioContext
    || studioClarificationRef.current.lifetime !== studioLifetime
  )
  const studioIntentValuesRef = useRef<Record<string, unknown>>({})
  studioIntentValuesRef.current = {
    prompt, keyMessage, selectedLayout, contentType, shapeSubtype, canvasType,
    heroStyle, eyebrow, contactEmail, contactPhone, contactWebsite, contactLinkedin,
    attribution, heroBackground, useWebSearch, useDeepResearch,
    useUploadedDocuments, useKnowledgeGraph, webSearchMaxQueries,
  }
  const studioDraftKey = studioPanel ? JSON.stringify([prompt, keyMessage, questions, answers, selections, buildThemeSelection, enabled, hasUploadedFiles, kgCardVisible, useUploadedDocuments, useWebSearch, useDeepResearch, useKnowledgeGraph, webSearchMaxQueries]) : ''
  const studioDraftRef = useRef({ key: studioDraftKey, context: studioContext, lifetime: studioLifetime })
  if (studioPanel && (studioDraftRef.current.key !== studioDraftKey || studioDraftRef.current.context !== studioContext || studioDraftRef.current.lifetime !== studioLifetime)) {
    studioDraftRef.current = { key: studioDraftKey, context: studioContext, lifetime: studioLifetime }
  }
  const studioDraft = studioDraftRef.current
  const studioRequestRef = useRef<symbol | null>(null)
  function retireStudioDraft() {
    if (studioPanel) studioDraftRef.current = { ...studioDraftRef.current }
  }
  function changeStudioComposeIntent(key: string, value: unknown) {
    if (!studioPanel) return true
    if (Object.is(studioIntentValuesRef.current[key], value)) return false
    // Retire immediately, including A→B→A before React renders. A late response
    // cannot reattach questions to a different draft merely because it is clean.
    studioIntentValuesRef.current[key] = value
    retireStudioDraft()
    setNeedsInput(null)
    setAnswers({})
    return true
  }
  useLayoutEffect(() => {
    if (!retireClarification) return
    // A render may be restarted before commit. Consume retirement only when
    // this committed effect clears the prior owner's gate.
    studioClarificationRef.current = { key: studioClarificationKey, context: studioContext, lifetime: studioLifetime }
    setNeedsInput(null)
    setAnswers({})
  }, [retireClarification, studioClarificationKey, studioContext, studioLifetime])

  useEffect(() => {
    if (!studioPanel) return
    let lifetime = studioLifetimeRef.current
    if (lifetime.retired) {
      lifetime = { active: false, retired: false }
      studioLifetimeRef.current = lifetime
      setStudioLifetime(lifetime)
    }
    lifetime.active = true
    return () => {
      lifetime.active = false
      lifetime.retired = true
    }
  }, [studioPanel])

  useEffect(() => {
    if (!studioPanel) return
    studioRequestRef.current = null
    setIsGenerating(false)
  }, [studioPanel, studioContext, studioLifetime])

  const handleGenerate = useCallback(async () => {
    if (studioPanel && (!isOpen || !studioLifetime.active || studioLifetime.retired || studioLifetimeRef.current !== studioLifetime || studioDraftRef.current !== studioDraft)) return
    const request = Symbol('slide-panel-request')
    if (studioPanel) studioRequestRef.current = request
    const ownsControls = () => !studioPanel || (studioLifetime.active && !studioLifetime.retired && studioLifetimeRef.current === studioLifetime && studioContextRef.current === studioContext && studioRequestRef.current === request)
    const ownsDraft = () => ownsControls() && (!studioPanel || studioDraftRef.current === studioDraft)
    const instruction = buildInstruction(prompt, keyMessage, questions, answers)
    const hasSelections = Object.keys(selections).length > 0
    const insertAfterIndex = presentationId ? Math.max(0, currentSlide - 1) : null
    const researchPayload = {
      use_uploaded_documents: !isDiagram && hasUploadedFiles && useUploadedDocuments,
      use_web_search: !isDiagram && useWebSearch,
      use_deep_research: !isDiagram && useDeepResearch,
      use_knowledge_graph: !isDiagram && kgCardVisible && useKnowledgeGraph,
      web_search_max_queries: webSearchMaxQueries,
    }
    const endpoint = isRefineMode ? '/api/slides/refine' : '/api/slides/compose'
    const requestBody: Record<string, unknown> = isRefineMode
      ? {
          session_id: sessionId,
          presentation_id: presentationId,
          slide_id: refineTarget?.slide_id ?? null,
          slide_index: Math.max(0, refineTarget?.slide_index ?? currentSlide - 1),
          instruction,
          theme: buildThemeSelection,
          selections: hasSelections ? selections : undefined,
          research: researchPayload,
        }
      : {
          session_id: sessionId,
          presentation_id: presentationId,
          insert_after_index: insertAfterIndex,
          instruction,
          theme: buildThemeSelection,
          selections: hasSelections ? selections : undefined,
          research: researchPayload,
        }

    setError(null)
    setSuccessMessage(null)
    setAcceptedJobId(null)

    if (!enabled) {
      setError('Slide Composer is disabled.')
      return
    }

    if (!sessionId) {
      setError('No active builder session is available yet.')
      return
    }

    if (isRefineMode && !presentationId) {
      setError('No active presentation is available to refine.')
      return
    }

    if (isRefineMode && !refineTarget) {
      setError('Choose a slide to refine.')
      return
    }

    if (isRefineMode && !instruction) {
      setError('Describe what should change.')
      return
    }

    if (!isRefineMode && !instruction && !hasSelections) {
      setError('Describe the slide or choose an optional slide setting.')
      return
    }

    if (features.slideComposerAsyncEnabled) {
      const jobId = crypto.randomUUID()
      const asyncRequest = withAsyncSlideComposeFields(requestBody, jobId)
      scTrace('panel.submit.async', {
        job_id: jobId,
        session_id: sessionId,
        presentation_id: presentationId,
        mode: isRefineMode ? 'refine' : 'compose',
        current_slide_prop: currentSlide,
        insert_after_index: insertAfterIndex,
        refine_target: isRefineMode ? refineTarget : null,
        instruction_preview: instruction.slice(0, 160),
        selections,
        research: requestBody.research,
      })

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(asyncRequest),
        })

        const data: unknown = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(responseErrorMessage(data))
        }

        if (!isAcceptedResponse(data)) {
          throw new Error(responseErrorMessage(data))
        }

        scTrace('panel.accepted.async', {
          job_id: data.job_id,
          target_index: data.target_index,
          presentation_id: data.presentation_id,
          session_id: data.session_id,
          status: data.status,
        })
        if (ownsDraft()) {
          setNeedsInput(null)
          setAnswers({})
          setPrompt('')
          setKeyMessage('')
          setSuccessMessage(isRefineMode
            ? `Refining slide ${refineSlideNumber} in the background.`
            : `Building slide ${data.target_index + 1} in the background.`
          )
          setAcceptedJobId(data.job_id)
        }
        onAccepted?.({
          ...data,
          kind: isRefineMode ? 'refine' : (data.kind ?? 'compose'),
          target_slide_id: isRefineMode ? (data.target_slide_id ?? refineTarget?.slide_id ?? null) : data.target_slide_id,
          title: instruction.slice(0, 72) || (isRefineMode ? 'Refining slide' : 'Composing slide'),
          request: asyncRequest,
        })
        return
      } catch (err) {
        scTrace('panel.error.async', {
          job_id: jobId,
          message: err instanceof Error ? err.message : String(err),
        })
        if (ownsDraft()) setError(err instanceof Error ? err.message : 'Slide Composer failed')
        return
      }
    }

    setIsGenerating(true)
    try {
      let selectionProof: object | null = null
      if (studioPanel && onSelectionRequestStart) {
        selectionProof = await onSelectionRequestStart(isRefineMode ? 'refine' : 'compose')
        if (!ownsDraft()) return
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          assume_on_missing: false,
        }),
      })

      const data: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(responseErrorMessage(data))
      }

      if (isNeedsInputResponse(data)) {
        if (ownsDraft()) {
          setNeedsInput(data)
          setAnswers({})
        }
        return
      }

      if (isBuiltResponse(data)) {
        const draftStillCurrent = ownsDraft()
        if (draftStillCurrent) {
          setNeedsInput(null)
          setAnswers({})
          setPrompt('')
          setKeyMessage('')
          setSuccessMessage(isRefineMode ? `Updated slide ${data.slide_index + 1}.` : `Built slide ${data.slide_index + 1}.`)
        }
        if (studioPanel) onBuilt(data, { proof: selectionProof, draftStillCurrent })
        else onBuilt(data)
        return
      }

      throw new Error(responseErrorMessage(data))
    } catch (err) {
      if (ownsDraft()) setError(err instanceof Error ? err.message : 'Slide Composer failed')
    } finally {
      if (ownsControls()) setIsGenerating(false)
    }
  }, [
    studioPanel,
    isOpen,
    studioLifetime,
    studioContext,
    studioDraft,
    answers,
    buildThemeSelection,
    currentSlide,
    enabled,
    hasUploadedFiles,
    isRefineMode,
    isDiagram,
    keyMessage,
    onAccepted,
    onBuilt,
    onSelectionRequestStart,
    presentationId,
    prompt,
    questions,
    refineSlideNumber,
    refineTarget,
    selections,
    sessionId,
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
      // Hidden Studio drawers remain mounted to retain production form drafts.
      // Their window shortcuts must not act on the active compact workspace.
      if (panelRootRef.current?.closest('[data-studio-v4-shell="true"] [data-studio-workspace-visible="false"]')) return
      if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && shouldYieldStudioSlidePanelShortcut(e)) return
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
        ref={panelRootRef}
        data-studio-slide-generation={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'true' : undefined}
        data-studio-v4-panel="slide-generation"
        className={cn(
          "flex-1 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0 max-w-0"
        )}
      >
        {/* Header */}
        <div data-studio-v4-panel-header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Layout className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="max-w-[300px] truncate text-xs font-semibold text-gray-900 dark:text-slate-100" title={panelTitle}>{panelTitle}</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">{panelSubtitle}</p>
            </div>
          </div>
          <button
            aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'Close slide generation panel' : undefined}
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 transition-colors"
            title="Close panel"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Slide context bar */}
        <div data-studio-v4-panel-context className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">
            {isRefineMode ? (
              <>
                Refining <span className="font-semibold">Slide {refineSlideNumber}</span>
              </>
            ) : presentationId ? (
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
            if (!changeStudioComposeIntent('prompt', value)) return
            setPrompt(value)
            setNeedsInput(null)
            setError(null)
            setSuccessMessage(null)
            setAcceptedJobId(null)
          }}
          mandatoryConfig={null}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced(prev => !prev)}
          onSubmit={() => void handleGenerate()}
          isGenerating={isGenerating}
          error={error}
          placeholder={isRefineMode ? 'What should change?' : undefined}
        />

        <div data-studio-slide-generation-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'theme' : undefined} className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Palette className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="min-w-0 truncate">
            Theme: <span className="font-medium text-slate-800 dark:text-slate-100">{themeLabel}</span>
          </span>
        </div>

        {successMessage && (
          <div data-studio-slide-generation-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'result' : undefined} role={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'status' : undefined} className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {needsInput && (
          <div data-studio-slide-generation-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'needs-input' : undefined} role={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'region' : undefined} aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'More input needed' : undefined} tabIndex={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 0 : undefined} className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-amber-800">More input needed</p>
                {questions.map((question) => (
                  <label key={question.slot} className="block space-y-1">
                    <span className="text-[11px] text-amber-800">{question.ask}</span>
                    <Textarea
                      value={answers[question.slot] ?? ''}
                      onChange={(event) => { retireStudioDraft(); setAnswers(prev => ({ ...prev, [question.slot]: event.target.value })) }}
                      rows={2}
                      className="min-h-0 border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus-visible:ring-amber-300"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  data-studio-slide-generation-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'continue' : undefined}
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
        <div data-studio-v4-panel-fields className={`flex-1 overflow-y-auto px-3 py-2 space-y-2 ${!showAdvanced ? 'hidden' : ''}`}>
          {/* Slide setup */}
          <CollapsibleSection
            title="Slide setup"
            isOpen={openSections.slideSetup}
            onToggle={() => toggleSection('slideSetup')}
          >
            <div className="space-y-2">
              <IconDropdown
                label={isRefineMode ? 'Change structure (optional)' : 'Slide type'}
                value={selectedLayout}
                options={SLIDE_TYPE_OPTIONS}
                onChange={handleLayoutChange}
              />

              {!isHero && selectedLayout !== AUTO_VALUE && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <IconDropdown
                      label="Content"
                      value={contentType}
                      options={CONTENT_TYPE_OPTIONS}
                      onChange={handleContentTypeChange}
                    />
                    <ShapeDropdown
                      label="Layout style"
                      value={shapeSubtype}
                      options={shapeDropdownOptions}
                      onChange={handleShapeChange}
                      disabled={!shapeBucket}
                    />
                  </div>
                  {showImagePlacement && imageOptions.length > 0 && (
                    <ImageOptionRow
                      value={canvasType}
                      options={imageOptions}
                      onChange={(value) => { changeStudioComposeIntent('canvasType', value); setCanvasType(value) }}
                    />
                  )}
                </div>
              )}

              {isHero && (
                <div className="space-y-2">
                  <IconDropdown
                    label="Hero style"
                    value={heroStyle}
                    options={heroStyleDropdownOptions}
                    onChange={(value) => { changeStudioComposeIntent('heroStyle', value); setHeroStyle(value) }}
                    columns={3}
                  />
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Kicker line</span>
                    <Input
                      value={eyebrow}
                      onChange={(event) => { changeStudioComposeIntent('eyebrow', event.target.value); setEyebrow(event.target.value) }}
                      placeholder="Optional"
                      className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800"
                    />
                  </label>
                  {selectedLayout === 'hero_closing' && heroStyle === 'split_contact' && (
                    <div className="grid grid-cols-2 gap-2">
                      <HeroTextInput label="Email" value={contactEmail} onChange={(value) => { changeStudioComposeIntent('contactEmail', value); setContactEmail(value) }} />
                      <HeroTextInput label="Phone" value={contactPhone} onChange={(value) => { changeStudioComposeIntent('contactPhone', value); setContactPhone(value) }} />
                      <HeroTextInput label="Website" value={contactWebsite} onChange={(value) => { changeStudioComposeIntent('contactWebsite', value); setContactWebsite(value) }} />
                      <HeroTextInput label="LinkedIn" value={contactLinkedin} onChange={(value) => { changeStudioComposeIntent('contactLinkedin', value); setContactLinkedin(value) }} />
                    </div>
                  )}
                  {selectedLayout === 'hero_closing' && heroStyle === 'quote' && (
                    <HeroTextInput label="Attribution" value={attribution} onChange={(value) => { changeStudioComposeIntent('attribution', value); setAttribution(value) }} />
                  )}
                  <CompactSelect
                    label="Background"
                    value={heroBackground}
                    onValueChange={(value) => { changeStudioComposeIntent('heroBackground', value); setHeroBackground(value) }}
                    options={HERO_BACKGROUND_OPTIONS}
                  />
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
                  <div className="mt-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">Key message</span>
                      <Input
                        value={keyMessage}
                        onChange={(event) => { changeStudioComposeIntent('keyMessage', event.target.value); setKeyMessage(event.target.value) }}
                        placeholder="Optional"
                        className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {!isDiagram && (
            <CollapsibleSection
              title="Grounding"
              isOpen={openSections.grounding}
              onToggle={() => toggleSection('grounding')}
            >
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-1.5">
                  <ToggleRow
                    label="Web search"
                    description="Use live web grounding"
                    pressed={useWebSearch}
                    onClick={() => { changeStudioComposeIntent('useWebSearch', !studioIntentValuesRef.current.useWebSearch); setUseWebSearch(prev => !prev) }}
                  />
                  <ToggleRow
                    label="Deep research"
                    badge="Premium"
                    description="Multi-step research pass"
                    pressed={useDeepResearch}
                    onClick={() => { changeStudioComposeIntent('useDeepResearch', !studioIntentValuesRef.current.useDeepResearch); setUseDeepResearch(prev => !prev) }}
                  />
                  <ToggleRow
                    label="Use my uploaded files"
                    description={hasUploadedFiles ? 'Use files attached to this session' : 'No files uploaded'}
                    pressed={hasUploadedFiles && useUploadedDocuments}
                    disabled={!hasUploadedFiles}
                    onClick={() => { changeStudioComposeIntent('useUploadedDocuments', !studioIntentValuesRef.current.useUploadedDocuments); setUseUploadedDocuments(prev => !prev) }}
                  />
                  {kgCardVisible && (
                    <ToggleRow
                      label="Use my knowledge repo"
                      description="Use saved domain memory"
                      pressed={useKnowledgeGraph}
                      onClick={() => { changeStudioComposeIntent('useKnowledgeGraph', !studioIntentValuesRef.current.useKnowledgeGraph); setUseKnowledgeGraph(prev => !prev) }}
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
                        onClick={() => { changeStudioComposeIntent('webSearchMaxQueries', Math.max(1, Number(studioIntentValuesRef.current.webSearchMaxQueries) - 1)); setWebSearchMaxQueries(prev => Math.max(1, prev - 1)) }}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        title="Decrease max queries"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs text-gray-700 dark:text-slate-200">{webSearchMaxQueries}</span>
                      <button
                        type="button"
                        onClick={() => { changeStudioComposeIntent('webSearchMaxQueries', Math.min(10, Number(studioIntentValuesRef.current.webSearchMaxQueries) + 1)); setWebSearchMaxQueries(prev => Math.min(10, prev + 1)) }}
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
          )}
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

function getBuildThemeLabel(
  selection: BuildThemeSelection,
  profileName?: string | null,
): string {
  if (selection.mode === 'auto') return 'Auto — matches deck'
  if (profileName) return profileName
  if (selection.mode === 'preset') {
    const preset = FALLBACK_THEME_PRESETS.find(item => item.preset_id === selection.preset_id)
    return preset?.name || selection.preset_id || 'Deck default'
  }
  if (selection.mode === 'custom') {
    return selection.primary_hex ? `Brand ${selection.primary_hex}` : 'Custom theme'
  }
  return 'Deck default'
}

function IconDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
  disabled = false,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; description?: string; icon: LucideIcon }>
  onChange: (value: T) => void
  columns?: 2 | 3
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const SelectedIcon = selected?.icon ?? Sparkles

  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? label : undefined}
            className="flex h-8 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <SelectedIcon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <span className="truncate">{selected?.label ?? 'Auto'}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-slate-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent data-studio-slide-menu={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? "choices" : undefined} aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? `${label} options` : undefined} align="start" className="w-64 p-2" sideOffset={4}>
          <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {options.map(option => {
              const Icon = option.icon
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? isSelected : undefined}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors',
                    isSelected
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                  title={option.description}
                >
                  <div className="flex aspect-[16/10] w-full items-center justify-center rounded border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium leading-tight">{option.label}</span>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </label>
  )
}

function ShapeDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: OptionalChoice<ShapeSubtype>
  options: Array<{ value: OptionalChoice<ShapeSubtype>; label: string; glyph: ShapeGlyph }>
  onChange: (value: OptionalChoice<ShapeSubtype>) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value) ?? options[0]

  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? label : undefined}
            className="flex h-8 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <ShapeGlyphIcon kind={selected?.glyph ?? 'auto'} />
              <span className="truncate">{selected?.label ?? 'Auto'}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-slate-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent data-studio-slide-menu={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? "choices" : undefined} aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? `${label} options` : undefined} align="start" className="w-64 p-2" sideOffset={4}>
          <div className="grid grid-cols-3 gap-2">
            {options.map(option => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? isSelected : undefined}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors',
                    isSelected
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  <div className="flex aspect-[16/10] w-full items-center justify-center rounded border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800">
                    <ShapeGlyphIcon kind={option.glyph} large />
                  </div>
                  <span className="text-[10px] font-medium leading-tight">{option.label}</span>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </label>
  )
}

function ShapeGlyphIcon({ kind, large = false }: { kind: ShapeGlyph; large?: boolean }) {
  const size = large ? 38 : 20
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const content: Record<ShapeGlyph, ReactNode> = {
    auto: (
      <>
        <path d="M10 3l1.1 3.9L15 8l-3.9 1.1L10 13 8.9 9.1 5 8l3.9-1.1L10 3z" {...common} />
        <path d="M15 13l.5 1.7L17 15l-1.5.3L15 17l-.5-1.7L13 15l1.5-.3L15 13z" {...common} />
      </>
    ),
    columns: (
      <>
        <rect x="4" y="4" width="5" height="12" rx="1" {...common} />
        <rect x="11" y="4" width="5" height="12" rx="1" {...common} />
      </>
    ),
    rows: (
      <>
        <path d="M4 5h12" {...common} />
        <path d="M4 10h12" {...common} />
        <path d="M4 15h12" {...common} />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="5" height="5" rx="1" {...common} />
        <rect x="11" y="4" width="5" height="5" rx="1" {...common} />
        <rect x="4" y="11" width="5" height="5" rx="1" {...common} />
        <rect x="11" y="11" width="5" height="5" rx="1" {...common} />
      </>
    ),
    table: (
      <>
        <rect x="3.5" y="4" width="13" height="12" rx="1" {...common} />
        <path d="M3.5 8h13M3.5 12h13M8 4v12M12 4v12" {...common} />
      </>
    ),
    chart_single: (
      <>
        <path d="M4 16h12" {...common} />
        <rect x="5" y="9" width="2.5" height="7" rx=".5" {...common} />
        <rect x="9" y="6" width="2.5" height="10" rx=".5" {...common} />
        <rect x="13" y="11" width="2.5" height="5" rx=".5" {...common} />
      </>
    ),
    chart_two_vertical: (
      <>
        <rect x="4" y="4" width="12" height="5" rx="1" {...common} />
        <rect x="4" y="11" width="12" height="5" rx="1" {...common} />
      </>
    ),
    chart_two_horizontal: (
      <>
        <rect x="4" y="4" width="5" height="12" rx="1" {...common} />
        <rect x="11" y="4" width="5" height="12" rx="1" {...common} />
      </>
    ),
    chart_three: (
      <>
        <rect x="3" y="5" width="4" height="10" rx="1" {...common} />
        <rect x="8" y="5" width="4" height="10" rx="1" {...common} />
        <rect x="13" y="5" width="4" height="10" rx="1" {...common} />
      </>
    ),
    chart_quad: (
      <>
        <rect x="4" y="4" width="5" height="5" rx="1" {...common} />
        <rect x="11" y="4" width="5" height="5" rx="1" {...common} />
        <rect x="4" y="11" width="5" height="5" rx="1" {...common} />
        <rect x="11" y="11" width="5" height="5" rx="1" {...common} />
      </>
    ),
    spine_left: (
      <>
        <path d="M6 4v12" {...common} />
        <path d="M9 6h7M9 10h7M9 14h7" {...common} />
      </>
    ),
    spine_center: (
      <>
        <path d="M10 4v12" {...common} />
        <path d="M4 6h4M12 6h4M4 10h4M12 10h4M4 14h4M12 14h4" {...common} />
      </>
    ),
    spine_top: (
      <>
        <path d="M4 6h12" {...common} />
        <path d="M6 9v6M10 9v6M14 9v6" {...common} />
      </>
    ),
    diagram: (
      <>
        <rect x="4" y="4" width="4" height="4" rx="1" {...common} />
        <rect x="12" y="4" width="4" height="4" rx="1" {...common} />
        <rect x="8" y="12" width="4" height="4" rx="1" {...common} />
        <path d="M8 6h4M10 8v4" {...common} />
      </>
    ),
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="flex-shrink-0 text-current">
      {content[kind]}
    </svg>
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

function CompactSelect<T extends string>({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: T
  onValueChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
        <SelectTrigger aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? label : undefined} className="h-8 bg-gray-50 px-2 text-xs dark:bg-slate-800">
          <SelectValue />
        </SelectTrigger>
        <SelectContent data-studio-slide-menu={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? "select" : undefined} aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? `${label} options` : undefined}>
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

function ToggleRow({
  label,
  description,
  badge,
  pressed,
  onClick,
  disabled = false,
}: {
  label: string
  description?: string
  badge?: string
  pressed: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-gray-600 dark:text-slate-300">{label}</span>
          {badge && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] leading-none text-primary">
              {badge}
            </span>
          )}
        </span>
        {description && <span className="block truncate text-[9px] text-gray-400 dark:text-slate-500">{description}</span>}
      </button>
      <Switch
        checked={pressed}
        disabled={disabled}
        onCheckedChange={() => onClick()}
        className="h-6 w-10 data-[state=checked]:bg-primary"
      />
    </div>
  )
}
