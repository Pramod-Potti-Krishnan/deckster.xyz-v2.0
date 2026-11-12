"use client"

import { useEffect, useSyncExternalStore } from "react"
import { StudioWaitingState } from "@/components/builder/studio-waiting-state"
import { studioSlideDeleteRefresh } from "@/lib/studio-slide-delete-refresh"

/**
 * PASS2D B4 (NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH, default off): covers the viewer canvas between "Layout acknowledged the slide delete" and
 * "the reloaded Layout frame has loaded", so the deleted slide is never shown as if it were still there (lib/studio-slide-delete-refresh.ts).
 * Rendered by the viewer only with the flag on, inside the iframe's relative wrapper (absolute, over the iframe, not click-through: the stale
 * document must not be edited). Unmounting (the viewer going away) lifts the veil.
 */
export function StudioSlideDeleteRefreshVeil() {
  const active = useSyncExternalStore(studioSlideDeleteRefresh.subscribe, studioSlideDeleteRefresh.getSnapshot, studioSlideDeleteRefresh.getSnapshot)
  useEffect(() => () => studioSlideDeleteRefresh.reset(), [])
  if (!active) return null
  return (
    <div className="absolute inset-0 z-30" data-studio-canvas-refreshing="true">
      <StudioWaitingState scope="canvas" message="Updating your slides…" />
    </div>
  )
}
