// J2 v2: the page-side `submit` for the generate-first Add Slide pop-up (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED).
// Everything the page owns is injected, so a node test can drive it with fakes.
//
// Contract answers: streams/ops/evidence/J2-MAP/item8-wiring-20261009 (async-recovery b/c, insertion d, selections-hero a/e).
//   - async only: the backend forces assume_on_missing on an async job, so this path never asks questions;
//   - the accepted job is registered through the page's existing handleSlideComposerAccepted (placeholder, poller,
//     watchdog, completion), never a second queue;
//   - the wire insert_after_index is the REAL Layout anchor resolved at submit, not the popup's visual index.
import { resolveSlideComposeVisualIndex, withAsyncSlideComposeFields, type SlideComposeVisualJob } from '@/lib/slide-compose-async'
import {
  isAcceptedResponse,
  isNeedsInputResponse,
  responseErrorMessage,
  type SlideComposeAcceptedJob,
} from '@/components/slide-generation-panel/compose-helpers'
import {
  buildAddSlideV2ComposeBody,
  type AddSlideV2Request,
  type AddSlideV2SubmitResult,
} from '@/lib/studio-add-slide-v2'

export const ADD_SLIDE_V2_COMPOSE_ENDPOINT = '/api/slides/compose'

export type AddSlideV2Anchor =
  | { ok: true; insertAfterIndex: number | null }
  | { ok: false; reason: 'placeholder-selected' | 'unresolved'; message: string }

// (d) The selected visual item must be a finished slide. A pending or failed compose placeholder has no real
// anchor, and the page's retained `selectedLayoutSlideIndex` is NOT a substitute (J2-MAP: block, do not guess).
export function resolveAddSlideV2Anchor(input: {
  presentationId: string | null
  visualIndex: number
  realSlideCount: number
  jobs: Record<string, SlideComposeVisualJob>
}): AddSlideV2Anchor {
  if (!input.presentationId) return { ok: true, insertAfterIndex: null }
  const resolved = resolveSlideComposeVisualIndex(input.visualIndex, { slideCount: input.realSlideCount, jobs: input.jobs })
  if (resolved?.kind === 'slide') return { ok: true, insertAfterIndex: resolved.layoutIndex }
  if (resolved?.kind === 'compose') {
    return {
      ok: false,
      reason: 'placeholder-selected',
      message: 'Select a finished slide to add after. The slide on screen is still being generated.',
    }
  }
  return { ok: false, reason: 'unresolved', message: "Couldn't tell which slide to add after. Select a slide and try again." }
}

export interface AddSlideV2SubmitDeps {
  fetchImpl: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
    ok: boolean
    json: () => Promise<unknown>
  }>
  newJobId: () => string
  /** The page's captureStudioSlideComposeSessionOwner: call BEFORE the first await, returns "still current". */
  captureSessionOwner: () => () => boolean
  /** The page's own admission test (same predicate handleSlideComposerAccepted applies before it registers a job). */
  isSessionAdmitted: (sessionId: string) => boolean
  /** The page's selection at submit time: visual index (placeholders count), real slide count, tracked compose jobs. */
  selection: () => { visualIndex: number; realSlideCount: number; jobs: Record<string, SlideComposeVisualJob> }
  /** The page's handleSlideComposerAccepted. It returns nothing, so admission is tested before the call. */
  onAccepted: (job: SlideComposeAcceptedJob) => void
}

const FAIL = (message: string): AddSlideV2SubmitResult => ({ ok: false, message })

export async function submitAddSlideV2<TTheme>(
  request: AddSlideV2Request<TTheme>,
  deps: AddSlideV2SubmitDeps,
): Promise<AddSlideV2SubmitResult> {
  // Everything that fixes the target is captured before the first await and kept through the response.
  const isCurrentSession = deps.captureSessionOwner()
  const selection = deps.selection()
  if (request.presentationId && selection.visualIndex !== request.anchorVisualIndex) {
    return FAIL('The selected slide changed. Check which slide the new one follows and try again.')
  }
  const anchor = resolveAddSlideV2Anchor({
    presentationId: request.presentationId,
    visualIndex: selection.visualIndex,
    realSlideCount: selection.realSlideCount,
    jobs: selection.jobs,
  })
  if (!anchor.ok) return FAIL(anchor.message)
  const body = buildAddSlideV2ComposeBody(request, anchor.insertAfterIndex)
  if (!body) return FAIL("This slide can't be generated yet.")

  const jobId = deps.newJobId()
  const asyncRequest = withAsyncSlideComposeFields(body as unknown as Record<string, unknown>, jobId)

  let response: Awaited<ReturnType<AddSlideV2SubmitDeps['fetchImpl']>>
  try {
    response = await deps.fetchImpl(ADD_SLIDE_V2_COMPOSE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asyncRequest),
    })
  } catch {
    // No reply: the job may exist. Never retry blindly (a new job id would build a second slide).
    return FAIL("Couldn't confirm the slide was queued. Check the slide list before trying again.")
  }
  const data: unknown = await response.json().catch(() => null)

  if (!isCurrentSession()) {
    return FAIL('The builder session changed while the slide was being queued. Check the slide list.')
  }
  if (!response.ok) return FAIL(responseErrorMessage(data))
  if (isNeedsInputResponse(data)) {
    // Async jobs cannot suspend for questions (the backend forces assume_on_missing); synchronous clarification is not wired.
    return FAIL('The slide composer needs more information than this pop-up can collect yet.')
  }
  if (!isAcceptedResponse(data)) return FAIL(responseErrorMessage(data))
  if (data.job_id !== jobId || data.session_id !== body.session_id
    || (body.presentation_id && data.presentation_id && data.presentation_id !== body.presentation_id)) {
    return FAIL('Unexpected reply from the slide composer. Check the slide list before trying again.')
  }
  if (!deps.isSessionAdmitted(body.session_id)) {
    return FAIL('The builder session changed while the slide was being queued. Check the slide list.')
  }

  deps.onAccepted({
    ...data,
    kind: data.kind ?? 'compose',
    target_slide_id: data.target_slide_id,
    title: body.instruction.slice(0, 72) || 'Composing slide',
    request: asyncRequest,
  })
  return { ok: true }
}
