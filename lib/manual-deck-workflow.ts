import type { BuildThemeSelection } from '@/lib/theme-builder'
import type { TemplateOverrides } from '@/lib/template-mode'

const ELEMENT_COLLECTION_KEYS = [
  'text_boxes',
  'images',
  'charts',
  'infographics',
  'diagrams',
  'contents',
  'elements',
  'tables',
  'shapes',
  'icon_labels',
] as const

const DEFAULT_BLANK_LAYOUTS = new Set(['H1-structured', 'blank'])
const INITIAL_BLANK_LAYOUTS = new Set(['H1s', 'H1-structured', 'blank', 'B1'])
const EMPTY_HTML = /<(?:br|p|div)(?:\s[^>]*)?>\s*(?:&nbsp;|&#160;|\s)*<\/(?:p|div)>|<br\s*\/?>/gi

export interface ManualDeckSummary {
  slide_count: number
  element_count: number
  customized_slide_count: number
  note_count: number
  slide_titles: string[]
  slides: ManualDeckSlideSummary[]
  reasons: Array<'additional_slides' | 'elements' | 'content' | 'layout' | 'background' | 'notes'>
}

export interface ManualDeckSlideSummary {
  slide_index: number
  title: string
  layout: string
  content: Record<string, string | number | boolean>
  element_counts: Record<string, number>
  notes?: string
  intent?: string
}

export interface ManualDeckInspection {
  hasMeaningfulWork: boolean
  summary: ManualDeckSummary
}

export interface ManualDeckContext {
  policy: 'prepend_generated'
  source_presentation_id: string
  source_presentation_url?: string
  slide_count: number
  summary: ManualDeckSummary
  operation_id: string
}

export interface PendingHandoffSubmission {
  version: 1
  source_session_id: string
  new_session_id: string
  idempotency_key: string
  text: string
  store_name: string | null
  file_count: number
  deep_research: boolean
  web_search: boolean
  extended_generation: boolean
  use_knowledge_graph: boolean
  theme: BuildThemeSelection
  template_mode: boolean
  template_id: string | null
  element_overrides?: TemplateOverrides
}

export interface SessionHandoffRequest {
  user_id: string
  idempotency_key: string
  pending_request: string
  theme: BuildThemeSelection
  template_mode: boolean
  template_id?: string
  research: {
    deep_research: boolean
    web_search: boolean
    use_knowledge_graph: boolean
  }
  store_name?: string
  attachment_store_references: Array<{ store_name: string }>
  manual_deck_summary: ManualDeckSummary
}

type StorageReader = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizedText(value: string): string {
  return value
    .replace(EMPTY_HTML, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim()
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') return normalizedText(value).length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.some(hasMeaningfulValue)
  const record = asRecord(value)
  return record ? Object.values(record).some(hasMeaningfulValue) : false
}

function slideTitle(slide: Record<string, unknown>, index: number): string {
  const content = asRecord(slide.content)
  const candidates = [
    content?.slide_title,
    content?.title,
    slide.slide_title,
    slide.title,
  ]
  const title = candidates.find(value => typeof value === 'string' && normalizedText(value).length > 0)
  return typeof title === 'string' ? normalizedText(title).slice(0, 160) : `Slide ${index + 1}`
}

function slideNotes(slide: Record<string, unknown>): unknown {
  return slide.speaker_notes ?? slide.notes ?? asRecord(slide.content)?.speaker_notes
}

function boundedText(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null
  const text = normalizedText(value)
  return text ? text.slice(0, limit) : null
}

function summarizeContent(value: unknown): Record<string, string | number | boolean> {
  const content = asRecord(value)
  if (!content) return {}

  return Object.entries(content).slice(0, 24).reduce<Record<string, string | number | boolean>>(
    (summary, [key, item]) => {
      if (typeof item === 'string') {
        const text = boundedText(item, 500)
        if (text) summary[key] = text
      } else if (typeof item === 'number' && Number.isFinite(item)) {
        summary[key] = item
      } else if (typeof item === 'boolean') {
        summary[key] = item
      } else if (Array.isArray(item) || asRecord(item)) {
        try {
          const text = normalizedText(JSON.stringify(item)).slice(0, 500)
          if (text && text !== '[]' && text !== '{}') summary[key] = text
        } catch {
          // Non-serializable editor state is omitted from the structured handoff.
        }
      }
      return summary
    },
    {},
  )
}

function summarizeSlide(slide: Record<string, unknown>, index: number): ManualDeckSlideSummary {
  const content = asRecord(slide.content)
  const metadata = asRecord(slide.metadata)
  const elementCounts = ELEMENT_COLLECTION_KEYS.reduce<Record<string, number>>((counts, key) => {
    const collection = slide[key]
    if (Array.isArray(collection) && collection.length > 0) counts[key] = collection.length
    return counts
  }, {})
  const intent = [
    slide.intent,
    metadata?.intent,
    content?.intent,
    content?.purpose,
  ].map(value => boundedText(value, 300)).find(Boolean) ?? null
  const notes = boundedText(slideNotes(slide), 800)

  return {
    slide_index: index,
    title: slideTitle(slide, index),
    layout: typeof slide.layout === 'string' ? slide.layout : 'unknown',
    content: summarizeContent(slide.content),
    element_counts: elementCounts,
    ...(notes ? { notes } : {}),
    ...(intent ? { intent } : {}),
  }
}

/**
 * Detects customized slide work without considering presentation-level theme data.
 * The untouched Director blank is deliberately narrow: one H1/blank slide, empty
 * content, no visual elements, no notes, and no explicit background.
 */
export function inspectManualDeck(value: unknown): ManualDeckInspection {
  const presentation = asRecord(value)
  const slides = Array.isArray(presentation?.slides)
    ? presentation.slides.map(asRecord).filter((slide): slide is Record<string, unknown> => !!slide)
    : []

  let elementCount = 0
  let customizedSlideCount = 0
  let noteCount = 0
  let hasContent = false
  let hasLayoutChange = false
  let hasBackground = false

  slides.forEach((slide) => {
    const slideElementCount = ELEMENT_COLLECTION_KEYS.reduce((count, key) => {
      const collection = slide[key]
      return count + (Array.isArray(collection) ? collection.length : 0)
    }, 0)
    elementCount += slideElementCount

    const contentChanged = hasMeaningfulValue(slide.content)
    const layout = typeof slide.layout === 'string' ? slide.layout : ''
    const metadata = asRecord(slide.metadata)
    const isMarkedInitialBlank = metadata?.is_blank === true || slide.is_blank === true
    const backgroundChanged = [
      slide.background_color,
      slide.background_image,
      asRecord(slide.content)?.background_color,
      asRecord(slide.content)?.background_image,
    ]
      .some(value => typeof value === 'string' && value.trim().length > 0)
    const notesChanged = hasMeaningfulValue(slideNotes(slide))
    const isPristineInitialBlank = slides.length === 1
      && isMarkedInitialBlank
      && INITIAL_BLANK_LAYOUTS.has(layout)
      && slideElementCount === 0
      && !contentChanged
      && !backgroundChanged
      && !notesChanged
    const layoutChanged = !isPristineInitialBlank && !!layout && !DEFAULT_BLANK_LAYOUTS.has(layout)

    if (contentChanged) hasContent = true
    if (layoutChanged) hasLayoutChange = true
    if (backgroundChanged) hasBackground = true
    if (notesChanged) noteCount += 1
    if (slideElementCount > 0 || contentChanged || layoutChanged || backgroundChanged || notesChanged) {
      customizedSlideCount += 1
    }
  })

  const reasons: ManualDeckSummary['reasons'] = []
  if (slides.length > 1) reasons.push('additional_slides')
  if (elementCount > 0) reasons.push('elements')
  if (hasContent) reasons.push('content')
  if (hasLayoutChange) reasons.push('layout')
  if (hasBackground) reasons.push('background')
  if (noteCount > 0) reasons.push('notes')

  return {
    hasMeaningfulWork: reasons.length > 0,
    summary: {
      slide_count: slides.length,
      element_count: elementCount,
      customized_slide_count: customizedSlideCount,
      note_count: noteCount,
      slide_titles: slides.map(slideTitle).slice(0, 30),
      slides: slides.slice(0, 30).map(summarizeSlide),
      reasons,
    },
  }
}

export function createManualDeckContext(input: {
  presentationId: string
  presentationUrl?: string | null
  summary: ManualDeckSummary
  operationId: string
}): ManualDeckContext {
  return {
    policy: 'prepend_generated',
    source_presentation_id: input.presentationId,
    ...(input.presentationUrl ? { source_presentation_url: input.presentationUrl } : {}),
    slide_count: input.summary.slide_count,
    summary: input.summary,
    operation_id: input.operationId,
  }
}

export function buildSessionHandoffRequest(input: {
  userId: string
  idempotencyKey: string
  pendingRequest: string
  theme: BuildThemeSelection
  templateMode: boolean
  templateId?: string | null
  deepResearch: boolean
  webSearch: boolean
  useKnowledgeGraph: boolean
  storeName?: string | null
  manualDeckSummary: ManualDeckSummary
}): SessionHandoffRequest {
  const storeName = input.storeName?.trim() || ''
  return {
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    pending_request: input.pendingRequest,
    theme: input.theme,
    template_mode: input.templateMode,
    ...(input.templateId ? { template_id: input.templateId } : {}),
    research: {
      deep_research: input.deepResearch,
      web_search: input.webSearch,
      use_knowledge_graph: input.useKnowledgeGraph,
    },
    ...(storeName ? { store_name: storeName } : {}),
    attachment_store_references: storeName ? [{ store_name: storeName }] : [],
    manual_deck_summary: input.manualDeckSummary,
  }
}

export function pendingHandoffStorageKey(sessionId: string): string {
  return `deckster_pending_handoff_${sessionId}`
}

export function savePendingHandoff(storage: StorageReader, pending: PendingHandoffSubmission): void {
  storage.setItem(pendingHandoffStorageKey(pending.new_session_id), JSON.stringify(pending))
}

export function readPendingHandoff(
  storage: StorageReader,
  sessionId: string,
): PendingHandoffSubmission | null {
  const key = pendingHandoffStorageKey(sessionId)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PendingHandoffSubmission>
    if (
      parsed.version !== 1 ||
      parsed.new_session_id !== sessionId ||
      typeof parsed.source_session_id !== 'string' ||
      typeof parsed.idempotency_key !== 'string' ||
      typeof parsed.text !== 'string' ||
      !parsed.text.trim() ||
      (parsed.store_name !== null && typeof parsed.store_name !== 'string') ||
      typeof parsed.file_count !== 'number' ||
      typeof parsed.deep_research !== 'boolean' ||
      typeof parsed.web_search !== 'boolean' ||
      typeof parsed.extended_generation !== 'boolean' ||
      typeof parsed.use_knowledge_graph !== 'boolean' ||
      typeof parsed.template_mode !== 'boolean' ||
      (parsed.template_id !== null && typeof parsed.template_id !== 'string') ||
      !parsed.theme ||
      typeof parsed.theme !== 'object'
    ) {
      throw new Error('invalid pending handoff')
    }
    return parsed as PendingHandoffSubmission
  } catch {
    try { storage.removeItem(key) } catch {}
    return null
  }
}

export function clearPendingHandoff(storage: StorageReader, sessionId: string): void {
  try {
    storage.removeItem(pendingHandoffStorageKey(sessionId))
  } catch {
    // A successful WebSocket submission is already protected by the in-memory
    // guard and Director idempotency when browser storage is unavailable.
  }
}
