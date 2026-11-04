// PASS2-PK-FOUR item 4 (frontend-2): the template upload "wow" workspace. Flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (exact "true",
// Studio shell only), default off.
//
// The typed CLIENT contract for the events the workspace consumes, taken from the "Backend signals each state needs" table of the
// approved frames (streams/ops/PASS2/PK4-4-template-wow/README.md). COMPOSER-2 and Director own the producing side (S4/S5); the names
// below are the frames' proposals. Every event reaches the workspace through ONE adapter (./adapter.ts), which validates it with
// `normaliseTemplateWorkspaceEvent` first, so a source that sends something else is dropped, never half-applied.
//
// Envelope: every event names the ingest job it belongs to (`job_id`, events for another job are ignored) and may carry `seq`, a number
// that grows with each event of that job. With `seq`, a late event (seq lower than the job's last status change) cannot move the job's
// status backwards; without it, arrival order is used. Per-slide states only ever move forwards, so duplicates and late per-slide
// events are harmless either way.

/** Templates are refused above this many slides (PK, Q10). */
export const TEMPLATE_WORKSPACE_SLIDE_CAP = 120
/** From this many slides a deck is "long": the workspace offers "Notify me" first (PK, Q10). */
export const TEMPLATE_WORKSPACE_LONG_DECK_SLIDES = 60
/** The frames show 2–3 slides analysing at once (PK, Q8); used by the mock source and to size the rail's "analysing" hint. */
export const TEMPLATE_WORKSPACE_PARALLEL_SLIDES = 3
/** "Deckster mode" outlines on the as-is deck fade after a few seconds (PK, Q7). */
export const TEMPLATE_WORKSPACE_OUTLINE_FADE_MS = 4500

/** Conversion stages before the as-is deck exists (S5(b) `stage`). */
export type TemplateConversionStage = 'converting' | 'placing' | 'checking'

/** One element's role, by element id of the as-is deck. `fixed` parts (logo, footer, page number) are decided by rules before any model
 *  call (D10), so they can be shown as soon as a slide starts analysing. */
export interface TemplateElementRole {
  element_id: string
  role: string
  policy: 'fixed' | 'fillable'
}

/** One line of the "What changed" report (S4). `slide_index` is 0-based, or null for a deck-wide change. */
export interface TemplateWhatChanged {
  slide_index: number | null
  text: string
}

/** One learned layout, with the slide (0-based) that best shows it. */
export interface TemplateLearnedLayout {
  layout_id: string
  label: string
  slide_index: number
}

interface Envelope {
  /** The ingest job (Director job status). */
  job_id: string
  /** Optional per-job sequence number; higher is later. */
  seq?: number
}

/** Conversion progress before as-is is ready (edge card "Before as-is is ready"). */
export interface TemplateStageEvent extends Envelope {
  type: 'stage'
  stage: TemplateConversionStage
  /** Slides converted so far, when the server knows it (thumbnails fill in as they convert). */
  slides_converted?: number
  slide_count?: number
}

/** Frame 1: the deck exists in Deckster, exactly as designed. Reuse as-is works from here (`use_original: 'available'`). */
export interface TemplateAsIsReadyEvent extends Envelope {
  type: 'as_is_ready'
  template_id: string
  template_name: string
  /** The as-is deck to render (Layout Service). */
  presentation_id: string
  viewer_url: string
  slide_count: number
  element_count: number
  /** The S4 "What changed" report. */
  changes: TemplateWhatChanged[]
  use_original: 'available'
  /** Optional per-slide labels ("Title", "KPI dashboard"), 0-based. */
  slides?: Array<{ slide_index: number; label: string }>
}

/** Frame 2: a slide started analysing (violet shimmer). `fixed` = the rule-decided chrome roles, known up front. */
export interface TemplateSlideAnalysingEvent extends Envelope {
  type: 'slide_analysing'
  slide_index: number
  fixed?: TemplateElementRole[]
}

/** The result landing (~1.5 s): each region shows the role it got, then the slide locks. */
export interface TemplateSlideAnalysedEvent extends Envelope {
  type: 'slide_analysed'
  slide_index: number
  roles: TemplateElementRole[]
}

/** Locked ✓: layout frozen, content slots ready for new topics. */
export interface TemplateSlideLockedEvent extends Envelope {
  type: 'slide_locked'
  slide_index: number
  layout_id?: string
}

/** Kept as-is: the slide could not be locked and stays in the template exactly as it is. `reason` is plain words. */
export interface TemplateSlideUnlockableEvent extends Envelope {
  type: 'slide_unlockable'
  slide_index: number
  reason_code: string
  reason: string
}

/** Job progress: slides finished (locked or kept as-is) of the deck, and the server's estimate of the time left. */
export interface TemplateSlidesDoneEvent extends Envelope {
  type: 'slides_done'
  slides_done: number
  slide_count: number
  eta_seconds?: number | null
}

/** Frame 3: every slide is locked (or kept as-is); the capability projection says what the template can do now. */
export interface TemplateReadyEvent extends Envelope {
  type: 'template_ready'
  template_id: string
  capabilities: { use_original: 'available'; new_topic: 'available' | 'unavailable' }
  layouts: { count: number; representatives: TemplateLearnedLayout[] }
}

/** Locking paused (e.g. the D7 daily analysis budget is used up). Locked slides stay locked; reuse as-is keeps working. */
export interface TemplatePausedEvent extends Envelope {
  type: 'paused'
  reason_code: string
  reason: string
  retryable: boolean
}

/** The job failed (before as-is: nothing usable; after as-is: locking stopped, the as-is deck stays usable). */
export interface TemplateFailedEvent extends Envelope {
  type: 'failed'
  reason_code: string
  reason: string
  retryable: boolean
}

export type TemplateWorkspaceEvent =
  | TemplateStageEvent
  | TemplateAsIsReadyEvent
  | TemplateSlideAnalysingEvent
  | TemplateSlideAnalysedEvent
  | TemplateSlideLockedEvent
  | TemplateSlideUnlockableEvent
  | TemplateSlidesDoneEvent
  | TemplateReadyEvent
  | TemplatePausedEvent
  | TemplateFailedEvent

export type TemplateWorkspaceEventType = TemplateWorkspaceEvent['type']

export const TEMPLATE_WORKSPACE_EVENT_TYPES: readonly TemplateWorkspaceEventType[] = [
  'stage', 'as_is_ready', 'slide_analysing', 'slide_analysed', 'slide_locked', 'slide_unlockable', 'slides_done', 'template_ready', 'paused', 'failed',
]

// ── validation ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 600): string | null => typeof value === 'string' && value.trim() ? value.slice(0, max) : null
const count = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null
const index = count

function roles(value: unknown): TemplateElementRole[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const out: TemplateElementRole[] = []
  for (const item of value.slice(0, 400)) {
    if (!isObject(item)) continue
    const element_id = text(item.element_id, 200)
    const role = text(item.role, 80)
    const policy = item.policy === 'fixed' || item.policy === 'fillable' ? item.policy : null
    if (element_id && role && policy) out.push({ element_id, role, policy })
  }
  return out
}

/**
 * The only way an event enters the workspace: returns a clean, typed copy of `raw`, or null when it is not a valid contract event
 * (unknown type, missing job id, wrong field types, negative or non-integer counts). Extra fields are dropped.
 */
export function normaliseTemplateWorkspaceEvent(raw: unknown): TemplateWorkspaceEvent | null {
  if (!isObject(raw)) return null
  const job_id = text(raw.job_id, 200)
  if (!job_id || typeof raw.type !== 'string') return null
  const envelope: Envelope = { job_id }
  if (raw.seq !== undefined) {
    if (typeof raw.seq !== 'number' || !Number.isFinite(raw.seq)) return null
    envelope.seq = raw.seq
  }
  switch (raw.type) {
    case 'stage': {
      const stage = raw.stage === 'converting' || raw.stage === 'placing' || raw.stage === 'checking' ? raw.stage : null
      if (!stage) return null
      const event: TemplateStageEvent = { ...envelope, type: 'stage', stage }
      if (count(raw.slides_converted) !== null) event.slides_converted = count(raw.slides_converted)!
      if (count(raw.slide_count) !== null && raw.slide_count !== 0) event.slide_count = count(raw.slide_count)!
      return event
    }
    case 'as_is_ready': {
      const template_id = text(raw.template_id, 200)
      const template_name = text(raw.template_name, 200)
      const presentation_id = text(raw.presentation_id, 200)
      const viewer_url = text(raw.viewer_url, 2000)
      const slide_count = count(raw.slide_count)
      const element_count = count(raw.element_count)
      if (!template_id || !template_name || !presentation_id || !viewer_url || !slide_count || element_count === null) return null
      if (raw.use_original !== 'available') return null
      const changes: TemplateWhatChanged[] = []
      if (Array.isArray(raw.changes)) {
        for (const item of raw.changes.slice(0, 50)) {
          if (!isObject(item)) continue
          const line = text(item.text, 400)
          const at = item.slide_index === null || item.slide_index === undefined ? null : index(item.slide_index)
          if (line && (at === null || at < slide_count)) changes.push({ slide_index: at, text: line })
        }
      }
      const event: TemplateAsIsReadyEvent = { ...envelope, type: 'as_is_ready', template_id, template_name, presentation_id, viewer_url, slide_count, element_count, changes, use_original: 'available' }
      if (Array.isArray(raw.slides)) {
        event.slides = raw.slides.flatMap(item => {
          if (!isObject(item)) return []
          const at = index(item.slide_index)
          const label = text(item.label, 80)
          return at !== null && at < slide_count && label ? [{ slide_index: at, label }] : []
        })
      }
      return event
    }
    case 'slide_analysing': {
      const slide_index = index(raw.slide_index)
      const fixed = roles(raw.fixed)
      if (slide_index === null || fixed === null) return null
      return { ...envelope, type: 'slide_analysing', slide_index, fixed }
    }
    case 'slide_analysed': {
      const slide_index = index(raw.slide_index)
      const found = roles(raw.roles)
      if (slide_index === null || found === null) return null
      return { ...envelope, type: 'slide_analysed', slide_index, roles: found }
    }
    case 'slide_locked': {
      const slide_index = index(raw.slide_index)
      if (slide_index === null) return null
      const event: TemplateSlideLockedEvent = { ...envelope, type: 'slide_locked', slide_index }
      const layout = text(raw.layout_id, 120)
      if (layout) event.layout_id = layout
      return event
    }
    case 'slide_unlockable': {
      const slide_index = index(raw.slide_index)
      const reason_code = text(raw.reason_code, 80)
      const reason = text(raw.reason, 400)
      if (slide_index === null || !reason_code || !reason) return null
      return { ...envelope, type: 'slide_unlockable', slide_index, reason_code, reason }
    }
    case 'slides_done': {
      const slides_done = count(raw.slides_done)
      const slide_count = count(raw.slide_count)
      if (slides_done === null || !slide_count || slides_done > slide_count) return null
      const event: TemplateSlidesDoneEvent = { ...envelope, type: 'slides_done', slides_done, slide_count }
      if (raw.eta_seconds === null) event.eta_seconds = null
      else if (typeof raw.eta_seconds === 'number' && Number.isFinite(raw.eta_seconds) && raw.eta_seconds >= 0) event.eta_seconds = Math.round(raw.eta_seconds)
      return event
    }
    case 'template_ready': {
      const template_id = text(raw.template_id, 200)
      const caps = isObject(raw.capabilities) ? raw.capabilities : null
      const layouts = isObject(raw.layouts) ? raw.layouts : null
      if (!template_id || !caps || caps.use_original !== 'available' || (caps.new_topic !== 'available' && caps.new_topic !== 'unavailable') || !layouts) return null
      const layoutCount = count(layouts.count)
      if (layoutCount === null) return null
      const representatives: TemplateLearnedLayout[] = Array.isArray(layouts.representatives) ? layouts.representatives.flatMap(item => {
        if (!isObject(item)) return []
        const layout_id = text(item.layout_id, 120)
        const label = text(item.label, 80)
        const at = index(item.slide_index)
        return layout_id && label && at !== null ? [{ layout_id, label, slide_index: at }] : []
      }).slice(0, 40) : []
      return { ...envelope, type: 'template_ready', template_id, capabilities: { use_original: 'available', new_topic: caps.new_topic }, layouts: { count: layoutCount, representatives } }
    }
    case 'paused':
    case 'failed': {
      const reason_code = text(raw.reason_code, 80)
      const reason = text(raw.reason, 400)
      if (!reason_code || !reason || typeof raw.retryable !== 'boolean') return null
      return { ...envelope, type: raw.type, reason_code, reason, retryable: raw.retryable }
    }
    default:
      return null
  }
}
