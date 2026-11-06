// P3-4 slice B (Studio side): every long Studio request ends visibly. Flag NEXT_PUBLIC_STUDIO_JOB_DEADLINES (exact "true", default off;
// build-time). Off: no deadline is started anywhere and every request is the call it was before. On: the Studio-only requests that had
// no end state (PDF / PowerPoint export, narration) are aborted at their deadline and end in their own existing failure state (the
// model catalogue and duplicate deck constants are here for the follow-up that wires them); the action stays the user's to run again (never retried automatically). Director-owned jobs (slide compose / refine,
// deck build, chat directives) are DIRECTOR-2's job ledger (P3-4 slice C), not these.
// Import-free, so scripts/test-studio-job-deadlines.mjs runs it under plain node.

export const STUDIO_JOB_DEADLINES_ENABLED = process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES === 'true'

/** The model catalogue route waits 15 s for Director (app/api/models/catalogue/route.ts DIRECTOR_TIMEOUT_MS); + 5 s. */
export const MODEL_CATALOGUE_DEADLINE_MS = 20_000
/** The narration script / render routes run for at most 300 s (their Vercel maxDuration); + 15 s. */
export const NARRATION_LONG_DEADLINE_MS = 315_000
/** Reading or saving the narration voice (a router lookup, 10 s; a default-length function); 30 s. */
export const NARRATION_VOICE_DEADLINE_MS = 30_000
/** Every slide-scaled deadline stops here. */
export const JOB_DEADLINE_CAP_MS = 300_000

/** PDF / PPTX export: 30 s + 3 s per slide, capped at 5 min. Derived from the logged 42.7 s for a 42-slide PDF on UAT (about 1 s per
 * slide), with a 3x margin. Unknown slide count: the cap. */
export function exportDeadlineMs(slideCount: number | null | undefined): number {
  if (typeof slideCount !== 'number' || !Number.isFinite(slideCount) || slideCount < 1) return JOB_DEADLINE_CAP_MS
  return Math.min(30_000 + 3_000 * Math.ceil(slideCount), JOB_DEADLINE_CAP_MS)
}

/** Duplicate deck: 60 s + 1 s per slide, capped at 5 min. An estimate, unmeasured (Layout !244 is not live yet); revisit when it lands. */
export function duplicateDeadlineMs(slideCount: number | null | undefined): number {
  if (typeof slideCount !== 'number' || !Number.isFinite(slideCount) || slideCount < 1) return JOB_DEADLINE_CAP_MS
  return Math.min(60_000 + 1_000 * Math.ceil(slideCount), JOB_DEADLINE_CAP_MS)
}

export interface JobDeadline {
  /** Abort signal for the request (also aborted when the caller's own signal aborts). */
  signal: AbortSignal
  /** Stop the timer once the job has its answer (always call it). */
  clear(): void
  /** True when the deadline (not the caller) aborted the request. */
  timedOut(): boolean
}

/** Start a deadline. `parent` (optional) is the caller's own signal: aborting it aborts the request, but is not a timeout. */
export function startJobDeadline(ms: number, parent?: AbortSignal | null, deps: {
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
} = {}): JobDeadline {
  const setTimer = deps.setTimer ?? ((fn: () => void, wait: number) => setTimeout(fn, wait))
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const controller = new AbortController()
  let expired = false
  let cleared = false
  const onParentAbort = () => controller.abort()
  if (parent) {
    if (parent.aborted) controller.abort()
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }
  const timer = setTimer(() => { if (!cleared) { expired = true; controller.abort() } }, ms)
  return {
    signal: controller.signal,
    clear() {
      if (cleared) return
      cleared = true
      clearTimer(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
    timedOut: () => expired,
  }
}

/** The plain words for a job that ran past its deadline (the caller's own failure state shows them). */
export function jobDeadlineMessage(what: string, ms: number): string {
  const seconds = Math.round(ms / 1000)
  const length = seconds >= 120 ? `${Math.floor(seconds / 60)} minutes` : `${seconds} seconds` // rounded down, so the sentence stays true
  return `${what} took longer than ${length}, so Studio stopped waiting. Try again.`
}
