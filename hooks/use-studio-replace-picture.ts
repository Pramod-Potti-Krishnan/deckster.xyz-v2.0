"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  REPLACE_PICTURE_COMMAND,
  REPLACE_PICTURE_KIND_COMMAND,
  REPLACE_PICTURE_ORDER_COMMAND,
  canvasTypeFromCatalogReply,
  failureOutcome,
  isReadOnlyPictureCode,
  refineBuildingOnSlide,
  replacePictureDisabledReason,
  replacePictureSlideKind,
  runReplacePicture,
  slideIdentityFromOrder,
  urlIsViewOnly,
  type ReplacePictureOutcome,
} from '@/lib/studio-replace-picture'

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
  replace: (target: { slideNumber: number }, form: { url: string; alt: string }) => Promise<ReplacePictureOutcome>
  reloadDeck?: () => void
}

/**
 * Replace picture (REPLACE-PICTURE, NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): what the viewer needs to offer the action on the slide on screen.
 * Off (`enabled` false) it reads nothing and sends nothing and says `visible: false`. On, it reads the slide's kind once per slide (the viewer's getTemplateSlotCatalog, the read the Add Element panel
 * already makes), works out whether the action is available (lib/studio-replace-picture.ts, the reasons in plain words), and sends the one command when the person confirms: first a composeGetState read
 * (the viewer's own order: which slide id sits at the index, and whether the viewer is still on that slide), so Layout refuses the write if the slide at that index is not the one chosen; then
 * setSlideBackgroundPicture with the 20 s budget, inside the viewer's own slide-mutation scaffolding (other slide changes wait, the frame is checked before and after). The slide_id sent is the VIEWER's:
 * the rail's ids come from Director's outline and are not Layout's, so they are used only to match a refine job to its slide, never sent.
 */
export function useStudioReplacePicture(input: UseStudioReplacePictureInput): StudioReplacePictureView {
  const slideIndex = input.currentSlide - 1
  const key = `${input.presentationId ?? ''}\u0000${input.currentSlide}`
  const [kindRead, setKindRead] = useState<{ key: string; kind: 'hero' | 'other' | 'unknown' } | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const latest = useRef(input)
  latest.current = input
  const busy = input.building || input.studioBusy || input.mutationPending || input.templateMode
  const live = input.enabled && input.deckOpen && input.viewerReady && !input.presenting

  // The kind of the slide on screen: read once per slide, again when the frame, the build or a slide change settles. A read that fails says "unknown": the action stays on and Layout answers for itself.
  useEffect(() => {
    if (!live || busy) return
    let cancelled = false
    void Promise.resolve()
      .then(() => latest.current.send(latest.current.getIframe(), REPLACE_PICTURE_KIND_COMMAND, { slideIndex }, { timeoutMs: 8000 }))
      .then(reply => replacePictureSlideKind(canvasTypeFromCatalogReply(reply)))
      .catch(() => 'unknown' as const)
      .then(kind => { if (!cancelled) setKindRead({ key, kind }) })
    return () => { cancelled = true }
  }, [live, busy, key, slideIndex])

  const slideKind = kindRead && kindRead.key === key ? kindRead.kind : 'loading'
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
    slideKind,
  })

  const replace = useCallback(async (target: { slideNumber: number }, form: { url: string; alt: string }): Promise<ReplacePictureOutcome> => {
    const now = latest.current
    const index = target.slideNumber - 1
    const mutation = now.begin('picture replacement')
    if (!mutation) return failureOutcome('BUSY')
    try {
      // Which slide is this, really? The viewer's own order says which id sits at the index and whether the viewer is still on that slide. (The rail's ids come from Director's outline and are not Layout's, so they are never sent.)
      let slideId: string | null = null
      try {
        const identity = slideIdentityFromOrder(await now.send(mutation.iframe, REPLACE_PICTURE_ORDER_COMMAND, {}, { timeoutMs: 5000 }), index)
        if (identity.onSlide === false) return failureOutcome('SLIDE_CHANGED')
        slideId = identity.slideId
      } catch { /* the id is optional: without it Layout still writes to the slide at the index */ }
      if (!mutation.isCurrent()) return failureOutcome('SLIDE_CHANGED')
      // The bridge rejects with text only, so the viewer's own reply message is watched for the command's code.
      let reply: unknown = null
      const frame = mutation.iframe
      const watch = (event: MessageEvent) => {
        const data = event.data as { action?: unknown } | null
        if (data && typeof data === 'object' && data.action === REPLACE_PICTURE_COMMAND && now.isTrustedReply(event, frame)) reply = data
      }
      window.addEventListener('message', watch)
      let outcome: ReplacePictureOutcome
      try {
        outcome = await runReplacePicture({ send: (action, params, options) => now.send(frame, action, params, options), observed: () => reply }, { slideIndex: index, slideId, url: form.url, alt: form.alt })
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
    reason: input.enabled ? reason : null,
    slideNumber: input.currentSlide,
    slideTitle: input.railSlideTitle && !/^Slide \d+$/i.test(input.railSlideTitle.trim()) ? input.railSlideTitle.trim() : null,
    replace,
    reloadDeck: input.onReloadDeck,
  }
}
