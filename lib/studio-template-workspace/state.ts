// PASS2-PK-FOUR item 4 (frontend-2): the template workspace state machine. Pure: (state, event) -> state, no timers, no I/O.
// Flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (default off); nothing reads this module with the flag off.
//
// Rules (each one is pinned by scripts/test-studio-template-workspace.mjs):
//  - Events for another job are ignored. A refused job (over the slide cap) ignores everything after the refusal.
//  - Per-slide states only move forwards: queued -> analysing -> analysed -> locked | kept as-is (unlockable). A duplicate or a late
//    per-slide event can never move a slide back. One exception: a kept-as-is slide may still lock (a retry that succeeded).
//  - The job's status moves converting -> locking (as_is_ready) -> ready (template_ready), with paused / failed on the side.
//    "Ready" is final. A paused or failed job resumes when work moves on after it: a slide event with a higher `seq` than the
//    pause/failure, or (when the source does not number its events) a slide that starts analysing. A late status event (seq lower
//    than the last status change) is ignored.
//  - Slide events that arrive before as_is_ready are kept; as_is_ready then fixes the slide count and drops out-of-range slides.
//  - Progress (`slides_done`) never goes backwards; the time-left estimate is the latest one that is not late.
import {
  TEMPLATE_WORKSPACE_LONG_DECK_SLIDES,
  TEMPLATE_WORKSPACE_SLIDE_CAP,
  type TemplateConversionStage,
  type TemplateElementRole,
  type TemplateLearnedLayout,
  type TemplateWhatChanged,
  type TemplateWorkspaceEvent,
} from './contract'

export type TemplateSlideState = 'queued' | 'analysing' | 'analysed' | 'locked' | 'unlockable'

export interface TemplateSlideStatus {
  state: Exclude<TemplateSlideState, 'queued'>
  /** Rule-decided roles known when analysis starts (logo, footer…). */
  fixed: TemplateElementRole[]
  /** Every region's role once analysed. */
  roles: TemplateElementRole[]
  layoutId?: string
  /** Why a slide is kept as-is, in plain words. */
  reason?: { code: string; text: string }
}

export type TemplateWorkspaceStatus = 'converting' | 'locking' | 'paused' | 'failed' | 'ready' | 'refused'

export interface TemplateWorkspaceDeck {
  templateId: string
  templateName: string
  presentationId: string
  viewerUrl: string
  elementCount: number
  changes: TemplateWhatChanged[]
  labels: Record<number, string>
}

export interface TemplateWorkspaceProblem {
  kind: 'paused' | 'failed' | 'refused'
  code: string
  text: string
  retryable: boolean
}

export interface TemplateWorkspaceState {
  jobId: string
  status: TemplateWorkspaceStatus
  /** seq of the event that last changed the status (null: none, or the source does not number its events). */
  statusSeq: number | null
  stage: TemplateConversionStage | null
  slidesConverted: number
  slideCount: number | null
  deck: TemplateWorkspaceDeck | null
  /** By 0-based slide index; a slide that is not here is queued. */
  slides: Record<number, TemplateSlideStatus>
  slidesDone: number
  etaSeconds: number | null
  etaSeq: number | null
  ready: { templateId: string; newTopic: boolean; layoutCount: number; representatives: TemplateLearnedLayout[] } | null
  problem: TemplateWorkspaceProblem | null
}

export function initialTemplateWorkspaceState(jobId: string): TemplateWorkspaceState {
  return {
    jobId, status: 'converting', statusSeq: null, stage: null, slidesConverted: 0, slideCount: null, deck: null, slides: {},
    slidesDone: 0, etaSeconds: null, etaSeq: null, ready: null, problem: null,
  }
}

const RANK: Record<TemplateSlideStatus['state'], number> = { analysing: 1, analysed: 2, locked: 3, unlockable: 3 }
const STAGE_RANK: Record<TemplateConversionStage, number> = { converting: 0, placing: 1, checking: 2 }

export function overSlideCap(slideCount: number): boolean {
  return slideCount > TEMPLATE_WORKSPACE_SLIDE_CAP
}

export function isLongDeck(slideCount: number | null): boolean {
  return slideCount !== null && slideCount >= TEMPLATE_WORKSPACE_LONG_DECK_SLIDES && !overSlideCap(slideCount)
}

function refusal(slideCount: number): TemplateWorkspaceProblem {
  return {
    kind: 'refused', code: 'too_many_slides', retryable: false,
    text: `This deck has ${slideCount} slides. A template can have up to ${TEMPLATE_WORKSPACE_SLIDE_CAP}; split the deck, then upload each part.`,
  }
}

const late = (state: TemplateWorkspaceState, seq: number | undefined) => seq !== undefined && state.statusSeq !== null && seq < state.statusSeq
const statusSeqOf = (seq: number | undefined) => (seq === undefined ? null : seq)

function withSlide(state: TemplateWorkspaceState, index: number, next: TemplateSlideStatus): TemplateWorkspaceState {
  return { ...state, slides: { ...state.slides, [index]: next } }
}

/** Applies one validated event. Returns the same object when the event changes nothing (duplicates, ignored events). */
export function reduceTemplateWorkspace(state: TemplateWorkspaceState, event: TemplateWorkspaceEvent): TemplateWorkspaceState {
  if (event.job_id !== state.jobId || state.status === 'refused') return state
  switch (event.type) {
    case 'stage': {
      if (state.status !== 'converting' || late(state, event.seq)) return state
      const stage = state.stage && STAGE_RANK[state.stage] > STAGE_RANK[event.stage] ? state.stage : event.stage
      const slidesConverted = Math.max(state.slidesConverted, event.slides_converted ?? 0)
      const slideCount = state.slideCount ?? event.slide_count ?? null
      if (slideCount !== null && overSlideCap(slideCount)) {
        return { ...state, stage, slidesConverted, slideCount, status: 'refused', statusSeq: statusSeqOf(event.seq), problem: refusal(slideCount) }
      }
      if (stage === state.stage && slidesConverted === state.slidesConverted && slideCount === state.slideCount) return state
      return { ...state, stage, slidesConverted, slideCount }
    }
    case 'as_is_ready': {
      if (overSlideCap(event.slide_count)) {
        return { ...state, slideCount: event.slide_count, status: 'refused', statusSeq: statusSeqOf(event.seq), problem: refusal(event.slide_count) }
      }
      const deck: TemplateWorkspaceDeck = state.deck ?? {
        templateId: event.template_id, templateName: event.template_name, presentationId: event.presentation_id, viewerUrl: event.viewer_url,
        elementCount: event.element_count, changes: event.changes,
        labels: Object.fromEntries((event.slides ?? []).map(slide => [slide.slide_index, slide.label])),
      }
      const slides: Record<number, TemplateSlideStatus> = {}
      for (const [key, value] of Object.entries(state.slides)) if (Number(key) < event.slide_count) slides[Number(key)] = value
      const promote = state.status === 'converting' && !late(state, event.seq)
      const next: TemplateWorkspaceState = {
        ...state, deck, slides, slideCount: event.slide_count, slidesConverted: event.slide_count,
        slidesDone: Math.min(state.slidesDone, event.slide_count),
        ...(promote ? { status: 'locking' as const, statusSeq: statusSeqOf(event.seq) ?? state.statusSeq } : {}),
      }
      if (!promote && state.deck && state.slideCount === event.slide_count && Object.keys(slides).length === Object.keys(state.slides).length) return state
      return next
    }
    case 'slide_analysing':
    case 'slide_analysed':
    case 'slide_locked':
    case 'slide_unlockable': {
      const index = event.slide_index
      if (state.slideCount !== null && index >= state.slideCount) return state
      const current = state.slides[index]
      const target: TemplateSlideStatus['state'] = event.type === 'slide_analysing' ? 'analysing'
        : event.type === 'slide_analysed' ? 'analysed' : event.type === 'slide_locked' ? 'locked' : 'unlockable'
      const advances = !current || RANK[target] > RANK[current.state] || (current.state === 'unlockable' && target === 'locked')
      if (!advances) return state
      const base: TemplateSlideStatus = current ?? { state: target, fixed: [], roles: [] }
      let slide: TemplateSlideStatus
      if (event.type === 'slide_analysing') slide = { ...base, state: 'analysing', fixed: event.fixed ?? [] }
      else if (event.type === 'slide_analysed') slide = { ...base, state: 'analysed', roles: event.roles }
      else if (event.type === 'slide_locked') slide = { ...base, state: 'locked', ...(event.layout_id ? { layoutId: event.layout_id } : {}), reason: undefined }
      else slide = { ...base, state: 'unlockable', reason: { code: event.reason_code, text: event.reason } }
      let next = withSlide(state, index, slide)
      // Work moving on after a pause or a failure means the job is running again: with numbered events, any slide that moves on with a
      // higher seq than the pause; without numbers, only a slide that STARTS analysing (a result that was in flight when the job paused
      // can still land late, and must not look like a resume).
      const resumes = (state.status === 'paused' || state.status === 'failed') && state.deck !== null
        && (event.seq !== undefined ? state.statusSeq === null || event.seq > state.statusSeq : event.type === 'slide_analysing')
      if (resumes) next = { ...next, status: 'locking', statusSeq: statusSeqOf(event.seq) ?? state.statusSeq, problem: null }
      return next
    }
    case 'slides_done': {
      const slideCount = state.slideCount ?? event.slide_count
      if (event.slides_done > slideCount) return state
      const slidesDone = Math.max(state.slidesDone, event.slides_done)
      const etaFresh = event.eta_seconds !== undefined && state.status !== 'ready' && !late(state, event.seq) && (event.seq === undefined || state.etaSeq === null || event.seq >= state.etaSeq)
      const etaSeconds = etaFresh ? event.eta_seconds ?? null : state.etaSeconds
      const etaSeq = etaFresh && event.seq !== undefined ? event.seq : state.etaSeq
      if (slidesDone === state.slidesDone && slideCount === state.slideCount && etaSeconds === state.etaSeconds && etaSeq === state.etaSeq) return state
      return { ...state, slideCount, slidesDone, etaSeconds, etaSeq }
    }
    case 'template_ready': {
      if (state.status === 'ready') return state
      const slides: Record<number, TemplateSlideStatus> = { ...state.slides }
      const total = state.slideCount ?? 0
      for (let i = 0; i < total; i++) {
        const slide = slides[i]
        if (!slide) slides[i] = { state: 'locked', fixed: [], roles: [] }
        else if (slide.state !== 'unlockable' && slide.state !== 'locked') slides[i] = { ...slide, state: 'locked' }
      }
      return {
        ...state, slides, status: 'ready', statusSeq: statusSeqOf(event.seq) ?? state.statusSeq, problem: null, etaSeconds: 0,
        slidesDone: total || state.slidesDone,
        ready: { templateId: event.template_id, newTopic: event.capabilities.new_topic === 'available', layoutCount: event.layouts.count, representatives: event.layouts.representatives },
      }
    }
    case 'paused':
    case 'failed': {
      if (state.status === 'ready' || late(state, event.seq)) return state
      if (event.type === 'paused' && state.status === 'failed') return state
      const problem: TemplateWorkspaceProblem = { kind: event.type, code: event.reason_code, text: event.reason, retryable: event.retryable }
      if (state.status === event.type && state.problem && state.problem.code === problem.code && state.problem.text === problem.text
        && state.problem.retryable === problem.retryable) return state
      return { ...state, status: event.type, statusSeq: statusSeqOf(event.seq) ?? state.statusSeq, problem }
    }
    default:
      return state
  }
}

export function reduceTemplateWorkspaceEvents(state: TemplateWorkspaceState, events: TemplateWorkspaceEvent[]): TemplateWorkspaceState {
  return events.reduce(reduceTemplateWorkspace, state)
}

// ── selectors ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function slideStateOf(state: TemplateWorkspaceState, index: number): TemplateSlideState {
  return state.slides[index]?.state ?? 'queued'
}

export interface TemplateWorkspaceCounts {
  total: number
  locked: number
  kept: number
  analysing: number
  queued: number
  /** Slides finished (locked or kept as-is), never less than the server reported. */
  done: number
}

export function templateWorkspaceCounts(state: TemplateWorkspaceState): TemplateWorkspaceCounts {
  const total = state.slideCount ?? 0
  let locked = 0, kept = 0, analysing = 0
  for (let i = 0; i < total; i++) {
    const s = slideStateOf(state, i)
    if (s === 'locked') locked++
    else if (s === 'unlockable') kept++
    else if (s === 'analysing' || s === 'analysed') analysing++
  }
  const done = Math.min(total, Math.max(state.slidesDone, locked + kept))
  return { total, locked, kept, analysing, queued: Math.max(0, total - locked - kept - analysing), done }
}

/** "about 2 min left" / "less than a minute left"; null when the server gave no estimate. */
export function templateEtaLabel(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 50) return 'less than a minute left'
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `about ${minutes} min left`
}

export type TemplatePillTone = 'ai' | 'ok' | 'warn'
export type TemplateTick = 'l' | 'a' | 'w' | 'q'

export interface TemplateWorkspacePill {
  tone: TemplatePillTone
  label: string
  /** One tick per slide: locked, analysing, kept as-is, queued. Empty before the slide count is known. */
  ticks: TemplateTick[]
  eta: string | null
  spinning: boolean
}

export function templateWorkspacePill(state: TemplateWorkspaceState): TemplateWorkspacePill {
  const counts = templateWorkspaceCounts(state)
  const ticks: TemplateTick[] = []
  for (let i = 0; i < counts.total; i++) {
    const s = slideStateOf(state, i)
    ticks.push(s === 'locked' ? 'l' : s === 'unlockable' ? 'w' : s === 'analysing' || s === 'analysed' ? 'a' : 'q')
  }
  const of = `${counts.done}/${counts.total}`
  switch (state.status) {
    case 'converting':
      return { tone: 'ai', label: state.slideCount ? `Converting: ${state.slidesConverted}/${state.slideCount}` : 'Converting your deck', ticks: [], eta: null, spinning: true }
    case 'locking':
      return { tone: 'ai', label: `Locking template: ${of}`, ticks, eta: templateEtaLabel(state.etaSeconds), spinning: true }
    case 'paused':
      return { tone: 'warn', label: `Locking paused: ${of}`, ticks, eta: null, spinning: false }
    case 'failed':
      return state.deck
        ? { tone: 'warn', label: `Locking stopped: ${of}`, ticks, eta: null, spinning: false }
        : { tone: 'warn', label: 'Conversion stopped', ticks: [], eta: null, spinning: false }
    case 'refused':
      return { tone: 'warn', label: 'Too many slides', ticks: [], eta: null, spinning: false }
    case 'ready':
      return { tone: 'ok', label: counts.kept ? `Template ready · ${counts.locked}/${counts.total} · ${counts.kept} kept as-is` : `Template ready · ${of}`, ticks, eta: null, spinning: false }
  }
}

/** The ready moment's eyebrow: "30 of 30 slides locked" or "29 of 30 locked · 1 kept as-is" (never a bare "ready"). */
export function templateReadySummary(state: TemplateWorkspaceState): string {
  const counts = templateWorkspaceCounts(state)
  return counts.kept
    ? `${counts.locked} of ${counts.total} locked · ${counts.kept} kept as-is`
    : `${counts.locked} of ${counts.total} slides locked`
}

/** Reuse as-is works from as-is ready; New topics only once the template is ready and the projection says so. */
export function templateCapabilities(state: TemplateWorkspaceState): { reuseAsIs: boolean; newTopic: boolean } {
  return {
    reuseAsIs: state.deck !== null && state.status !== 'refused',
    newTopic: state.status === 'ready' && Boolean(state.ready?.newTopic),
  }
}
