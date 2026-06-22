'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { AlertCircle, CheckCircle2, Layout, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GenerationInput } from '@/components/generation-panel/shared/generation-input'
import { CollapsibleSection } from '@/components/generation-panel/shared/collapsible-section'
import { MandatoryConfig, MandatoryFieldOptionGroup } from '@/components/generation-panel/types'
import {
  SlideLayoutType,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_CATEGORIES,
} from '@/types/elements'

type CanvasType = 'C1' | 'I1' | 'I2' | 'I3' | 'I4' | 'H1' | 'H2' | 'H3'
type NarrativeRole =
  | 'opening'
  | 'context_setting'
  | 'comparison'
  | 'deep_dive'
  | 'data_showcase'
  | 'process_overview'
  | 'call_to_action'
  | 'closing'
type ContentType =
  | 'text_heavy_columns'
  | 'text_heavy_rows'
  | 'text_heavy_grid'
  | 'chart'
  | 'table'
  | 'infographic'
  | 'diagram_idea_board'
  | 'diagram_code_display'
  | 'diagram_kanban_board'
  | 'diagram_gantt_chart'
  | 'diagram_multi_chevron_maturity_board'
  | 'diagram_logical_architecture'
  | 'diagram_cloud_architecture'
  | 'diagram_data_architecture'
  | 'hero'
type ChartSubtype = 'single' | 'two_vertical' | 'two_horizontal' | 'three_horizontal' | 'four_quadrant'
type InfographicSubtype = 'vertical_left' | 'vertical_center' | 'horizontal_top' | 'horizontal_center'
type TextSubtype = 'text_heavy_vertical' | 'text_heavy_horizontal' | 'text_heavy_grid' | 'table'
type DiagramSubtype =
  | 'idea_board'
  | 'code_display'
  | 'kanban_board'
  | 'gantt_chart'
  | 'multi_chevron_maturity_board'
  | 'logical_architecture'
  | 'cloud_architecture'
  | 'data_architecture'

type SlideSelections = {
  canvas_type: CanvasType
  content_type: ContentType
  narrative_role?: NarrativeRole
  chart_subtype?: ChartSubtype
  infographic_subtype?: InfographicSubtype
  text_subtype?: TextSubtype
  diagram_subtype?: DiagramSubtype
}

type SlideComposeStatus = 'built' | 'needs_input' | 'error'

export interface SlideComposeBuiltResult {
  status: 'built'
  presentation_id: string
  presentation_url?: string | null
  slide_index: number
  appended_index?: number | null
  insert_after_index?: number | null
  slides_built?: number
  slide_title?: string | null
}

interface SlideComposeNeedsInputResult {
  status: 'needs_input'
  questions?: string[]
  missing_fields?: string[]
  stage?: string
}

interface SlideComposeErrorResult {
  status?: 'error'
  error?: string
  errors?: string[]
  stage?: string
}

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

const CANVAS_TYPES = ['C1', 'I1', 'I2', 'I3', 'I4', 'H1', 'H2', 'H3'] as const
const CONTENT_TYPES = [
  'text_heavy_columns',
  'text_heavy_rows',
  'text_heavy_grid',
  'chart',
  'table',
  'infographic',
  'diagram_idea_board',
  'diagram_code_display',
  'diagram_kanban_board',
  'diagram_gantt_chart',
  'diagram_multi_chevron_maturity_board',
  'diagram_logical_architecture',
  'diagram_cloud_architecture',
  'diagram_data_architecture',
  'hero',
] as const
const NARRATIVE_ROLES = [
  'opening',
  'context_setting',
  'comparison',
  'deep_dive',
  'data_showcase',
  'process_overview',
  'call_to_action',
  'closing',
] as const
const CHART_SUBTYPES = ['single', 'two_vertical', 'two_horizontal', 'three_horizontal', 'four_quadrant'] as const
const INFOGRAPHIC_SUBTYPES = ['vertical_left', 'vertical_center', 'horizontal_top', 'horizontal_center'] as const
const TEXT_SUBTYPES = ['text_heavy_vertical', 'text_heavy_horizontal', 'text_heavy_grid', 'table'] as const
const DIAGRAM_SUBTYPES = [
  'idea_board',
  'code_display',
  'kanban_board',
  'gantt_chart',
  'multi_chevron_maturity_board',
  'logical_architecture',
  'cloud_architecture',
  'data_architecture',
] as const

const DIAGRAM_CONTENT_BY_SUBTYPE: Record<DiagramSubtype, ContentType> = {
  idea_board: 'diagram_idea_board',
  code_display: 'diagram_code_display',
  kanban_board: 'diagram_kanban_board',
  gantt_chart: 'diagram_gantt_chart',
  multi_chevron_maturity_board: 'diagram_multi_chevron_maturity_board',
  logical_architecture: 'diagram_logical_architecture',
  cloud_architecture: 'diagram_cloud_architecture',
  data_architecture: 'diagram_data_architecture',
}

const DIAGRAM_SUBTYPE_BY_CONTENT: Partial<Record<ContentType, DiagramSubtype>> = Object.fromEntries(
  Object.entries(DIAGRAM_CONTENT_BY_SUBTYPE).map(([subtype, contentType]) => [contentType, subtype]),
) as Partial<Record<ContentType, DiagramSubtype>>

const LABELS: Record<string, string> = {
  C1: 'Core',
  I1: 'Image left',
  I2: 'Image right',
  I3: 'Image left narrow',
  I4: 'Image right narrow',
  H1: 'Hero',
  H2: 'Section',
  H3: 'Closing',
  text_heavy_columns: 'Text columns',
  text_heavy_rows: 'Text rows',
  text_heavy_grid: 'Text grid',
  chart: 'Chart',
  table: 'Table',
  infographic: 'Infographic',
  diagram_idea_board: 'Diagram: idea board',
  diagram_code_display: 'Diagram: code display',
  diagram_kanban_board: 'Diagram: kanban board',
  diagram_gantt_chart: 'Diagram: gantt chart',
  diagram_multi_chevron_maturity_board: 'Diagram: maturity board',
  diagram_logical_architecture: 'Diagram: logical architecture',
  diagram_cloud_architecture: 'Diagram: cloud architecture',
  diagram_data_architecture: 'Diagram: data architecture',
  hero: 'Hero',
  opening: 'Opening',
  context_setting: 'Context setting',
  comparison: 'Comparison',
  deep_dive: 'Deep dive',
  data_showcase: 'Data showcase',
  process_overview: 'Process overview',
  call_to_action: 'Call to action',
  closing: 'Closing',
  single: 'Single',
  two_vertical: 'Two vertical',
  two_horizontal: 'Two horizontal',
  three_horizontal: 'Three horizontal',
  four_quadrant: 'Four quadrant',
  vertical_left: 'Vertical left',
  vertical_center: 'Vertical center',
  horizontal_top: 'Horizontal top',
  horizontal_center: 'Horizontal center',
  text_heavy_vertical: 'Vertical text',
  text_heavy_horizontal: 'Horizontal text',
  idea_board: 'Idea board',
  code_display: 'Code display',
  kanban_board: 'Kanban board',
  gantt_chart: 'Gantt chart',
  multi_chevron_maturity_board: 'Maturity board',
  logical_architecture: 'Logical architecture',
  cloud_architecture: 'Cloud architecture',
  data_architecture: 'Data architecture',
}

const LAYOUT_DEFAULTS: Record<SlideLayoutType, SlideSelections> = {
  'H1-generated': { canvas_type: 'H1', content_type: 'hero', narrative_role: 'opening' },
  'H1-structured': { canvas_type: 'H1', content_type: 'hero', narrative_role: 'opening' },
  'H2-section': { canvas_type: 'H2', content_type: 'hero', narrative_role: 'context_setting' },
  'H3-closing': { canvas_type: 'H3', content_type: 'hero', narrative_role: 'closing' },
  'C1-text': {
    canvas_type: 'C1',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'C3-chart': {
    canvas_type: 'C1',
    content_type: 'chart',
    narrative_role: 'data_showcase',
    chart_subtype: 'single',
  },
  'C4-infographic': {
    canvas_type: 'C1',
    content_type: 'infographic',
    narrative_role: 'process_overview',
    infographic_subtype: 'vertical_center',
  },
  'C5-diagram': {
    canvas_type: 'C1',
    content_type: 'diagram_idea_board',
    narrative_role: 'process_overview',
    diagram_subtype: 'idea_board',
  },
  'V1-image-text': {
    canvas_type: 'I1',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'V2-chart-text': {
    canvas_type: 'C1',
    content_type: 'chart',
    narrative_role: 'data_showcase',
    chart_subtype: 'single',
  },
  'V3-diagram-text': {
    canvas_type: 'C1',
    content_type: 'diagram_idea_board',
    narrative_role: 'process_overview',
    diagram_subtype: 'idea_board',
  },
  'V4-infographic-text': {
    canvas_type: 'C1',
    content_type: 'infographic',
    narrative_role: 'process_overview',
    infographic_subtype: 'vertical_center',
  },
  'I1-image-left': {
    canvas_type: 'I1',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'I2-image-right': {
    canvas_type: 'I2',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'I3-image-left-narrow': {
    canvas_type: 'I3',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'I4-image-right-narrow': {
    canvas_type: 'I4',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
  'S3-two-visuals': {
    canvas_type: 'C1',
    content_type: 'infographic',
    narrative_role: 'comparison',
    infographic_subtype: 'horizontal_center',
  },
  'S4-comparison': {
    canvas_type: 'C1',
    content_type: 'text_heavy_columns',
    narrative_role: 'comparison',
    text_subtype: 'text_heavy_horizontal',
  },
  'B1-blank': {
    canvas_type: 'C1',
    content_type: 'text_heavy_columns',
    narrative_role: 'deep_dive',
    text_subtype: 'text_heavy_vertical',
  },
}

const slideTypeGroups: MandatoryFieldOptionGroup[] = SLIDE_LAYOUT_CATEGORIES.map(cat => ({
  group: cat.label,
  options: SLIDE_LAYOUTS
    .filter(l => l.category === cat.category)
    .map(l => ({ value: l.layout, label: l.label })),
}))

function getLayoutLabel(layout: SlideLayoutType): string {
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.label ?? layout
}

function getLayoutDescription(layout: SlideLayoutType): string {
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.description ?? ''
}

function isAllowedValue<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value)
}

function selectOptions(values: readonly string[]) {
  return values.map(value => (
    <option key={value} value={value}>
      {LABELS[value] ?? value}
    </option>
  ))
}

function isBuiltResponse(value: unknown): value is SlideComposeBuiltResult {
  const result = value as Partial<SlideComposeBuiltResult>
  return result?.status === 'built' && typeof result.presentation_id === 'string' && typeof result.slide_index === 'number'
}

function isNeedsInputResponse(value: unknown): value is SlideComposeNeedsInputResult {
  return (value as SlideComposeNeedsInputResult)?.status === 'needs_input'
}

function responseErrorMessage(value: unknown): string {
  const result = value as SlideComposeErrorResult
  if (Array.isArray(result?.errors) && result.errors.length > 0) return result.errors.join('; ')
  if (typeof result?.error === 'string') return result.error
  if (typeof result?.stage === 'string') return `Slide Composer failed during ${result.stage}`
  return 'Slide Composer failed'
}

function applyLayoutDefaults(layout: SlideLayoutType): SlideSelections {
  return { ...LAYOUT_DEFAULTS[layout] }
}

export function SlideGenerationPanel({
  isOpen,
  onClose,
  currentSlide,
  currentLayout,
  sessionId,
  presentationId,
  research,
  enabled,
  onBuilt,
}: SlideGenerationPanelProps) {
  const initialSelections = useMemo(() => applyLayoutDefaults(currentLayout ?? 'C1-text'), [currentLayout])
  const [prompt, setPrompt] = useState('')
  const [selectedLayout, setSelectedLayout] = useState<SlideLayoutType>(currentLayout ?? 'C1-text')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [needsInput, setNeedsInput] = useState<SlideComposeNeedsInputResult | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [canvasType, setCanvasType] = useState<CanvasType>(initialSelections.canvas_type)
  const [contentType, setContentType] = useState<ContentType>(initialSelections.content_type)
  const [narrativeRole, setNarrativeRole] = useState<NarrativeRole>(initialSelections.narrative_role ?? 'deep_dive')
  const [chartSubtype, setChartSubtype] = useState<ChartSubtype>(initialSelections.chart_subtype ?? 'single')
  const [infographicSubtype, setInfographicSubtype] = useState<InfographicSubtype>(
    initialSelections.infographic_subtype ?? 'vertical_center',
  )
  const [textSubtype, setTextSubtype] = useState<TextSubtype>(initialSelections.text_subtype ?? 'text_heavy_vertical')
  const [diagramSubtype, setDiagramSubtype] = useState<DiagramSubtype>(
    initialSelections.diagram_subtype ?? DIAGRAM_SUBTYPE_BY_CONTENT[initialSelections.content_type] ?? 'idea_board',
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    layout: true,
    content: true,
    research: false,
  })

  const applySelections = useCallback((selections: SlideSelections) => {
    setCanvasType(selections.canvas_type)
    setContentType(selections.content_type)
    setNarrativeRole(selections.narrative_role ?? 'deep_dive')
    setChartSubtype(selections.chart_subtype ?? 'single')
    setInfographicSubtype(selections.infographic_subtype ?? 'vertical_center')
    setTextSubtype(selections.text_subtype ?? 'text_heavy_vertical')
    setDiagramSubtype(selections.diagram_subtype ?? DIAGRAM_SUBTYPE_BY_CONTENT[selections.content_type] ?? 'idea_board')
  }, [])

  useEffect(() => {
    if (!currentLayout) return
    setSelectedLayout(currentLayout)
    applySelections(applyLayoutDefaults(currentLayout))
  }, [applySelections, currentLayout])

  const handleLayoutChange = useCallback((value: string) => {
    const layout = value as SlideLayoutType
    setSelectedLayout(layout)
    applySelections(applyLayoutDefaults(layout))
  }, [applySelections])

  const mandatoryConfig: MandatoryConfig = {
    fieldLabel: 'Slide Layout',
    displayLabel: getLayoutLabel(selectedLayout),
    optionGroups: slideTypeGroups,
    onChange: handleLayoutChange,
    promptPlaceholder: 'Describe the one slide you want to build...',
  }

  const buildSelections = useCallback((): SlideSelections | null => {
    if (!isAllowedValue(canvasType, CANVAS_TYPES)) return null
    if (!isAllowedValue(contentType, CONTENT_TYPES)) return null
    if (!isAllowedValue(narrativeRole, NARRATIVE_ROLES)) return null

    const selections: SlideSelections = {
      canvas_type: canvasType,
      content_type: contentType,
      narrative_role: narrativeRole,
    }

    if (contentType === 'chart') {
      if (!isAllowedValue(chartSubtype, CHART_SUBTYPES)) return null
      selections.chart_subtype = chartSubtype
    } else if (contentType === 'infographic') {
      if (!isAllowedValue(infographicSubtype, INFOGRAPHIC_SUBTYPES)) return null
      selections.infographic_subtype = infographicSubtype
    } else if (contentType.startsWith('diagram_')) {
      if (!isAllowedValue(diagramSubtype, DIAGRAM_SUBTYPES)) return null
      selections.diagram_subtype = diagramSubtype
      selections.content_type = DIAGRAM_CONTENT_BY_SUBTYPE[diagramSubtype]
    } else if (contentType.startsWith('text_heavy') || contentType === 'table') {
      if (!isAllowedValue(textSubtype, TEXT_SUBTYPES)) return null
      selections.text_subtype = textSubtype
    }

    return selections
  }, [canvasType, chartSubtype, contentType, diagramSubtype, infographicSubtype, narrativeRole, textSubtype])

  const questions = needsInput?.questions?.length ? needsInput.questions : needsInput?.missing_fields ?? []

  const buildInstruction = useCallback(() => {
    const base = prompt.trim()
    const answered = questions
      .map((question, index) => {
        const answer = answers[index]?.trim()
        return answer ? `Q: ${question}\nA: ${answer}` : null
      })
      .filter(Boolean)
      .join('\n\n')

    if (!answered) return base
    return [base, 'Additional source material:', answered].filter(Boolean).join('\n\n')
  }, [answers, prompt, questions])

  const handleGenerate = useCallback(async () => {
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

    const selections = buildSelections()
    if (!selections) {
      setError('One or more slide selections is not supported by the contract.')
      return
    }

    const instruction = buildInstruction()
    if (!instruction && !selectedLayout) {
      setError('Add a short instruction or choose a slide layout.')
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
          selections,
          research: {
            use_uploaded_documents: research.useUploadedDocuments,
            use_web_search: research.useWebSearch,
            use_deep_research: research.useDeepResearch,
            use_knowledge_graph: research.useKnowledgeGraph,
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
        setShowAdvanced(false)
        return
      }

      if (isBuiltResponse(data)) {
        setNeedsInput(null)
        setAnswers({})
        setPrompt('')
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
  }, [buildInstruction, buildSelections, currentSlide, enabled, onBuilt, presentationId, research, selectedLayout, sessionId])

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleContentTypeChange = useCallback((value: string) => {
    if (!isAllowedValue(value, CONTENT_TYPES)) return
    setContentType(value)
    const nextDiagramSubtype = DIAGRAM_SUBTYPE_BY_CONTENT[value]
    if (nextDiagramSubtype) setDiagramSubtype(nextDiagramSubtype)
    if (value === 'chart') setNarrativeRole('data_showcase')
    if (value === 'infographic' || value.startsWith('diagram_')) setNarrativeRole('process_overview')
    if (value === 'table') setTextSubtype('table')
    if (value === 'text_heavy_columns') setTextSubtype('text_heavy_vertical')
    if (value === 'text_heavy_rows') setTextSubtype('text_heavy_horizontal')
    if (value === 'text_heavy_grid') setTextSubtype('text_heavy_grid')
  }, [])

  const handleDiagramSubtypeChange = useCallback((value: string) => {
    if (!isAllowedValue(value, DIAGRAM_SUBTYPES)) return
    setDiagramSubtype(value)
    setContentType(DIAGRAM_CONTENT_BY_SUBTYPE[value])
  }, [])

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
          'flex-1 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ease-out',
          isOpen ? 'pointer-events-auto opacity-100' : 'opacity-0 max-w-0',
        )}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Layout className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Slide Composer</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                Build one slide into the current deck
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 transition-colors"
            title="Close panel"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">
            {presentationId ? (
              <>
                Insert after <span className="font-semibold">Slide {currentSlide}</span>
              </>
            ) : (
              'Create a new one-slide deck'
            )}
          </p>
        </div>

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
                {questions.map((question, index) => (
                  <label key={`${question}-${index}`} className="block space-y-1">
                    <span className="text-[11px] text-amber-800">{question}</span>
                    <textarea
                      value={answers[index] ?? ''}
                      onChange={(event) => setAnswers(prev => ({ ...prev, [index]: event.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-amber-400"
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

        <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 ${!showAdvanced ? 'hidden' : ''}`}>
          <CollapsibleSection
            title="Layout"
            isOpen={openSections.layout}
            onToggle={() => toggleSection('layout')}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-200">{getLayoutLabel(selectedLayout)}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">{selectedLayout}</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">{getLayoutDescription(selectedLayout)}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Canvas
                  </span>
                  <select
                    value={canvasType}
                    onChange={(event) => setCanvasType(event.target.value as CanvasType)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(CANVAS_TYPES)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Role
                  </span>
                  <select
                    value={narrativeRole}
                    onChange={(event) => setNarrativeRole(event.target.value as NarrativeRole)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(NARRATIVE_ROLES)}
                  </select>
                </label>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Content"
            isOpen={openSections.content}
            onToggle={() => toggleSection('content')}
          >
            <div className="space-y-2">
              <label className="space-y-1 block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Content type
                </span>
                <select
                  value={contentType}
                  onChange={(event) => handleContentTypeChange(event.target.value)}
                  className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {selectOptions(CONTENT_TYPES)}
                </select>
              </label>

              {contentType === 'chart' && (
                <label className="space-y-1 block">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Chart subtype
                  </span>
                  <select
                    value={chartSubtype}
                    onChange={(event) => setChartSubtype(event.target.value as ChartSubtype)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(CHART_SUBTYPES)}
                  </select>
                </label>
              )}

              {contentType === 'infographic' && (
                <label className="space-y-1 block">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Infographic subtype
                  </span>
                  <select
                    value={infographicSubtype}
                    onChange={(event) => setInfographicSubtype(event.target.value as InfographicSubtype)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(INFOGRAPHIC_SUBTYPES)}
                  </select>
                </label>
              )}

              {contentType.startsWith('diagram_') && (
                <label className="space-y-1 block">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Diagram subtype
                  </span>
                  <select
                    value={diagramSubtype}
                    onChange={(event) => handleDiagramSubtypeChange(event.target.value)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(DIAGRAM_SUBTYPES)}
                  </select>
                </label>
              )}

              {(contentType.startsWith('text_heavy') || contentType === 'table') && (
                <label className="space-y-1 block">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Text subtype
                  </span>
                  <select
                    value={textSubtype}
                    onChange={(event) => setTextSubtype(event.target.value as TextSubtype)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectOptions(TEXT_SUBTYPES)}
                  </select>
                </label>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Research"
            isOpen={openSections.research}
            onToggle={() => toggleSection('research')}
          >
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-slate-300">
              <span className={cn('rounded-md border px-2 py-1', research.useUploadedDocuments ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50')}>
                Uploaded docs
              </span>
              <span className={cn('rounded-md border px-2 py-1', research.useWebSearch ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50')}>
                Web search
              </span>
              <span className={cn('rounded-md border px-2 py-1', research.useDeepResearch ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50')}>
                Deep research
              </span>
              <span className={cn('rounded-md border px-2 py-1', research.useKnowledgeGraph ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50')}>
                Knowledge graph
              </span>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
