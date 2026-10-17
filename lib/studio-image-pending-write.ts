/**
 * IMAGE-PENDING-WRITE (flag NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE, exact "true", default off). Studio half of Layout MR !240
 * (LAYOUT_IMAGE_GHOST_ONLY_WHEN_PENDING_ENABLED, contract v1 in streams/slide/RESULT-B3B-GHOST.md): the empty hero background shows its
 * "Generating image…" ghost only while a stored field says an image job is pending, and PROGRAM-1 ruled that whoever STARTS the job writes it.
 *
 * What Layout reads (src/utils/image-ghost-pending.js:33-45, !240 @ 61ab2c6): `image_status` (pending | queued | generating | running | in_progress) or the
 * legacy `image_pending` / `background_image_pending` booleans, on the slide's stored CONTENT (slides[i].content) or on the slide itself, for a hero
 * (H1s / H2 / H3) background slot. It reads nothing from the image element, so the field is written to the hero slide's content.
 *
 * What Studio writes. When the Add Element panel generates an IMAGE into a slot named "background" (clicking a hero's empty background selects that
 * placeholder, and the panel generates into it as a refine), the slide's stored content gets `image_status: "pending"` and `image_job_id` as the
 * request goes out, and the same job id gets "ready" (the image went in) or "failed" (anything else: an error, a timeout, a deck change) when it
 * ends. "ready" and "failed" are not pending for Layout, so the hero then shows its image, or its idle look.
 * Nothing is written for any other image job: a content image or a blank Add Element placeholder (a generated picture is a new element, the hero
 * background is untouched), and an Add Slide compose (its placeholder is a DOM-only section in the viewer; the slide does not exist in storage
 * until Slide Builder has built it, and Slide Builder writes build-time images itself).
 *
 * How it is persisted. Layout has no viewer command that stores a content field (updateSectionContent replaces a section's markup; autosave only
 * collects known fields), and PUT /slides/{index} drops unknown fields (400 "No fields to update"). The batch PUT /api/presentations/{id}/slides
 * (the call autosave itself makes) merges every key it does not recognise into the slide's content, positionally: so the body is an array of
 * empty objects up to the target slide, whose object holds the two fields. The slide is found by its stable slide_id at the end of the job, in
 * case slides moved meanwhile, and only a pending that carries OUR job id is cleared. Both writes wait for the viewer to report "saved" first
 * (the batch PUT is a whole-deck read-modify-write, like autosave's), but never longer than the settle budget.
 *
 * The job id is `studio-<epoch ms>-<nonce>`: it carries its start time, which is all a reader needs to expire a pending that never ended (a closed
 * tab). !240 does not read a time yet, so such a pending stays until the next job on that slide.
 *
 * Pure, no imports: the test loads this file on its own. Flag off: nothing in this file runs.
 */
export const STUDIO_IMAGE_PENDING_WRITE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true'

export type ImageJobStatus = 'pending' | 'ready' | 'failed'
export type ImageJobEnd = Exclude<ImageJobStatus, 'pending'>
export type ImagePendingWriteResult = 'written' | 'skipped' | 'not-ours' | 'failed'

/** The slot a hero's background image lives in (Layout's createImage, slotName === 'background'). */
export const HERO_BACKGROUND_SLOT_NAME = 'background'
/** The hero templates !240 gates (image-ghost-pending.js HERO_TEMPLATES). */
export const HERO_LAYOUTS: readonly string[] = ['H1s', 'H2', 'H3']
/** The contract's window for a pending that never ended (RESULT-B3B-GHOST.md); the reader enforces it, not this file. */
export const IMAGE_PENDING_WINDOW_MS = 10 * 60 * 1000
export const IMAGE_STATUS_FIELD = 'image_status'
export const IMAGE_JOB_ID_FIELD = 'image_job_id'
/** The batch PUT's `updated_by`, the label on the version it creates. */
export const IMAGE_PENDING_UPDATED_BY = 'studio-image-pending'
/** How long a write waits for the viewer's own pending save before going ahead anyway (autosave debounces 2.5 s, then saves). */
export const IMAGE_PENDING_SETTLE_MS = 8_000
/** A failed read or write is tried once more after this. */
export const IMAGE_PENDING_RETRY_DELAY_MS = 1_500

/** Only an IMAGE generated into a slot named "background" is a hero background job. */
export function imageJobWritesPending(job: { componentType?: unknown; slotName?: unknown } | null | undefined): boolean {
  return !!job && job.componentType === 'IMAGE' && job.slotName === HERO_BACKGROUND_SLOT_NAME
}

export function newImageJobId(nowMs: number, nonce: string): string {
  const stamp = Number.isFinite(nowMs) ? Math.max(0, Math.floor(nowMs)) : 0
  const clean = String(nonce ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || '0'
  return `studio-${stamp}-${clean}`
}

export function imageStatusFields(status: ImageJobStatus, jobId: string): Record<string, string> {
  return { [IMAGE_STATUS_FIELD]: status, [IMAGE_JOB_ID_FIELD]: jobId }
}

/**
 * The batch PUT body for one slide: the endpoint is positional, so every slide before the target is an empty object (the endpoint skips
 * a slide that has no keys), and nothing follows it. null for an index that is not a slide position.
 */
export function imageStatusBatch(slideIndex: number, fields: Record<string, unknown>): Array<Record<string, unknown>> | null {
  if (!Number.isInteger(slideIndex) || slideIndex < 0) return null
  return Array.from({ length: slideIndex + 1 }, (_, index) => (index === slideIndex ? { ...fields } : {}))
}

export interface LocatedHeroSlide {
  index: number
  slideId: string | null
  /** The job id stored in the slide's content, null when there is none. */
  storedJobId: string | null
}

/**
 * The hero slide a write belongs to, from the stored deck. With a slide_id (the end of a job) the slide is found by it wherever it now sits;
 * without one (the start) it is the slide at slideIndex. null when there is no such slide or it is not a hero: a position that drifted off the
 * hero must never get the field.
 */
export function locateHeroSlide(deck: unknown, slideIndex: number, slideId: string | null): LocatedHeroSlide | null {
  const slides = (deck as { slides?: unknown } | null | undefined)?.slides
  if (!Array.isArray(slides)) return null
  const index = slideId ? slides.findIndex(slide => (slide as { slide_id?: unknown } | null)?.slide_id === slideId) : slideIndex
  if (!Number.isInteger(index) || index < 0 || index >= slides.length) return null
  const slide = slides[index] as { slide_id?: unknown; layout?: unknown; content?: unknown } | null
  if (!slide || typeof slide !== 'object' || typeof slide.layout !== 'string' || !HERO_LAYOUTS.includes(slide.layout)) return null
  const content = slide.content && typeof slide.content === 'object' ? slide.content as Record<string, unknown> : null
  const storedJobId = content && typeof content[IMAGE_JOB_ID_FIELD] === 'string' ? content[IMAGE_JOB_ID_FIELD] as string : null
  return { index, slideId: typeof slide.slide_id === 'string' && slide.slide_id ? slide.slide_id : null, storedJobId }
}

// ---------------------------------------------------------------- the writer

export interface ImagePendingResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export interface ImagePendingDeps {
  /** Layout service base URL, no trailing path. */
  baseUrl: string
  fetchImpl(url: string, init: { method?: string; headers?: Record<string, string>; body?: string; cache?: 'no-store' }): Promise<ImagePendingResponse>
  now(): number
  nonce(): string
  /** Resolves when the viewer has nothing unsaved, or when the settle budget runs out. Never rejects. */
  settleViewer(): Promise<void>
  sleep(ms: number): Promise<void>
  warn(message: string, detail?: unknown): void
}

export interface ImagePendingJob {
  readonly jobId: string
  /** The pending write. Never rejects. */
  readonly started: Promise<ImagePendingWriteResult>
  /** The ready / failed write. Once per job (a second call returns the first answer). Never rejects, and runs after `started` has finished. */
  end(outcome: ImageJobEnd): Promise<ImagePendingWriteResult>
}

/**
 * Starts one hero-background image job's stored pending state and returns at once: the write runs in the background and `end` is ordered
 * behind it. Nothing here throws into the generation.
 */
export function startImageJobPending(deps: ImagePendingDeps, target: { presentationId: string; slideIndex: number }): ImagePendingJob {
  const jobId = newImageJobId(deps.now(), deps.nonce())
  const deckUrl = `${deps.baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(target.presentationId)}`
  let slideId: string | null = null
  let mayBeStored = false

  const readDeck = async (): Promise<unknown> => {
    const response = await deps.fetchImpl(deckUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Layout answered ${response.status} to the deck read`)
    return response.json()
  }
  const putFields = async (index: number, fields: Record<string, unknown>, summary: string): Promise<void> => {
    const batch = imageStatusBatch(index, fields)
    if (!batch) throw new Error(`Not a slide position: ${index}`)
    const response = await deps.fetchImpl(`${deckUrl}/slides`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides: batch, updated_by: IMAGE_PENDING_UPDATED_BY, change_summary: summary }),
    })
    if (!response.ok) throw new Error(`Layout answered ${response.status} to the slide write`)
  }
  // One read-locate-write pass, tried twice: the second pass re-reads, so it never writes from a stale deck.
  const twice = async (pass: () => Promise<ImagePendingWriteResult>): Promise<ImagePendingWriteResult> => {
    try { return await pass() } catch (first) {
      deps.warn('[ImagePending] write failed, trying once more', first)
      await deps.sleep(IMAGE_PENDING_RETRY_DELAY_MS)
      return pass()
    }
  }

  const started: Promise<ImagePendingWriteResult> = (async () => {
    try {
      await deps.settleViewer()
      return await twice(async () => {
        const located = locateHeroSlide(await readDeck(), target.slideIndex, null)
        if (!located) return 'skipped'
        slideId = located.slideId
        mayBeStored = true
        await putFields(located.index, imageStatusFields('pending', jobId), 'Image job pending (Studio)')
        return 'written'
      })
    } catch (error) {
      deps.warn('[ImagePending] could not store the pending state', error)
      return 'failed'
    }
  })()

  let ended: Promise<ImagePendingWriteResult> | null = null
  return {
    jobId,
    started,
    end(outcome) {
      ended ??= (async () => {
        const start = await started
        // A start that never reached the write has nothing to clear; one that may have (a lost answer) is checked against the stored job id.
        if (start !== 'written' && !mayBeStored) return 'skipped'
        try {
          await deps.settleViewer()
          return await twice(async () => {
            const located = locateHeroSlide(await readDeck(), target.slideIndex, slideId)
            if (!located) return 'skipped'
            // Only our own pending is cleared: a newer job (another tab, Slide Builder) owns the field now.
            if (located.storedJobId !== jobId) return 'not-ours'
            await putFields(located.index, imageStatusFields(outcome, jobId), outcome === 'ready' ? 'Image job ready (Studio)' : 'Image job failed (Studio)')
            return 'written'
          })
        } catch (error) {
          deps.warn('[ImagePending] could not clear the pending state', error)
          return 'failed'
        }
      })()
      return ended
    },
  }
}
