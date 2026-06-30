export type AsyncSlideComposeRequest<T extends Record<string, unknown>> = T & {
  job_id: string
  async: true
  assume_on_missing: true
}

// Director can legally hold same-target async siblings for up to 300s while
// preserving FIFO, and a Slide Builder pass can take about 120s. Keep this
// client watchdog above that budget until a backend heartbeat replaces it.
export const SLIDE_COMPOSE_WATCHDOG_MS = 480_000

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
  target_visual_index: number
  status: string
}

export type SlideComposeVisualOrderItem<TSlide, TJob> =
  | { kind: 'slide'; slide: TSlide; visualNumber: number }
  | { kind: 'compose'; job: TJob; visualNumber: number }

export function buildSlideComposeVisualOrder<
  TSlide,
  TJob extends { targetIndex: number },
>(
  slides: TSlide[],
  composeJobs: TJob[],
): Array<SlideComposeVisualOrderItem<TSlide, TJob>> {
  const orderedItems: Array<SlideComposeVisualOrderItem<TSlide, TJob>> = []
  const normalizedComposeJobs = [...composeJobs]
    .map((job, originalIndex) => ({ job, originalIndex }))
    .sort((a, b) => {
      const targetDelta = a.job.targetIndex - b.job.targetIndex
      return targetDelta === 0 ? a.originalIndex - b.originalIndex : targetDelta
    })

  for (let index = 0; index <= slides.length; index += 1) {
    normalizedComposeJobs
      .filter(({ job }) => Math.min(Math.max(job.targetIndex, 0), slides.length) === index)
      .forEach(({ job }) => {
        orderedItems.push({
          kind: 'compose',
          job,
          visualNumber: orderedItems.length + 1,
        })
      })
    if (index < slides.length) {
      orderedItems.push({
        kind: 'slide',
        slide: slides[index],
        visualNumber: orderedItems.length + 1,
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
    .filter(job => job.status === 'building')
    .sort((a, b) => a.target_visual_index - b.target_visual_index)

  for (const job of buildingJobs) {
    if (job.target_visual_index <= visualIndex) {
      visualIndex += 1
    }
  }

  return visualIndex
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
