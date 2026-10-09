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
  type SlideComposeAcceptedResult,
} from '@/components/slide-generation-panel/compose-helpers'
import {
  addSlideV2KindFromCanvas,
  buildAddSlideV2ComposeBody,
  buildAddSlideV2RefineBody,
  rememberAddSlideV2DeckContext,
  rememberAddSlideV2Follow,
  type AddSlideV2BlankTarget,
  type AddSlideV2ContextSlide,
  type AddSlideV2GeneratedStore,
  type AddSlideV2RegenerateJobStatus,
  type AddSlideV2RegenerateRequest,
  type AddSlideV2RegenerateSettings,
  type AddSlideV2RegenerateSubmitResult,
  type AddSlideV2RegenerateTarget,
  type AddSlideV2Request,
  type AddSlideV2Settings,
  type AddSlideV2SlideRow,
  type AddSlideV2SubmitResult,
} from '@/lib/studio-add-slide-v2'

export const ADD_SLIDE_V2_COMPOSE_ENDPOINT = '/api/slides/compose'
// Regenerate goes through the Slide panel's own Refine route (Director refine-one), never a new endpoint.
export const ADD_SLIDE_V2_REFINE_ENDPOINT = '/api/slides/refine'

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
  /**
   * The page's handleSlideComposerAccepted. It returns nothing, so admission is tested before the call. `meta` is
   * the visual slide the user was on when they pressed Generate (DEC-P9: the viewer follows the new slide from there).
   */
  onAccepted: (job: SlideComposeAcceptedJob, meta: { submitVisualIndex: number }) => void
}

const FAIL = (message: string): { ok: false; message: string } => ({ ok: false, message })

type PostedSlideJob =
  | { ok: true; data: SlideComposeAcceptedResult; asyncRequest: Record<string, unknown> }
  | { ok: false; message: string }

// The POST and every check on its reply, shared by Generate (compose) and Regenerate (refine). Nothing else differs:
// both are async jobs, both are accepted by the page's own handleSlideComposerAccepted afterwards.
async function postAsyncSlideJob(
  endpoint: string,
  body: { session_id: string; presentation_id: string | null; instruction: string },
  deps: AddSlideV2SubmitDeps,
  isCurrentSession: () => boolean,
): Promise<PostedSlideJob> {
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
    response = await deps.fetchImpl(endpoint, {
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

  return { ok: true, data, asyncRequest }
}

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

  const posted = await postAsyncSlideJob(ADD_SLIDE_V2_COMPOSE_ENDPOINT, body, deps, isCurrentSession)
  if (!posted.ok) return posted
  const { data, asyncRequest } = posted
  deps.onAccepted({
    ...data,
    kind: data.kind ?? 'compose',
    target_slide_id: data.target_slide_id,
    title: body.instruction.slice(0, 72) || 'Composing slide',
    request: asyncRequest,
  }, { submitVisualIndex: selection.visualIndex })
  return { ok: true }
}

// ---- Regenerate (J2V2-REGENERATE) ------------------------------------------------------------------------------------
// Same async job as Generate, addressed to the existing Refine route. The page's handleSlideComposerAccepted then
// marks the old slide with its refine overlay (the original stays on screen, untouched) and, on slide_ready, swaps the
// new slide in at the same index. A failed job leaves the original in place and the page keeps the error.
// The same page-owned dependencies as Generate: the refine job is registered through the same handleSlideComposerAccepted.
export type AddSlideV2RegenerateSubmitDeps = AddSlideV2SubmitDeps

type RegenerateJob = SlideComposeVisualJob & { target_slide_id?: string | null }

// A refine job that is still running on this slide (a refine overlays the target, it is not a visual placeholder).
function isRegenerating(jobs: Record<string, SlideComposeVisualJob>, slideId: string, layoutIndex: number): boolean {
  return Object.values(jobs as Record<string, RegenerateJob>).some(job => {
    if (job.kind !== 'refine' || job.status !== 'building') return false
    if (job.target_slide_id) return job.target_slide_id === slideId
    return job.target_layout_index === layoutIndex || job.targetLayoutIndex === layoutIndex || job.targetIndex === layoutIndex
  })
}

export async function submitAddSlideV2Regenerate<TTheme>(
  request: AddSlideV2RegenerateRequest<TTheme>,
  deps: AddSlideV2RegenerateSubmitDeps,
): Promise<AddSlideV2RegenerateSubmitResult> {
  // The target is fixed before the first await and checked again against the page's state right now.
  const isCurrentSession = deps.captureSessionOwner()
  const selection = deps.selection()
  if (!request.presentationId) return FAIL('No active presentation is available to regenerate.')
  if (selection.visualIndex !== request.visualIndex) {
    return FAIL('The selected slide changed. Select the slide you want to regenerate and try again.')
  }
  const resolved = resolveSlideComposeVisualIndex(selection.visualIndex, { slideCount: selection.realSlideCount, jobs: selection.jobs })
  if (resolved?.kind !== 'slide') {
    return FAIL('Select a finished slide to regenerate. The slide on screen is still being generated or failed to generate.')
  }
  // The real index the user saw is the one the slide still has; if not, the deck moved under the panel.
  if (resolved.layoutIndex !== request.target.layoutIndex) {
    return FAIL('The deck changed while the panel was open. Select the slide again and try again.')
  }
  if (isRegenerating(selection.jobs, request.target.slideId, resolved.layoutIndex)) {
    return FAIL('This slide is already being regenerated.')
  }
  const body = buildAddSlideV2RefineBody(request, resolved.layoutIndex)
  if (!body) return FAIL("This slide can't be regenerated yet.")

  const posted = await postAsyncSlideJob(ADD_SLIDE_V2_REFINE_ENDPOINT, body, deps, isCurrentSession)
  if (!posted.ok) return posted
  const { data, asyncRequest } = posted
  // The refine route answers kind "refine"; anything else is not the job we asked for.
  if (data.kind && data.kind !== 'refine') {
    return FAIL('Unexpected reply from the slide composer. Check the slide list before trying again.')
  }
  deps.onAccepted({
    ...data,
    kind: 'refine',
    target_slide_id: data.target_slide_id ?? request.target.slideId,
    title: body.instruction.slice(0, 72) || 'Regenerating slide',
    request: asyncRequest,
  }, { submitVisualIndex: selection.visualIndex })
  return { ok: true, jobId: data.job_id }
}

/**
 * The slide on screen as a regenerate target, or null. The page's store says which slides this session generated (kind
 * and original instruction), and which slides the deck build generated (the Director's slide context, remembered by
 * slide id while the deck still matched it: see rememberAddSlideV2DeckContext). A slide with no stable id, a pending or
 * failed placeholder, or one the frontend cannot tell was generated (a manual layout) is not a target.
 */
export function resolveAddSlideV2RegenerateTarget(input: {
  visualIndex: number
  slides: ReadonlyArray<AddSlideV2SlideRow>
  jobs: Record<string, SlideComposeVisualJob>
  store: AddSlideV2GeneratedStore
}): AddSlideV2RegenerateTarget | null {
  if (input.slides.length === 0) return null
  const resolved = resolveSlideComposeVisualIndex(input.visualIndex, { slideCount: input.slides.length, jobs: input.jobs })
  if (resolved?.kind !== 'slide') return null
  const row = input.slides[resolved.layoutIndex]
  const slideId = row?.slideId?.trim()
  if (!row || !slideId) return null

  const base = {
    slideId,
    layoutIndex: resolved.layoutIndex,
    slideNumber: input.visualIndex + 1,
    title: row.title,
    busy: isRegenerating(input.jobs, slideId, resolved.layoutIndex),
  }
  const generated = input.store.slides.get(slideId)
  if (generated) return { ...base, kind: generated.kind, instruction: generated.instruction, source: 'compose' }
  const entry = input.store.context.get(slideId)
  if (!entry) return null
  return {
    ...base,
    kind: addSlideV2KindFromCanvas(entry.canvas_type),
    instruction: typeof entry.key_message === 'string' ? entry.key_message.trim() : '',
    source: 'context',
  }
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
  /** The page's job -> visual slide map for DEC-P9 (the viewer follows the new slide). Absent = nothing is remembered. */
  follow?: Map<string, number>
}): Pick<AddSlideV2Settings, 'submit' | 'resolveBlankTarget'> {
  const submitDeps: AddSlideV2SubmitDeps = {
    ...deps,
    onAccepted: (job, meta) => {
      if (deps.follow) rememberAddSlideV2Follow(deps.follow, job.job_id, meta.submitVisualIndex)
      deps.onAccepted(job, meta)
    },
  }
  return {
    submit: deps.generationEnabled ? request => submitAddSlideV2(request, submitDeps) : undefined,
    resolveBlankTarget: expectedVisualIndex => resolveAddSlideV2BlankTarget({
      presentationId: deps.presentationId,
      expectedVisualIndex,
      ...deps.selection(),
    }),
  }
}

/** The page-side hooks for Regenerate, built from the page's own state (one call site in app/builder/page.tsx). */
export function createAddSlideV2RegenerateHooks<TTheme>(deps: AddSlideV2RegenerateSubmitDeps & {
  /** features.slideRefinerEnabled && features.slideComposerEnabled && features.slideComposerAsyncEnabled */
  regenerateEnabled: boolean
  store: AddSlideV2GeneratedStore
  /** The Director's slide context, keyed by build position (null when none has arrived). */
  contextByIndex: () => Record<number, AddSlideV2ContextSlide> | null
  /** The page's job map entry for a job: still building, or failed with its errors; undefined once it finished. */
  jobState: (jobId: string) => { status: string; errors?: string[] } | undefined
}): AddSlideV2RegenerateSettings<TTheme> {
  return {
    resolveTarget: (visualIndex, slides) => {
      // Remember the deck as built the first time it lines up with the Director's context (idempotent), then resolve.
      rememberAddSlideV2DeckContext(deps.store, slides, deps.contextByIndex())
      return resolveAddSlideV2RegenerateTarget({ visualIndex, slides, jobs: deps.selection().jobs, store: deps.store })
    },
    submit: deps.regenerateEnabled ? request => submitAddSlideV2Regenerate(request, deps) : undefined,
    // While the page still tracks the job the original is still the slide on screen (its swap is not done), so it is
    // "building"; once the job leaves the map the page's records say how it ended.
    jobStatus: (jobId): AddSlideV2RegenerateJobStatus | null => {
      const job = deps.jobState(jobId)
      if (job?.status === 'error') {
        return { status: 'failed', message: job.errors?.filter(Boolean).join('; ') || 'The slide could not be regenerated.' }
      }
      if (job) return { status: 'building' }
      const newSlideId = deps.store.completed.get(jobId)
      if (newSlideId) return { status: 'ready', newSlideId }
      const failure = deps.store.failed.get(jobId)
      return failure ? { status: 'failed', message: failure } : null
    },
  }
}
