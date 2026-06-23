import { MandatoryFieldOptionGroup } from '@/components/generation-panel/types'
import {
  SlideLayoutType,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_CATEGORIES,
} from '@/types/elements'

export const AUTO_VALUE = 'auto'
export type AutoValue = typeof AUTO_VALUE
export type LayoutChoice = SlideLayoutType | AutoValue
export type OptionalChoice<T extends string> = T | AutoValue

export type CanvasType = 'C1' | 'I1' | 'I2' | 'I3' | 'I4' | 'H1' | 'H2' | 'H3'
export type NarrativeRole =
  | 'opening'
  | 'context_setting'
  | 'comparison'
  | 'deep_dive'
  | 'data_showcase'
  | 'process_overview'
  | 'call_to_action'
  | 'closing'
export type ContentType =
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
export type ChartSubtype = 'single' | 'two_vertical' | 'two_horizontal' | 'three_horizontal' | 'four_quadrant'
export type InfographicSubtype = 'vertical_left' | 'vertical_center' | 'horizontal_top' | 'horizontal_center'
export type TextSubtype = 'text_heavy_vertical' | 'text_heavy_horizontal' | 'text_heavy_grid' | 'table'
export type DiagramSubtype =
  | 'idea_board'
  | 'code_display'
  | 'kanban_board'
  | 'gantt_chart'
  | 'multi_chevron_maturity_board'
  | 'logical_architecture'
  | 'cloud_architecture'
  | 'data_architecture'
export type ShapeSubtype = ChartSubtype | InfographicSubtype | TextSubtype | DiagramSubtype

export type SlideSelections = {
  canvas_type?: CanvasType
  content_type?: ContentType
  narrative_role?: NarrativeRole
  chart_subtype?: ChartSubtype
  infographic_subtype?: InfographicSubtype
  text_subtype?: TextSubtype
  diagram_subtype?: DiagramSubtype
}

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

export interface SlideComposeNeedsInputQuestion {
  slot: string
  ask: string
}

export interface SlideComposeNeedsInputResult {
  status: 'needs_input'
  questions?: SlideComposeNeedsInputQuestion[]
  missing_fields?: string[]
  stage?: string
}

export const CANVAS_OPTIONS: Array<{ value: CanvasType; label: string }> = [
  { value: 'C1', label: 'Core' },
  { value: 'I1', label: 'Image left' },
  { value: 'I2', label: 'Image right' },
  { value: 'I3', label: 'Image left narrow' },
  { value: 'I4', label: 'Image right narrow' },
  { value: 'H1', label: 'Hero' },
  { value: 'H2', label: 'Section' },
  { value: 'H3', label: 'Closing' },
]

export const CONTENT_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: 'text_heavy_columns', label: 'Text columns' },
  { value: 'text_heavy_rows', label: 'Text rows' },
  { value: 'text_heavy_grid', label: 'Text grid' },
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
  { value: 'infographic', label: 'Infographic' },
  { value: 'diagram_idea_board', label: 'Diagram: idea board' },
  { value: 'diagram_code_display', label: 'Diagram: code display' },
  { value: 'diagram_kanban_board', label: 'Diagram: kanban board' },
  { value: 'diagram_gantt_chart', label: 'Diagram: gantt chart' },
  { value: 'diagram_multi_chevron_maturity_board', label: 'Diagram: maturity board' },
  { value: 'diagram_logical_architecture', label: 'Diagram: logical architecture' },
  { value: 'diagram_cloud_architecture', label: 'Diagram: cloud architecture' },
  { value: 'diagram_data_architecture', label: 'Diagram: data architecture' },
  { value: 'hero', label: 'Hero' },
]

export const NARRATIVE_OPTIONS: Array<{ value: NarrativeRole; label: string }> = [
  { value: 'opening', label: 'Opening' },
  { value: 'context_setting', label: 'Context setting' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'deep_dive', label: 'Deep dive' },
  { value: 'data_showcase', label: 'Data showcase' },
  { value: 'process_overview', label: 'Process overview' },
  { value: 'call_to_action', label: 'Call to action' },
  { value: 'closing', label: 'Closing' },
]

export const SHAPE_OPTIONS: Record<string, Array<{ value: ShapeSubtype; label: string }>> = {
  chart: [
    { value: 'single', label: 'Single chart' },
    { value: 'two_vertical', label: 'Two vertical' },
    { value: 'two_horizontal', label: 'Two horizontal' },
    { value: 'three_horizontal', label: 'Three horizontal' },
    { value: 'four_quadrant', label: 'Four quadrant' },
  ],
  infographic: [
    { value: 'vertical_left', label: 'Vertical left' },
    { value: 'vertical_center', label: 'Vertical center' },
    { value: 'horizontal_top', label: 'Horizontal top' },
    { value: 'horizontal_center', label: 'Horizontal center' },
  ],
  text: [
    { value: 'text_heavy_vertical', label: 'Vertical text' },
    { value: 'text_heavy_horizontal', label: 'Horizontal text' },
    { value: 'text_heavy_grid', label: 'Grid text' },
    { value: 'table', label: 'Table' },
  ],
  diagram: [
    { value: 'idea_board', label: 'Idea board' },
    { value: 'code_display', label: 'Code display' },
    { value: 'kanban_board', label: 'Kanban board' },
    { value: 'gantt_chart', label: 'Gantt chart' },
    { value: 'multi_chevron_maturity_board', label: 'Maturity board' },
    { value: 'logical_architecture', label: 'Logical architecture' },
    { value: 'cloud_architecture', label: 'Cloud architecture' },
    { value: 'data_architecture', label: 'Data architecture' },
  ],
}

const DIAGRAM_CONTENT_BY_SUBTYPE: Partial<Record<ShapeSubtype, ContentType>> = {
  idea_board: 'diagram_idea_board',
  code_display: 'diagram_code_display',
  kanban_board: 'diagram_kanban_board',
  gantt_chart: 'diagram_gantt_chart',
  multi_chevron_maturity_board: 'diagram_multi_chevron_maturity_board',
  logical_architecture: 'diagram_logical_architecture',
  cloud_architecture: 'diagram_cloud_architecture',
  data_architecture: 'diagram_data_architecture',
}

const DIAGRAM_SUBTYPE_BY_CONTENT = Object.fromEntries(
  Object.entries(DIAGRAM_CONTENT_BY_SUBTYPE).map(([subtype, contentType]) => [contentType, subtype]),
) as Partial<Record<ContentType, DiagramSubtype>>

const LAYOUT_DEFAULTS: Record<SlideLayoutType, SlideSelections> = {
  'H1-generated': { canvas_type: 'H1', content_type: 'hero', narrative_role: 'opening' },
  'H1-structured': { canvas_type: 'H1', content_type: 'hero', narrative_role: 'opening' },
  'H2-section': { canvas_type: 'H2', content_type: 'hero', narrative_role: 'context_setting' },
  'H3-closing': { canvas_type: 'H3', content_type: 'hero', narrative_role: 'closing' },
  'C1-text': { canvas_type: 'C1', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'C3-chart': { canvas_type: 'C1', content_type: 'chart', narrative_role: 'data_showcase', chart_subtype: 'single' },
  'C4-infographic': { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' },
  'C5-diagram': { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' },
  'V1-image-text': { canvas_type: 'I1', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'V2-chart-text': { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' },
  'V3-diagram-text': { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' },
  'V4-infographic-text': { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' },
  'I1-image-left': { canvas_type: 'I1', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'I2-image-right': { canvas_type: 'I2', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'I3-image-left-narrow': { canvas_type: 'I3', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'I4-image-right-narrow': { canvas_type: 'I4', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
  'S3-two-visuals': { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'horizontal_center' },
  'S4-comparison': { canvas_type: 'C1', content_type: 'text_heavy_columns', narrative_role: 'comparison', text_subtype: 'text_heavy_horizontal' },
  'B1-blank': { canvas_type: 'C1', content_type: 'text_heavy_columns', text_subtype: 'text_heavy_vertical' },
}

export const slideTypeGroups: MandatoryFieldOptionGroup[] = [
  {
    group: 'Compose',
    options: [{ value: AUTO_VALUE, label: 'Auto / let AI decide' }],
  },
  ...SLIDE_LAYOUT_CATEGORIES.map(cat => ({
    group: cat.label,
    options: SLIDE_LAYOUTS
      .filter(l => l.category === cat.category)
      .map(l => ({ value: l.layout, label: l.label })),
  })),
]

export function getLayoutLabel(layout: LayoutChoice): string {
  if (layout === AUTO_VALUE) return 'Auto / let AI decide'
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.label ?? layout
}

export function getLayoutDescription(layout: LayoutChoice): string {
  if (layout === AUTO_VALUE) return 'Let AI infer the best layout from the prompt.'
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.description ?? ''
}

export function getShapeBucket(contentType: OptionalChoice<ContentType>): keyof typeof SHAPE_OPTIONS | null {
  if (contentType === AUTO_VALUE) return null
  if (contentType === 'chart') return 'chart'
  if (contentType === 'infographic') return 'infographic'
  if (contentType === 'table' || contentType.startsWith('text_heavy')) return 'text'
  if (contentType.startsWith('diagram_')) return 'diagram'
  return null
}

export function layoutDefaults(layout: LayoutChoice): SlideSelections {
  if (layout === AUTO_VALUE) return {}
  return { ...LAYOUT_DEFAULTS[layout] }
}

export function subtypeFromSelections(selections: SlideSelections): OptionalChoice<ShapeSubtype> {
  return (
    selections.chart_subtype ??
    selections.infographic_subtype ??
    selections.diagram_subtype ??
    selections.text_subtype ??
    AUTO_VALUE
  )
}

export function buildSelections(input: {
  layout: LayoutChoice
  canvasType: OptionalChoice<CanvasType>
  contentType: OptionalChoice<ContentType>
  shapeSubtype: OptionalChoice<ShapeSubtype>
  narrativeRole: OptionalChoice<NarrativeRole>
}): SlideSelections {
  const selections: SlideSelections = { ...layoutDefaults(input.layout) }
  if (input.canvasType !== AUTO_VALUE) selections.canvas_type = input.canvasType
  if (input.contentType !== AUTO_VALUE) selections.content_type = input.contentType
  if (input.narrativeRole !== AUTO_VALUE) selections.narrative_role = input.narrativeRole

  const contentType = selections.content_type
  if (input.shapeSubtype !== AUTO_VALUE) {
    if (contentType === 'chart') selections.chart_subtype = input.shapeSubtype as ChartSubtype
    else if (contentType === 'infographic') selections.infographic_subtype = input.shapeSubtype as InfographicSubtype
    else if (contentType?.startsWith('diagram_')) {
      selections.diagram_subtype = input.shapeSubtype as DiagramSubtype
      selections.content_type = DIAGRAM_CONTENT_BY_SUBTYPE[input.shapeSubtype] ?? contentType
    } else if (contentType === 'table' || contentType?.startsWith('text_heavy')) {
      selections.text_subtype = input.shapeSubtype as TextSubtype
    }
  } else if (contentType?.startsWith('diagram_')) {
    selections.diagram_subtype = DIAGRAM_SUBTYPE_BY_CONTENT[contentType]
  }

  Object.keys(selections).forEach((key) => {
    if (selections[key as keyof SlideSelections] == null) delete selections[key as keyof SlideSelections]
  })
  return selections
}

export function normalizeQuestions(result: SlideComposeNeedsInputResult | null): SlideComposeNeedsInputQuestion[] {
  if (!result) return []
  if (result.questions?.length) return result.questions.filter(q => q.slot && q.ask)
  return (result.missing_fields ?? []).map(slot => ({
    slot,
    ask: `Please provide ${slot.replace(/_/g, ' ')}.`,
  }))
}

export function buildInstruction(prompt: string, keyMessage: string, questions: SlideComposeNeedsInputQuestion[], answers: Record<string, string>): string {
  const answered = questions
    .map((question) => {
      const answer = answers[question.slot]?.trim()
      return answer ? `Q: ${question.ask}\nA: ${answer}` : null
    })
    .filter(Boolean)
    .join('\n\n')
  return [prompt.trim(), keyMessage.trim() ? `Key message: ${keyMessage.trim()}` : '', answered && `Additional source material:\n${answered}`]
    .filter(Boolean)
    .join('\n\n')
}

export function isBuiltResponse(value: unknown): value is SlideComposeBuiltResult {
  const result = value as Partial<SlideComposeBuiltResult>
  return result?.status === 'built' && typeof result.presentation_id === 'string' && typeof result.slide_index === 'number'
}

export function isNeedsInputResponse(value: unknown): value is SlideComposeNeedsInputResult {
  return (value as SlideComposeNeedsInputResult)?.status === 'needs_input'
}

export function responseErrorMessage(value: unknown): string {
  const result = value as { error?: string; errors?: string[]; stage?: string }
  if (Array.isArray(result?.errors) && result.errors.length > 0) return result.errors.join('; ')
  if (typeof result?.error === 'string') return result.error
  if (typeof result?.stage === 'string') return `Slide Composer failed during ${result.stage}`
  return 'Slide Composer failed'
}
