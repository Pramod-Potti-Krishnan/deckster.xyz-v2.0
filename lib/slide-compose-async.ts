export type AsyncSlideComposeRequest<T extends Record<string, unknown>> = T & {
  job_id: string
  async: true
  assume_on_missing: true
}

// Director can legally hold same-target async siblings for up to 300s while
// preserving FIFO, and a Slide Builder pass can take about 120s. Keep this
// client watchdog above that budget until a backend heartbeat replaces it.
export const SLIDE_COMPOSE_WATCHDOG_MS = 480_000

export interface SlideComposeProgressStatusInput {
  text?: unknown
}

export function buildSlideComposeProgressStatus(
  progress: SlideComposeProgressStatusInput,
): {
  status: 'generating'
  text: string
  progress: null
  estimated_time: null
} {
  const text = typeof progress.text === 'string' ? progress.text.trim() : ''
  return {
    status: 'generating',
    text: text || 'Building slide…',
    progress: null,
    estimated_time: null,
  }
}

export function hasLiveTrackedEphemeralMessage(
  messageIds: readonly string[],
  trackedMessageIds: ReadonlySet<string>,
): boolean {
  return messageIds.some(messageId => trackedMessageIds.has(messageId))
}

export function withAsyncSlideComposeFields<T extends Record<string, unknown>>(
  request: T,
  jobId: string,
): AsyncSlideComposeRequest<T> {
  return {
    ...request,
    job_id: jobId,
    async: true,
    assume_on_missing: true,
  }
}

export function normalizeSlideComposeSocketFrame<T extends { type?: string; payload?: unknown } & Record<string, unknown>>(
  raw: T,
): T {
  if ((raw.type === 'slide_ready' || raw.type === 'slide_failed') && !raw.payload) {
    const { type, message_id, session_id, timestamp, ...payload } = raw
    return {
      message_id,
      session_id,
      timestamp,
      type,
      payload,
    } as unknown as T
  }
  return raw
}

export interface SlideComposeVisualJob {
  kind?: 'compose' | 'refine'
  target_visual_index?: number
  target_layout_index?: number
  targetIndex?: number
  targetLayoutIndex?: number
  status: string
}

export type SlideComposeVisualOrderItem<TSlide, TJob> =
  | { kind: 'slide'; slide: TSlide; layoutIndex: number; visualIndex: number; visualNumber: number }
  | { kind: 'compose'; job: TJob; targetLayoutIndex: number; visualIndex: number; visualNumber: number }

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function getSlideComposeTargetLayoutIndex(job: SlideComposeVisualJob): number {
  return Math.max(
    0,
    finiteNumber(job.target_layout_index)
      ?? finiteNumber(job.targetLayoutIndex)
      ?? finiteNumber(job.targetIndex)
      ?? finiteNumber(job.target_visual_index)
      ?? 0,
  )
}

export function buildSlideComposeVisualOrder<
  TSlide,
  TJob extends SlideComposeVisualJob,
>(
  slides: TSlide[],
  composeJobs: TJob[],
): Array<SlideComposeVisualOrderItem<TSlide, TJob>> {
  const orderedItems: Array<SlideComposeVisualOrderItem<TSlide, TJob>> = []
  const normalizedComposeJobs = [...composeJobs]
    .map((job, originalIndex) => ({
      job,
      originalIndex,
      targetLayoutIndex: Math.min(getSlideComposeTargetLayoutIndex(job), slides.length),
    }))
    .sort((a, b) => {
      const targetDelta = a.targetLayoutIndex - b.targetLayoutIndex
      return targetDelta === 0 ? a.originalIndex - b.originalIndex : targetDelta
    })

  for (let index = 0; index <= slides.length; index += 1) {
    normalizedComposeJobs
      .filter(({ targetLayoutIndex }) => targetLayoutIndex === index)
      .forEach(({ job, targetLayoutIndex }) => {
        const visualIndex = orderedItems.length
        orderedItems.push({
          kind: 'compose',
          job,
          targetLayoutIndex,
          visualIndex,
          visualNumber: visualIndex + 1,
        })
      })
    if (index < slides.length) {
      const visualIndex = orderedItems.length
      orderedItems.push({
        kind: 'slide',
        slide: slides[index],
        layoutIndex: index,
        visualIndex,
        visualNumber: visualIndex + 1,
      })
    }
  }

  return orderedItems
}

export function getComposeVisualIndexForTarget(
  layoutTargetIndex: number,
  jobs: Record<string, SlideComposeVisualJob>,
): number {
  let visualIndex = Math.max(0, layoutTargetIndex)
  const buildingJobs = Object.values(jobs)
    .filter(job => job.status === 'building' && job.kind !== 'refine')
    .sort((a, b) => {
      const targetDelta = getSlideComposeTargetLayoutIndex(a) - getSlideComposeTargetLayoutIndex(b)
      if (targetDelta !== 0) return targetDelta
      return (finiteNumber(a.target_visual_index) ?? 0) - (finiteNumber(b.target_visual_index) ?? 0)
    })

  for (const job of buildingJobs) {
    if (getSlideComposeTargetLayoutIndex(job) <= layoutTargetIndex) {
      visualIndex += 1
    }
  }

  return visualIndex
}

export function resolveSlideComposeVisualIndex(
  visualIndex: number,
  options: {
    slideCount: number
    jobs: Record<string, SlideComposeVisualJob>
  },
): { kind: 'slide'; layoutIndex: number } | { kind: 'compose'; targetLayoutIndex: number } | null {
  const slides = Array.from({ length: Math.max(0, options.slideCount) }, (_, index) => index)
  const jobs = Object.values(options.jobs)
    .filter(job => job.kind !== 'refine' && (job.status === 'building' || job.status === 'error'))
  const item = buildSlideComposeVisualOrder(slides, jobs).find(entry => entry.visualIndex === visualIndex)
  if (!item) return null
  if (item.kind === 'slide') {
    return { kind: 'slide', layoutIndex: item.layoutIndex }
  }
  return { kind: 'compose', targetLayoutIndex: item.targetLayoutIndex }
}

export function shiftSlideComposeTargetsAfterInsert<TJob extends SlideComposeVisualJob>(
  jobs: Record<string, TJob>,
  completedJobId: string,
  insertedLayoutIndex?: number | null,
): Record<string, TJob> {
  const { [completedJobId]: _completed, ...remainingJobs } = jobs
  const insertedIndex = finiteNumber(insertedLayoutIndex)
  if (insertedIndex === null) {
    return remainingJobs
  }

  return Object.fromEntries(
    Object.entries(remainingJobs).map(([jobId, job]) => {
      const currentTarget = getSlideComposeTargetLayoutIndex(job)
      if (currentTarget < insertedIndex) {
        return [jobId, job]
      }
      return [
        jobId,
        {
          ...job,
          target_layout_index: currentTarget + 1,
        } as TJob,
      ]
    }),
  )
}

export function resolveSlideComposeViewerState(
  data: Record<string, unknown>,
  fallbackTotal = 0,
): { currentVisualIndex: number; realTotal: number; visualTotal: number } {
  const currentVisualIndex = Math.max(0, finiteNumber(data.current_visual_index) ?? finiteNumber(data.index) ?? 0)
  const realTotal = Math.max(0, finiteNumber(data.real_slide_count) ?? finiteNumber(data.total) ?? fallbackTotal)
  const visualTotal = Math.max(
    realTotal,
    finiteNumber(data.visual_section_count) ??
      finiteNumber(data.total_visual_sections) ??
      finiteNumber(data.total) ??
      realTotal,
  )
  return { currentVisualIndex, realTotal, visualTotal }
}

export function isMatchingSlideComposeCommandResponse(
  data: unknown,
  options: {
    requestId: string
    action: string
    expectedJobId?: string | null
  },
): boolean {
  const { requestId, action, expectedJobId } = options
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (record.requestId !== requestId) return false
  if (record.action !== action) return false
  if (expectedJobId && record.job_id !== expectedJobId) return false
  return true
}

export function canLiveReconcileSlideCompose(realSlideId: unknown): realSlideId is string {
  return typeof realSlideId === 'string' && realSlideId.trim().length > 0
}

export function canPollCompleteSlideComposeJob(realSlideId: unknown): realSlideId is string {
  // Layout briefly exposes append-before-reorder state while Director is still
  // inserting. Count-only polling can catch that transient end-of-deck slide and
  // force a bad live reload. Poll completion is therefore identity-only.
  return canLiveReconcileSlideCompose(realSlideId)
}

function normalizeComposePresentationUrlForCompare(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value, 'https://deckster.local')
    parsed.searchParams.delete('sc_refresh')
    const origin = parsed.origin === 'https://deckster.local' ? '' : parsed.origin
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return value.replace(/([?&])sc_refresh=\d+(&?)/, (_match, prefix, suffix) => {
      if (prefix === '?' && !suffix) return ''
      return suffix ? prefix : ''
    })
  }
}

export function shouldUseIncomingComposePresentationUrl(
  currentUrl: string | null | undefined,
  incomingUrl: string | null | undefined,
): boolean {
  if (!incomingUrl) return false
  if (!currentUrl) return true
  return (
    normalizeComposePresentationUrlForCompare(currentUrl) !==
    normalizeComposePresentationUrlForCompare(incomingUrl)
  )
}

export function resolveSlideComposeCountAfterReady(options: {
  currentSlideCount: number | null | undefined
  resolvedVisualIndex: number
  viewerSlideCount?: number | null
  existingDeck: boolean
}): number {
  const viewerSlideCount = Number(options.viewerSlideCount)
  if (Number.isFinite(viewerSlideCount) && viewerSlideCount > 0) {
    return viewerSlideCount
  }
  const currentSlideCount = Math.max(0, options.currentSlideCount ?? 0)
  return Math.max(
    options.existingDeck ? currentSlideCount + 1 : currentSlideCount,
    Math.max(0, options.resolvedVisualIndex) + 1,
  )
}

export function shouldNavigateToResolvedComposeSlide(options: {
  currentSlideIndex: number
  jobTargetVisualIndex?: number | null
  resolvedVisualIndex: number
}): boolean {
  return (
    options.currentSlideIndex === options.jobTargetVisualIndex ||
    options.currentSlideIndex === options.resolvedVisualIndex
  )
}
