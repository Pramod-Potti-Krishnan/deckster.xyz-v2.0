// J2 v2: the page-side `submit` for the generate-first Add Slide pop-up (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED).
// Everything the page owns is injected, so a node test can drive it with fakes.
//
// Contract answers: streams/ops/evidence/J2-MAP/item8-wiring-20261009 (async-recovery b/c, insertion d, selections-hero a/e).
//   - async only: the backend forces assume_on_missing on an async job, so this path never asks questions;
//   - the accepted job is registered through the page's existing handleSlideComposerAccepted (placeholder, poller,
//     watchdog, completion), never a second queue;
//   - the wire insert_after_index is the REAL Layout anchor resolved at submit, not the popup's visual index;
//   - v2.0 asks no blocking questions: a needs_input reply is an error that says follow-ups come in v2.1.
import {
  buildSlideComposeVisualOrder,
  resolveSlideComposeVisualIndex,
  withAsyncSlideComposeFields,
  type SlideComposeVisualJob,
} from '@/lib/slide-compose-async'
import { FAST_ELEMENT_GENERATION_TIMEOUT_MS } from '@/lib/element-generation-timeout'
import {
  isAcceptedResponse,
  isNeedsInputResponse,
  responseErrorMessage,
  type SlideComposeAcceptedJob,
} from '@/components/slide-generation-panel/compose-helpers'
import {
  buildAddSlideV2ComposeBody,
  type AddSlideV2BlankTarget,
  type AddSlideV2Request,
  type AddSlideV2Settings,
  type AddSlideV2SubmitResult,
} from '@/lib/studio-add-slide-v2'

export const ADD_SLIDE_V2_COMPOSE_ENDPOINT = '/api/slides/compose'

export const ADD_SLIDE_V2_TIMEOUT_MESSAGE =
  "The slide composer didn't answer in time, so the slide may or may not have been queued. Check the slide list before trying again."
export const ADD_SLIDE_V2_LOST_REPLY_MESSAGE = "Couldn't confirm the slide was queued. Check the slide list before trying again."

export const ADD_SLIDE_V2_NEEDS_INPUT_MESSAGE =
  'This slide needs more detail than you gave. Follow-up questions are coming in v2.1. For now, add more detail to the box and try again.'

// The async route only has to store the job and answer 202, so the browser budget is the existing "fast" element
// generation one (lib/element-generation-timeout.ts), not the 300 s the route itself may run.
export const ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS = FAST_ELEMENT_GENERATION_TIMEOUT_MS

// A compose job that occupies a visual slot: pending or failed, never a refine overlay (the page's own rule).
const isComposePlaceholder = (job: SlideComposeVisualJob) => job.kind !== 'refine' && (job.status === 'building' || job.status === 'error')

export type AddSlideV2Anchor =
  | { ok: true; insertAfterIndex: number | null }
  | { ok: false; reason: 'placeholder-selected' | 'failed-placeholder-selected' | 'unresolved'; message: string }

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
    // Which placeholder is it? A failed one will not finish, so say that instead of "still being generated".
    const slides = Array.from({ length: Math.max(0, input.realSlideCount) }, (_, index) => index)
    const active = Object.values(input.jobs).filter(isComposePlaceholder)
    const selected = buildSlideComposeVisualOrder(slides, active).find(item => item.visualIndex === input.visualIndex)
    if (selected?.kind === 'compose' && selected.job.status === 'error') {
      return {
        ok: false,
        reason: 'failed-placeholder-selected',
        message: 'Select a finished slide to add after. The slide on screen failed to generate.',
      }
    }
    return {
      ok: false,
      reason: 'placeholder-selected',
      message: 'Select a finished slide to add after. The slide on screen is still being generated.',
    }
  }
  return { ok: false, reason: 'unresolved', message: "Couldn't tell which slide to add after. Select a slide and try again." }
}

// FastAPI answers `{ detail }` (a string, or a list of `{ msg }` for validation errors); responseErrorMessage ignores it.
// Only used when the reply carries none of the fields the Slide panel already reads, and capped so a dump never shows.
function composeErrorMessage(data: unknown): string {
  const body = (data && typeof data === 'object' ? data : {}) as { detail?: unknown; error?: unknown; errors?: unknown }
  const known = (Array.isArray(body.errors) && body.errors.length > 0) || typeof body.error === 'string'
  const detail = known ? null : detailText(body.detail)
  return detail ?? responseErrorMessage(data)
}

function detailText(detail: unknown): string | null {
  const items = Array.isArray(detail) ? detail : [detail]
  const parts = items
    .map(item => typeof item === 'string' ? item : item && typeof item === 'object' && typeof (item as { msg?: unknown }).msg === 'string' ? (item as { msg: string }).msg
      : item && typeof item === 'object' && typeof (item as { message?: unknown }).message === 'string' ? (item as { message: string }).message : '')
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const text = parts.join('; ')
  return text.length > 300 ? `${text.slice(0, 297)}...` : text
}

export interface AddSlideV2SubmitDeps {
  fetchImpl: (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
    ok: boolean
    json: () => Promise<unknown>
  }>
  /** Browser budget for the compose POST (default ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS); the tests shorten it. */
  timeoutMs?: number
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

  // The POST has a browser-side budget. Running out of it (or any lost reply) leaves the job's fate unknown,
  // so it is never retried blindly: a new job id would build a second slide.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, deps.timeoutMs ?? ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS)
  let response: Awaited<ReturnType<AddSlideV2SubmitDeps['fetchImpl']>>
  let data: unknown
  try {
    response = await deps.fetchImpl(ADD_SLIDE_V2_COMPOSE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asyncRequest),
      signal: controller.signal,
    })
    data = await response.json().catch(() => null)
  } catch {
    return FAIL(timedOut ? ADD_SLIDE_V2_TIMEOUT_MESSAGE : ADD_SLIDE_V2_LOST_REPLY_MESSAGE)
  } finally {
    clearTimeout(timer)
  }
  if (timedOut) return FAIL(ADD_SLIDE_V2_TIMEOUT_MESSAGE)
  if (!isCurrentSession()) {
    return FAIL('The builder session changed while the slide was being queued. Check the slide list.')
  }
  if (!response.ok) return FAIL(composeErrorMessage(data))
  if (isNeedsInputResponse(data)) {
    // Async jobs cannot suspend for questions (the backend forces assume_on_missing); v2.0 has no blocking questions.
    return FAIL(ADD_SLIDE_V2_NEEDS_INPUT_MESSAGE)
  }
  if (!isAcceptedResponse(data)) return FAIL(composeErrorMessage(data))
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

// The Blank slide goes through the existing native Add. That path inserts at the visual slide number, which is
// wrong whenever a pending or failed compose placeholder sits before the selection. With placeholders in play,
// resolve the real Layout position exactly like Generate does (flag on only); without any, keep the old
// default (undefined = the viewer's own position), so nothing changes for a deck with no placeholders.
export function resolveAddSlideV2BlankTarget(input: {
  presentationId: string | null
  visualIndex: number
  expectedVisualIndex: number
  realSlideCount: number
  jobs: Record<string, SlideComposeVisualJob>
}): AddSlideV2BlankTarget {
  const placeholders = Object.values(input.jobs).some(isComposePlaceholder)
  if (!input.presentationId || !placeholders) return { ok: true, position: undefined }
  if (input.visualIndex !== input.expectedVisualIndex) {
    return { ok: false, message: 'The selected slide changed. Check which slide the new one follows and try again.' }
  }
  const anchor = resolveAddSlideV2Anchor(input)
  if (!anchor.ok) return { ok: false, message: anchor.message }
  // position is the persisted 0-based insert position: right after the real anchor.
  return { ok: true, position: (anchor.insertAfterIndex ?? -1) + 1 }
}

/** The two page-side hooks for the pop-up, built from the page's own state (one call site in app/builder/page.tsx). */
export function createAddSlideV2Hooks(deps: AddSlideV2SubmitDeps & {
  /** features.slideComposerEnabled && features.slideComposerAsyncEnabled */
  generationEnabled: boolean
  presentationId: string | null
}): Pick<AddSlideV2Settings, 'submit' | 'resolveBlankTarget'> {
  return {
    submit: deps.generationEnabled ? request => submitAddSlideV2(request, deps) : undefined,
    resolveBlankTarget: expectedVisualIndex => resolveAddSlideV2BlankTarget({
      presentationId: deps.presentationId,
      expectedVisualIndex,
      ...deps.selection(),
    }),
  }
}
