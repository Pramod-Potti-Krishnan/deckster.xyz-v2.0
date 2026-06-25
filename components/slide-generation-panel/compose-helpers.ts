import { MandatoryFieldOptionGroup } from '@/components/generation-panel/types'

export const AUTO_VALUE = 'auto'
export type AutoValue = typeof AUTO_VALUE
export type SlidePreset =
  | 'hero_title'
  | 'hero_section'
  | 'hero_closing'
  | 'content_text'
  | 'content_chart'
  | 'content_infographic'
  | 'content_diagram'
export type LayoutChoice = SlidePreset | AutoValue
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
export type TextLayoutStyle = 'text_heavy_columns' | 'text_heavy_rows' | 'text_heavy_grid' | 'table'
export type DiagramSubtype =
  | 'idea_board'
  | 'code_display'
  | 'kanban_board'
  | 'gantt_chart'
  | 'multi_chevron_maturity_board'
  | 'logical_architecture'
  | 'cloud_architecture'
  | 'data_architecture'
export type ShapeSubtype = ChartSubtype | InfographicSubtype | TextLayoutStyle | DiagramSubtype
export type HeroStyle =
  | 'editorial'
  | 'highlight_word'
  | 'accent_bar'
  | 'number_left'
  | 'panel_left'
  | 'number_watermark'
  | 'thankyou'
  | 'split_contact'
  | 'quote'
export type HeroVariant = 'solid_dark' | 'solid_light' | 'photo_dark' | 'photo_light'

export type SlideSelections = {
  canvas_type?: CanvasType
  content_type?: ContentType
  narrative_role?: NarrativeRole
  chart_subtype?: ChartSubtype
  infographic_subtype?: InfographicSubtype
  text_subtype?: TextSubtype
  diagram_subtype?: DiagramSubtype
  hero_style?: HeroStyle
  eyebrow?: string
  contact_email?: string
  contact_phone?: string
  contact_website?: string
  contact_linkedin?: string
  attribution?: string
  hero_variant?: HeroVariant
  allow_hero_image?: boolean
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
  { value: 'C1', label: 'Core (full canvas)' },
  { value: 'I1', label: 'Image left' },
  { value: 'I2', label: 'Image right' },
  { value: 'I3', label: 'Image left (narrow)' },
  { value: 'I4', label: 'Image right (narrow)' },
  { value: 'H1', label: 'Title slide' },
  { value: 'H2', label: 'Section divider' },
  { value: 'H3', label: 'Closing' },
]

export const IMAGE_PLACEMENT_OPTIONS: Array<{ value: CanvasType; label: string }> = [
  { value: 'I1', label: 'Image left' },
  { value: 'I2', label: 'Image right' },
  { value: 'I3', label: 'Image left (narrow)' },
  { value: 'I4', label: 'Image right (narrow)' },
]

export const IMAGE_OPTION_VALUES: Array<{ value: OptionalChoice<CanvasType>; label: string }> = [
  { value: 'C1', label: 'None' },
  { value: AUTO_VALUE, label: 'Auto' },
  { value: 'I1', label: 'Image left' },
  { value: 'I2', label: 'Image right' },
  { value: 'I3', label: 'Left narrow' },
  { value: 'I4', label: 'Right narrow' },
]

export const CONTENT_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: 'text_heavy_columns', label: 'Text-heavy' },
  { value: 'chart', label: 'Chart' },
  { value: 'infographic', label: 'Infographic' },
  { value: 'diagram_idea_board', label: 'Diagram' },
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
    { value: 'text_heavy_columns', label: 'Columns' },
    { value: 'text_heavy_rows', label: 'Rows' },
    { value: 'text_heavy_grid', label: 'Grid' },
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

const TEXT_CONTENT_TYPES = new Set<ContentType>([
  'text_heavy_columns',
  'text_heavy_rows',
  'text_heavy_grid',
  'table',
])

const TEXT_CONTENT_BY_STYLE: Record<TextLayoutStyle, ContentType> = {
  text_heavy_columns: 'text_heavy_columns',
  text_heavy_rows: 'text_heavy_rows',
  text_heavy_grid: 'text_heavy_grid',
  table: 'table',
}

const TEXT_SUBTYPE_BY_CONTENT: Record<TextLayoutStyle, TextSubtype> = {
  text_heavy_columns: 'text_heavy_vertical',
  text_heavy_rows: 'text_heavy_horizontal',
  text_heavy_grid: 'text_heavy_grid',
  table: 'table',
}

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

const DIAGRAM_SUBTYPE_BY_CONTENT = Object.fromEntries(
  Object.entries(DIAGRAM_CONTENT_BY_SUBTYPE).map(([subtype, contentType]) => [contentType, subtype]),
) as Partial<Record<ContentType, DiagramSubtype>>

const LAYOUT_DEFAULTS: Record<SlidePreset, SlideSelections> = {
  hero_title: { canvas_type: 'H1', content_type: 'hero', narrative_role: 'opening' },
  hero_section: { canvas_type: 'H2', content_type: 'hero', narrative_role: 'context_setting' },
  hero_closing: { canvas_type: 'H3', content_type: 'hero', narrative_role: 'closing' },
  content_text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },
  content_chart: { canvas_type: 'C1', content_type: 'chart', narrative_role: 'data_showcase', chart_subtype: 'single' },
  content_infographic: { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' },
  content_diagram: { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' },
}

const LAYOUT_LABELS: Record<SlidePreset, string> = {
  hero_title: 'Title slide',
  hero_section: 'Section divider',
  hero_closing: 'Closing',
  content_text: 'Text-heavy',
  content_chart: 'Chart',
  content_infographic: 'Infographic',
  content_diagram: 'Diagram',
}

const LAYOUT_DESCRIPTIONS: Record<SlidePreset, string> = {
  hero_title: 'Title slide content',
  hero_section: 'Section divider content',
  hero_closing: 'Closing slide content',
  content_text: 'Text-heavy content',
  content_chart: 'Chart content',
  content_infographic: 'Infographic content',
  content_diagram: 'Diagram content',
}

export const slideTypeGroups: MandatoryFieldOptionGroup[] = [
  {
    group: 'Compose',
    options: [{ value: AUTO_VALUE, label: 'Auto / let AI decide' }],
  },
  {
    group: 'Hero',
    options: [
      { value: 'hero_title', label: 'Title slide' },
      { value: 'hero_section', label: 'Section divider' },
      { value: 'hero_closing', label: 'Closing' },
    ],
  },
  {
    group: 'Content',
    options: [
      { value: 'content_text', label: 'Text-heavy' },
      { value: 'content_chart', label: 'Chart' },
      { value: 'content_infographic', label: 'Infographic' },
      { value: 'content_diagram', label: 'Diagram' },
    ],
  },
]

export function getLayoutLabel(layout: LayoutChoice): string {
  if (layout === AUTO_VALUE) return 'Auto / let AI decide'
  return LAYOUT_LABELS[layout]
}

export function getLayoutDescription(layout: LayoutChoice): string {
  if (layout === AUTO_VALUE) return 'Let AI infer the best layout from the prompt.'
  return LAYOUT_DESCRIPTIONS[layout]
}

export function isHeroLayout(layout: LayoutChoice): boolean {
  return layout !== AUTO_VALUE && layout.startsWith('hero_')
}

export function getShapeBucket(contentType: OptionalChoice<ContentType>): keyof typeof SHAPE_OPTIONS | null {
  if (contentType === AUTO_VALUE || contentType === 'hero') return null
  if (contentType === 'chart') return 'chart'
  if (contentType === 'infographic') return 'infographic'
  if (TEXT_CONTENT_TYPES.has(contentType)) return 'text'
  if (contentType.startsWith('diagram_')) return 'diagram'
  return null
}

export function defaultShapeForContent(contentType: OptionalChoice<ContentType>): OptionalChoice<ShapeSubtype> {
  if (contentType === AUTO_VALUE || contentType === 'hero') return AUTO_VALUE
  if (contentType === 'chart') return 'single'
  if (contentType === 'infographic') return 'vertical_center'
  if (contentType.startsWith('diagram_')) return DIAGRAM_SUBTYPE_BY_CONTENT[contentType] ?? 'idea_board'
  if (TEXT_CONTENT_TYPES.has(contentType)) return contentType as TextLayoutStyle
  return AUTO_VALUE
}

export function canUseImagePlacement(
  contentType: OptionalChoice<ContentType>,
  shapeSubtype: OptionalChoice<ShapeSubtype>,
): boolean {
  if (contentType === AUTO_VALUE || contentType === 'hero') return false
  if (TEXT_CONTENT_TYPES.has(contentType)) {
    const textStyle = shapeSubtype === AUTO_VALUE ? contentType : shapeSubtype
    return textStyle !== 'table'
  }
  if (contentType === 'chart') {
    return (
      shapeSubtype === AUTO_VALUE ||
      shapeSubtype === 'single' ||
      shapeSubtype === 'two_vertical' ||
      shapeSubtype === 'two_horizontal'
    )
  }
  return false
}

export function imageOptionsFor(
  contentType: OptionalChoice<ContentType>,
  shapeSubtype: OptionalChoice<ShapeSubtype>,
): Array<{ value: OptionalChoice<CanvasType>; label: string }> {
  if (!canUseImagePlacement(contentType, shapeSubtype)) return []
  if (contentType === 'chart' && shapeSubtype === 'two_horizontal') {
    return IMAGE_OPTION_VALUES.filter(option => option.value === 'C1' || option.value === 'I3' || option.value === 'I4')
  }
  return IMAGE_OPTION_VALUES
}

export function layoutDefaults(layout: LayoutChoice): SlideSelections {
  if (layout === AUTO_VALUE) return {}
  return { ...LAYOUT_DEFAULTS[layout] }
}

export function subtypeFromSelections(selections: SlideSelections): OptionalChoice<ShapeSubtype> {
  if (selections.chart_subtype) return selections.chart_subtype
  if (selections.infographic_subtype) return selections.infographic_subtype
  if (selections.diagram_subtype) return selections.diagram_subtype
  if (selections.content_type && TEXT_CONTENT_TYPES.has(selections.content_type)) return selections.content_type as TextLayoutStyle
  return AUTO_VALUE
}

function isTextLayoutStyle(value: string): value is TextLayoutStyle {
  return value in TEXT_CONTENT_BY_STYLE
}

function isDiagramSubtype(value: string): value is DiagramSubtype {
  return value in DIAGRAM_CONTENT_BY_SUBTYPE
}

function coerceCanvasForContent(selections: SlideSelections): void {
  const contentType = selections.content_type
  if (!contentType || contentType === 'hero') return

  if (selections.canvas_type?.startsWith('H')) {
    selections.canvas_type = 'C1'
  }
  if (selections.canvas_type?.startsWith('I')) {
    const shape = selections.chart_subtype ?? selections.text_subtype ?? AUTO_VALUE
    const imageOptions = imageOptionsFor(contentType, shape as OptionalChoice<ShapeSubtype>)
    if (!imageOptions.some(option => option.value === selections.canvas_type)) {
      selections.canvas_type = 'C1'
    }
  }
}

export function buildSelections(input: {
  layout: LayoutChoice
  canvasType: OptionalChoice<CanvasType>
  contentType: OptionalChoice<ContentType>
  shapeSubtype: OptionalChoice<ShapeSubtype>
  narrativeRole: OptionalChoice<NarrativeRole>
  heroStyle?: OptionalChoice<HeroStyle>
  eyebrow?: string
  contactEmail?: string
  contactPhone?: string
  contactWebsite?: string
  contactLinkedin?: string
  attribution?: string
  heroVariant?: HeroVariant
  allowHeroImage?: boolean
}): SlideSelections {
  const selections: SlideSelections = { ...layoutDefaults(input.layout) }
  if (input.canvasType !== AUTO_VALUE) selections.canvas_type = input.canvasType
  if (input.contentType !== AUTO_VALUE) selections.content_type = input.contentType
  if (input.narrativeRole !== AUTO_VALUE) selections.narrative_role = input.narrativeRole

  const contentType = selections.content_type
  if (input.shapeSubtype !== AUTO_VALUE) {
    if (isTextLayoutStyle(input.shapeSubtype)) {
      selections.content_type = TEXT_CONTENT_BY_STYLE[input.shapeSubtype]
      selections.text_subtype = TEXT_SUBTYPE_BY_CONTENT[input.shapeSubtype]
    } else if (contentType === 'chart') {
      selections.chart_subtype = input.shapeSubtype as ChartSubtype
    } else if (contentType === 'infographic') {
      selections.infographic_subtype = input.shapeSubtype as InfographicSubtype
    } else if (isDiagramSubtype(input.shapeSubtype)) {
      selections.diagram_subtype = input.shapeSubtype
      selections.content_type = DIAGRAM_CONTENT_BY_SUBTYPE[input.shapeSubtype]
    }
  } else if (contentType?.startsWith('diagram_')) {
    selections.diagram_subtype = DIAGRAM_SUBTYPE_BY_CONTENT[contentType]
  }

  if (selections.content_type === 'hero') {
    if (input.heroStyle && input.heroStyle !== AUTO_VALUE) selections.hero_style = input.heroStyle
    if (input.eyebrow?.trim()) selections.eyebrow = input.eyebrow.trim()
    if (input.contactEmail?.trim()) selections.contact_email = input.contactEmail.trim()
    if (input.contactPhone?.trim()) selections.contact_phone = input.contactPhone.trim()
    if (input.contactWebsite?.trim()) selections.contact_website = input.contactWebsite.trim()
    if (input.contactLinkedin?.trim()) selections.contact_linkedin = input.contactLinkedin.trim()
    if (input.attribution?.trim()) selections.attribution = input.attribution.trim()
    if (input.heroVariant) selections.hero_variant = input.heroVariant
    if (input.allowHeroImage) selections.allow_hero_image = true
  }

  coerceCanvasForContent(selections)

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
