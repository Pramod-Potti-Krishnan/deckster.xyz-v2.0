"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  REPLACE_PICTURE_CATALOG_COMMAND,
  REPLACE_PICTURE_COMMAND,
  REPLACE_PICTURE_ORDER_COMMAND,
  createProgressTracker,
  failureOutcome,
  isReadOnlyPictureCode,
  readCurrentSlide,
  readSlideEligibility,
  refineBuildingOnSlide,
  replacePictureDisabledReason,
  runReplacePicture,
  unavailableOutcome,
  urlIsViewOnly,
  type CurrentSlide,
  type PictureTarget,
  type ReplacePictureOutcome,
  type ReplacePictureStage,
  type SlideEligibility,
} from '@/lib/studio-replace-picture'
import { STUDIO_REPLACE_PICTURE_HERO_ONLY, heroOnlyReasonFor } from '@/lib/studio-replace-picture-hero-only' // REPLACE-PICTURE-HERO-ONLY

/** The viewer bridge the page's viewer already has (components/presentation-viewer.tsx sendCommand): one command to one iframe, resolving with the reply and rejecting with the failure. */
type ViewerSend = (iframe: HTMLIFrameElement | null, action: string, params?: Record<string, any>, options?: { timeoutMs?: number }) => Promise<any>

/** The handle the viewer's slide-mutation scaffolding gives (beginStudioNativeSlideMutation): the frame this change belongs to, and the release of the busy state it raised. */
export interface ReplacePictureMutation {
  iframe: HTMLIFrameElement | null
  isCurrent: () => boolean
  release: () => void
}

export interface UseStudioReplacePictureInput {
  /** The flag and the Studio shell. Off: nothing is read, nothing is sent, nothing is drawn. */
  enabled: boolean
  deckOpen: boolean
  viewerReady: boolean
  presenting: boolean
  presentationId: string | null
  /** The viewer's frame URL (a view-only frame is read-only) and which version of the deck is on screen (the outline preview is not the built deck). */
  frameUrl: string | null
  activeVersion?: 'blank' | 'strawman' | 'final'
  /** 1-based slide number on screen, and its id when the rail knows it. */
  currentSlide: number
  railSlideId: string | null
  railSlideTitle: string | null
  tabPausedHint?: string
  templateMode: boolean
  /** The generation overlay, or a build filling the deck. */
  building: boolean
  /** The page's own "something is running" rule (the one the Format button uses). */
  studioBusy: boolean
  composeJobs: ReadonlyArray<{ kind?: string; status?: string; targetSlideId?: string | null; targetIndex?: number; targetLayoutIndex?: number }>
  mutationPending: boolean
  send: ViewerSend
  getIframe: () => HTMLIFrameElement | null
  /** The viewer's own origin and window check for a message (the one the bridge applies to every reply). */
  isTrustedReply: (event: MessageEvent, iframe: HTMLIFrameElement | null) => boolean
  begin: (operation: string) => ReplacePictureMutation | null
  /** After a stored picture: the rail's previews and the other tabs are told. */
  afterReplace: () => void
  onReloadDeck?: () => void
}

export interface StudioReplacePictureView {
  /** The button is drawn (the flag, the shell, a built deck, not presenting). */
  visible: boolean
  /** Why it is greyed, in plain words; null when it can be used. */
  reason: string | null
  slideNumber: number
  slideTitle: string | null
  /** Where Layout says the picture would go on the slide on screen (null when it did not say). */
  target: PictureTarget | null
  /** Layout's id for the slide on screen, as the viewer's own order read it (null when it did not say): the dialog binds to it when it opens. */
  slideId: string | null
  /**
   * `target.slideNumber` is the viewer's visual slide number the dialog was opened on; `target.slideId` the id the hook reported then (`slideId` above), or none. `onProgress` hears each stage of the run (saving, writing, repainting) as the viewer enters it.
   */
  replace: (target: { slideNumber: number; slideId?: string | null }, form: { url: string; alt: string }, options?: { onProgress?: (stage: ReplacePictureStage) => void }) => Promise<ReplacePictureOutcome>
  reloadDeck?: () => void
}

/**
 * Replace picture (REPLACE-PICTURE, NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): what the viewer needs to offer the action on the slide on screen.
 * Off (`enabled` false) it reads nothing and sends nothing and says `visible: false`. On, it reads what Layout says about the slide once per slide (the viewer's getTemplateSlotCatalog, the read the Add Element panel
 * already makes, which since Layout !296 also reports which slides can take a picture) and which slide is on screen (composeGetState: the entry whose visual_index is the viewer's current one, with its layout_index and slide_id; an Add Slide
 * placeholder on screen has none, and the button is greyed), works out whether the action is available (lib/studio-replace-picture.ts, the reasons in plain words), and sends the one command when the person confirms: first the same composeGetState read
 * again, so nothing goes out when the viewer moved or the slide under the dialog's visual position is not the one it was opened for (SLIDE_CHANGED), then setSlideBackgroundPicture with THAT slide's layout_index and slide_id and the 20 s budget, inside the viewer's own
 * slide-mutation scaffolding (other slide changes wait, the frame is checked before and after). The visual slide number is never sent as the stored index (placeholders shift it), and the slide_id sent is the VIEWER's: the rail's ids come from Director's
 * outline and are not Layout's, so they are used only to match a refine job to its slide, never sent.
 */
export function useStudioReplacePicture(input: UseStudioReplacePictureInput): StudioReplacePictureView {
  const slideIndex = input.currentSlide - 1 // the viewer's VISUAL position: placeholders count. It is the argument of the catalog read, never the stored slide_index.
  const key = `${input.presentationId ?? ''}\u0000${input.currentSlide}`
  const [slideRead, setSlideRead] = useState<{ key: string; slide: CurrentSlide; eligibility: SlideEligibility } | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const latest = useRef(input)
  latest.current = input
  const busy = input.building || input.studioBusy || input.mutationPending || input.templateMode
  const live = input.enabled && input.deckOpen && input.viewerReady && !input.presenting
  // A job that starts or ends changes the deck inside the viewer (a placeholder is added, becomes a slide, or turns into an error card), so the read is made again.
  const jobsKey = input.composeJobs.map(job => `${job.kind ?? ''}:${job.status ?? ''}`).join(',')

  // What Layout says about the slide on screen: read once per slide, again when the frame, the build, a slide change, a compose job or this hook's own change settles (a stored picture, a refusal: the report is the deck as it is now).
  // Two reads go out together: the viewer's order (which real slide is on screen, or that a placeholder is) and the slot catalog (which slides can take a picture, by stored index). A read that fails says "unknown":
  // the action stays on, and Replace reads the order again before it sends anything.
  useEffect(() => {
    if (!live || busy) return
    let cancelled = false
    void Promise.all([
      Promise.resolve().then(() => latest.current.send(latest.current.getIframe(), REPLACE_PICTURE_ORDER_COMMAND, {}, { timeoutMs: 5000 })).then(readCurrentSlide).catch((): CurrentSlide => ({ state: 'unknown' })),
      Promise.resolve().then(() => latest.current.send(latest.current.getIframe(), REPLACE_PICTURE_CATALOG_COMMAND, { slideIndex }, { timeoutMs: 8000 })).catch((): unknown => null),
    ]).then(([order, catalog]) => {
      // A read of a slide other than the one Studio shows (the viewer moved on while the reads were in flight) says nothing about this one: unknown, and the next slide change reads again.
      const moved = order.state !== 'unknown' && order.visualIndex !== slideIndex
      const slide: CurrentSlide = moved ? { state: 'unknown' } : order
      // the report lists the stored slides: this slide's entry is the one at its layout_index, not at its visual position
      const eligibility: SlideEligibility = moved ? { state: 'unknown' } : readSlideEligibility(catalog, slide.state === 'slide' ? slide.layoutIndex : -1)
      if (!cancelled) setSlideRead({ key, slide, eligibility })
    })
    return () => { cancelled = true }
  }, [live, busy, key, slideIndex, jobsKey])

  const read = slideRead && slideRead.key === key ? slideRead : null
  const slide: CurrentSlide = read ? read.slide : { state: 'unknown' }
  const eligibility: SlideEligibility = read ? read.eligibility : { state: 'loading' }
  // A deck Layout refused as read-only (a view-only page, a published copy) stays off: `refused` is that deck's id, so another deck is not affected.
  const readOnly = urlIsViewOnly(input.frameUrl) || (refused !== null && refused === input.presentationId) ? 'view-only' as const
    : input.activeVersion === 'strawman' ? 'preview' as const : null
  const reason = replacePictureDisabledReason({
    deckOpen: input.deckOpen,
    viewerReady: input.viewerReady,
    readOnly,
    tabPausedHint: input.tabPausedHint,
    templateMode: input.templateMode,
    building: input.building,
    regeneratingThisSlide: refineBuildingOnSlide(input.composeJobs, { slideId: input.railSlideId, slideIndex }),
    studioBusy: input.studioBusy,
    mutationPending: input.mutationPending,
    placeholderOnScreen: slide.state === 'placeholder',
    heroOnlyReason: heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY), // REPLACE-PICTURE-HERO-ONLY (NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY, default off): a slide Layout says takes its picture as a background (a content slide) offers none; flag off, null
    eligibility,
  })
  const shownReason = input.enabled ? reason : null
  // Replace checks the reason again when it is pressed (a state that arose while the dialog was open): the one the last render found.
  const reasonNow = useRef<string | null>(null)
  reasonNow.current = shownReason

  const replace = useCallback(async (target: { slideNumber: number; slideId?: string | null }, form: { url: string; alt: string }, options?: { onProgress?: (stage: ReplacePictureStage) => void }): Promise<ReplacePictureOutcome> => {
    const now = latest.current
    const visualIndex = target.slideNumber - 1
    // The dialog was opened on one slide. The viewer is on another now, or something switched the action off while it was open (a build, a regenerate of this slide, a paused tab, Template Mode, a read-only deck): nothing is taken, nothing is sent.
    if (now.currentSlide !== target.slideNumber) return failureOutcome('SLIDE_CHANGED')
    if (reasonNow.current !== null) return unavailableOutcome(reasonNow.current)
    const mutation = now.begin('picture replacement')
    if (!mutation) return failureOutcome('BUSY')
    try {
      // Which slide is this, really? The viewer's own order, read now: the real slide at the visual position the dialog was opened on, with its layout_index (the stored index the command takes) and its id. (The rail's ids come from
      // Director's outline and are not Layout's, so they are never sent.) The id the dialog was bound to when it opened must still be the one there; with no id known then, the one read now is used.
      let order: CurrentSlide
      try { order = readCurrentSlide(await now.send(mutation.iframe, REPLACE_PICTURE_ORDER_COMMAND, {}, { timeoutMs: 5000 })) } catch { order = { state: 'unknown' } }
      if (!mutation.isCurrent()) return failureOutcome('SLIDE_CHANGED')
      // no order, no slide to name: nothing is sent (the viewer did not answer, or its answer does not add up)
      if (order.state === 'unknown') return failureOutcome('VIEWER_UNAVAILABLE')
      // the viewer moved, a placeholder stands where the slide was, or another slide is under that position now
      if (order.visualIndex !== visualIndex || order.state !== 'slide') return failureOutcome('SLIDE_CHANGED')
      if (typeof target.slideId === 'string' && target.slideId !== order.slideId) return failureOutcome('SLIDE_CHANGED')
      // The bridge rejects with text only, so the viewer's own reply message is watched for the command's code. The same watch hears the run's progress events (no action, no requestId: the bridge never takes
      // one for the reply) from the same trusted frame, matched on their commandRequestId by the tracker. Progress and the command carry the STORED index.
      let reply: unknown = null
      const frame = mutation.iframe
      const progress = createProgressTracker(order.layoutIndex)
      const watch = (event: MessageEvent) => {
        const data = event.data as { action?: unknown } | null
        if (!data || typeof data !== 'object' || !now.isTrustedReply(event, frame)) return
        if (data.action === REPLACE_PICTURE_COMMAND) { reply = data; return }
        const stage = progress.accept(data)
        if (stage !== null) options?.onProgress?.(stage)
      }
      window.addEventListener('message', watch)
      let outcome: ReplacePictureOutcome
      try {
        outcome = await runReplacePicture({ send: (action, params, options) => now.send(frame, action, params, options), observed: () => reply }, { slideIndex: order.layoutIndex, slideId: order.slideId, url: form.url, alt: form.alt })
      } finally {
        window.removeEventListener('message', watch)
      }
      if (outcome.ok || outcome.stored) { if (mutation.isCurrent()) latest.current.afterReplace() }
      else if (isReadOnlyPictureCode(outcome.code)) setRefused(latest.current.presentationId)
      return outcome
    } finally {
      mutation.release()
    }
  }, [])

  return {
    visible: input.enabled && input.deckOpen && !input.presenting,
    reason: shownReason,
    slideNumber: input.currentSlide,
    slideTitle: input.railSlideTitle && !/^Slide \d+$/i.test(input.railSlideTitle.trim()) ? input.railSlideTitle.trim() : null,
    target: eligibility.state === 'known' ? eligibility.target : null,
    slideId: slide.state === 'slide' ? slide.slideId : null,
    replace,
    reloadDeck: input.onReloadDeck,
  }
}
