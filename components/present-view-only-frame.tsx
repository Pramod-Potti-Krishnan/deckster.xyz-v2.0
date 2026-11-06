"use client"

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { cn } from '@/lib/utils'
import { resolveSlideViewerNavigationInfo } from '@/lib/slide-compose-async'
import { presentFrameUrl } from '@/lib/present-view-only'

/**
 * A4 — the audience-facing frame for full-screen Present (flag
 * NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED, default off; the parent renders this
 * only while the flag is on and Present is active).
 *
 * Layout's `viewOnly` is a server-injected const, not a runtime toggle, so the
 * editing frame cannot become view-only in place. This is a second, separate
 * frame on `?viewOnly=true#/N`, layered over the editing frame for the length of
 * one Present session. The editing frame is never reloaded, so pending autosave,
 * Studio's per-frame ownership proofs and the thumbnail strip are untouched.
 *
 * The frame stays black until Layout answers a slide-info read (the viewer is
 * initialised), then fades in. If it never answers, `onFailed` drops it and
 * Present falls back to the editing frame, i.e. today's behaviour.
 */

/** Same signature as presentation-viewer's `sendCommand`; injected so the postMessage protocol lives in one place. */
export type PresentFrameSendCommand = (
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>,
  timeoutMs?: number,
) => Promise<unknown>

const POLL_MS = 400
const READ_TIMEOUT_MS = 1500
const READY_TIMEOUT_MS = 12_000

export function PresentViewOnlyFrame({
  baseUrl,
  startIndex,
  sendCommand,
  frameRef,
  onSlideIndex,
  onFailed,
}: {
  /** The editing frame's approved viewer URL (no hash). */
  baseUrl: string
  /** Slide to open on, 0-based. Read once: the frame never reloads during a session. */
  startIndex: number
  sendCommand: PresentFrameSendCommand
  /** Set to the iframe once it is initialised (the parent forwards arrow keys to it), null otherwise. */
  frameRef: MutableRefObject<HTMLIFrameElement | null>
  /** The slide the viewer is on (0-based), reported about every 400 ms. */
  onSlideIndex: (index: number) => void
  onFailed: () => void
}) {
  const [src] = useState(() => presentFrameUrl(baseUrl, startIndex))
  const [ready, setReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const latest = useRef({ sendCommand, onSlideIndex, onFailed })
  latest.current = { sendCommand, onSlideIndex, onFailed }

  useEffect(() => {
    let cancelled = false
    let isReady = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const tick = async () => {
      const iframe = iframeRef.current
      try {
        const info = resolveSlideViewerNavigationInfo(
          await latest.current.sendCommand(iframe, 'getCurrentSlideInfo', undefined, READ_TIMEOUT_MS),
        )
        if (cancelled) return
        if (info) {
          if (!isReady) {
            isReady = true
            frameRef.current = iframe
            setReady(true)
            // Keys go straight to Reveal once the frame has focus; arrow keys are also forwarded by the parent.
            try { iframe?.focus() } catch { /* focus is best effort */ }
          }
          latest.current.onSlideIndex(info.currentVisualIndex)
        }
      } catch {
        // Viewer still loading, or a slow read: try again.
      }
      if (cancelled) return
      if (!isReady && Date.now() - startedAt > READY_TIMEOUT_MS) {
        latest.current.onFailed()
        return
      }
      timer = setTimeout(tick, POLL_MS)
    }

    timer = setTimeout(tick, POLL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      frameRef.current = null
    }
  }, [frameRef])

  return (
    <div data-present-view-only-frame="true" className="absolute inset-0 z-30 bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        title="Presentation (view only)"
        allow="fullscreen"
        className={cn('h-full w-full border-0 transition-opacity duration-200', ready ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
