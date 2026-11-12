// PASS2B J2-04 (audit row in streams/ops/PASS2B/AUDIT-CHAT.md): what became of the slide the Add Slide panel just queued.
// Flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS (build-time, exact "true", default off).
//
// After Generate the panel stays open, and with panel focus on the slide rail is collapsed, so the rail's "Building slide…" card and its
// retry are out of sight and "Queued. It appears right after slide 2 when it is ready." stays up until the user changes slide or types. With
// the flag on the panel adds ONE status line under it, derived from the page's own compose-job records (the same ones the rail draws):
//
//   Building…                                   the job is in the page's map with status "building"
//   Added as slide 3 · Go to slide              the job it was watching left the map without failing (the page removes a job when the
//                                               slide landed: slide_ready live swap, or the refresh confirmation)
//   Couldn't build it · Try again               the job is in the map with status "error" (slide_failed, the recovery poll, the failsafe)
//
// Nothing here talks to a backend and no frame type is new. "Go to slide" is the viewer's go-to the rail's thumbnails use, and "Try again" is
// the rail card's own retry (handleRetrySlideCompose, which replaces the failed job by a new one under a new job id; the new job keeps the
// failed one's slot, so the line follows it). This module is pure; the page supplies the two actions and its current job records.

export const STUDIO_ADD_SLIDE_STATUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS === 'true'

export const ADD_SLIDE_STATUS_COPY = {
  building: 'Building…',
  added: (slideNumber: number) => `Added as slide ${slideNumber}`,
  goTo: 'Go to slide',
  failed: "Couldn't build it",
  retry: 'Try again',
} as const

/** The fields of the page's SlideComposeJobState this module reads. */
export interface AddSlideStatusJob {
  job_id: string
  kind?: string
  status: string
  title?: string
  errors?: string[]
  /** 0-based position the slide lands at (placeholders count): the number the "Slide queued" toast already announced, plus one. */
  target_visual_index: number
  target_presentation_id?: string | null
}

/** A job's place in the deck. A retry replaces the failed job by a new one that keeps all three, so the status line can follow it. */
export interface AddSlideStatusSlot {
  presentationId: string | null
  visualIndex: number
  title: string
}

export type AddSlideStatus =
  | { kind: 'building'; jobId: string; slot: AddSlideStatusSlot }
  | { kind: 'failed'; jobId: string; slot: AddSlideStatusSlot; message: string }
  | { kind: 'added'; slideNumber: number }

const slotOf = (job: AddSlideStatusJob): AddSlideStatusSlot => ({
  presentationId: job.target_presentation_id ?? null,
  visualIndex: job.target_visual_index,
  title: job.title ?? '',
})

const sameSlot = (job: AddSlideStatusJob, slot: AddSlideStatusSlot) =>
  (job.target_presentation_id ?? null) === slot.presentationId
  && job.target_visual_index === slot.visualIndex
  && (job.title ?? '') === slot.title

const isComposeJob = (job: AddSlideStatusJob) => (job.kind ?? 'compose') === 'compose'

/**
 * The status line for one job the panel queued, from the page's job records as they are right now. `previous` is what this function
 * returned last time for the same job (null at first): without it "the job is gone" could not be told from "never seen".
 * Returns `previous` itself when nothing changed, so the caller can compare by identity.
 */
export function resolveAddSlideStatus(input: {
  jobs: Readonly<Record<string, AddSlideStatusJob>>
  jobId: string
  previous: AddSlideStatus | null
}): AddSlideStatus | null {
  const { jobs, jobId, previous } = input
  if (previous?.kind === 'added') return previous

  // The job under its own id (or, after a retry, under the id the retry gave it). Only a FAILED job can have been replaced (by a retry), so
  // only then is the job that took its slot the same slide.
  const watched = previous ? previous.jobId : jobId
  let job: AddSlideStatusJob | undefined = jobs[watched]
  if (!job && previous?.kind === 'failed') {
    const slot = previous.slot
    job = Object.values(jobs).find(item => isComposeJob(item) && item.job_id !== watched && sameSlot(item, slot))
  }
  if (job && !isComposeJob(job)) job = undefined

  if (job) {
    const slot = slotOf(job)
    if (job.status === 'error') {
      const message = (job.errors ?? []).filter(Boolean).join('; ')
      if (previous?.kind === 'failed' && previous.jobId === job.job_id && previous.message === message) return previous
      return { kind: 'failed', jobId: job.job_id, slot, message }
    }
    if (previous?.kind === 'building' && previous.jobId === job.job_id) return previous
    return { kind: 'building', jobId: job.job_id, slot }
  }

  // Gone from the map. After "building" that is the page removing a finished job. After "failed" it is a Dismiss on the rail card: say nothing.
  if (previous?.kind === 'building') return { kind: 'added', slideNumber: previous.slot.visualIndex + 1 }
  return null
}

/** What the page hands the Add Slide panel (settings.status). The panel never sees a job record or a viewer. */
export interface AddSlideV2StatusSettings {
  /** The next status for the job the panel queued (see resolveAddSlideStatus). */
  read: (jobId: string, previous: AddSlideStatus | null) => AddSlideStatus | null
  /** Select this slide (0-based, placeholders count) through the viewer's go-to, the one a rail thumbnail uses. */
  goToSlide: (visualIndex: number) => void
  /** The rail card's retry for a failed job. */
  retry: (jobId: string) => void
}

export function createAddSlideV2StatusSettings(deps: {
  /** The page's compose jobs as of this render (state, not a ref: a ref is only synced after the render commits). */
  jobs: Readonly<Record<string, AddSlideStatusJob>>
  goToSlide: (visualIndex: number) => void
  retry: (jobId: string) => void
}): AddSlideV2StatusSettings {
  return {
    read: (jobId, previous) => resolveAddSlideStatus({ jobs: deps.jobs, jobId, previous }),
    goToSlide: deps.goToSlide,
    retry: deps.retry,
  }
}
