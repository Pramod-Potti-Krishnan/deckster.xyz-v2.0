export type AsyncSlideComposeRequest<T extends Record<string, unknown>> = T & {
  job_id: string
  async: true
  assume_on_missing: true
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
  target_visual_index: number
  status: string
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
