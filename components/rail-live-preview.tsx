"use client"

import React, { useEffect, useState } from 'react'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import {
  RAIL_LIVE_PREVIEW_STAGE,
  railLivePreviewEligible,
  railLivePreviewScale,
  railLivePreviewSrc,
  type RailLivePreviewStatus,
} from '@/lib/rail-live-preview'
import { useRailLivePreview, useRailPendingGrace } from '@/hooks/use-rail-live-preview'

/** Width of a rail card's preview before it is measured (w-28 minus its border). */
const DEFAULT_CARD_WIDTH = 108

function LiveFrame({ src, scale }: { src: string; scale: number }) {
  // Hidden until the viewer has loaded, so the card keeps showing "No preview" instead of a blank frame.
  const [loaded, setLoaded] = useState(false)
  return (
    <iframe
      src={src}
      title="Live slide preview"
      aria-hidden="true"
      tabIndex={-1}
      data-studio-rail-live-frame={loaded ? 'ready' : 'loading'}
      onLoad={() => setLoaded(true)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: RAIL_LIVE_PREVIEW_STAGE.width,
        height: RAIL_LIVE_PREVIEW_STAGE.height,
        maxWidth: 'none',
        border: 0,
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
        pointerEvents: 'none',
        opacity: loaded ? 1 : 0,
      }}
    />
  )
}

/**
 * Live mini-preview of one slide for a rail card that will never get a thumbnail (F9-A, flag
 * NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED). The strip renders this only for a card whose
 * inventory status is `none`, or `pending` or `stale` with no thumbnail URL, and which holds no real thumbnail; when
 * either stops being true the strip stops rendering it, which unmounts the frame and frees its slot at once.
 * A `none` card is eligible at once; a `pending` or `stale` card (Layout can say `pending` for ten minutes about a slide
 * that will never get a preview, and `stale` with no URL has lost its image) only once it has been seen that way for 15 s,
 * by a timer in the browser. The strip passes both as status `pending`.
 * It is an overlay on the card's 16:9 preview area (the card is its positioning parent), a sibling of the card's button.
 *
 * The frame is the view-only Layout viewer opened on `slideIndex`, laid out at the stage's own 1920x1080
 * and scaled down to the card. It cannot be clicked, focused or read by assistive technology: the card
 * keeps its own label and button. It is mounted only while the card is on screen and one of the rail's
 * three shared slots is free; until then the card shows what it showed before.
 *
 * `slideIndex` is the slide's index in the saved deck (0-based): the frame is a fresh load of the saved
 * deck, which holds none of the editing view's in-progress placeholders.
 */
export function RailLivePreview({ viewerUrl, slideIndex, status = 'none' }: { viewerUrl: string; slideIndex: number; status?: RailLivePreviewStatus }) {
  const src = railLivePreviewSrc(viewerUrl, slideIndex, LAYOUT_VIEWER_URL_POLICY)
  const pendingElapsed = useRailPendingGrace(status === 'pending')
  const { hostRef, mounted } = useRailLivePreview(src !== null && railLivePreviewEligible(status, pendingElapsed))
  const [scale, setScale] = useState(() => railLivePreviewScale(DEFAULT_CARD_WIDTH))

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1]
      const next = entry ? railLivePreviewScale(entry.contentRect.width) : 0
      if (next > 0) setScale(next)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [hostRef])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      inert
      data-studio-rail-live-preview={mounted ? 'live' : 'idle'}
      className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/9] overflow-hidden"
    >
      {mounted && src ? <LiveFrame key={src} src={src} scale={scale} /> : null}
    </div>
  )
}
