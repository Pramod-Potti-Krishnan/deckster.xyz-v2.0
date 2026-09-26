"use client"

import { useEffect } from "react"
import { HEADER_OFFSET_PX } from "./constants"
import { isTypingTarget, snapToAdjacent, snapToEdge } from "./use-snap-navigation"

/**
 * Mounts scroll-snap behaviour on whichever page renders it AND wires
 * keyboard nav that explicitly snaps to the prev/next slide.
 *
 * - Mounts a `snap-deck` class on <html> so the page-level scroll snaps to
 *   each slide as the user scrolls. Removed on unmount so other routes keep
 *   their normal scroll feel.
 * - Per-section snap alignment is declared via `data-snap="slide"` + the
 *   matching rule in globals.css.
 * - Arrow keys / PageUp / PageDown / Space / Home / End jump one snap target,
 *   ignoring focus inside form fields so typing isn't hijacked.
 *
 * Drop this once at the top of any page composed of `<section data-snap="slide">`
 * sections. Pair with <SlideNavArrows /> for on-screen up/down buttons.
 */
export function SnapDeck({ headerOffsetPx = HEADER_OFFSET_PX }: { headerOffsetPx?: number }) {
  useEffect(() => {
    const html = document.documentElement
    const previousOffset = html.style.getPropertyValue("--snap-deck-header-offset")
    const previousPriority = html.style.getPropertyPriority("--snap-deck-header-offset")
    html.style.setProperty("--snap-deck-header-offset", `${headerOffsetPx}px`)
    html.classList.add("snap-deck")

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
          e.preventDefault()
          snapToAdjacent(1)
          return
        case " ":
          if (e.target instanceof HTMLElement && e.target.closest("button,a,[role='button']")) return
          e.preventDefault()
          snapToAdjacent(1)
          return
        case "ArrowUp":
        case "PageUp":
          e.preventDefault()
          snapToAdjacent(-1)
          return
        case "Home":
          e.preventDefault()
          snapToEdge("first")
          return
        case "End":
          e.preventDefault()
          snapToEdge("last")
          return
        default:
          return
      }
    }

    const onNextClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-next]")) return
      e.preventDefault()
      snapToAdjacent(1)
    }

    window.addEventListener("keydown", onKey, { passive: false })
    document.addEventListener("click", onNextClick)

    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("click", onNextClick)
      html.classList.remove("snap-deck")
      if (previousOffset) {
        html.style.setProperty("--snap-deck-header-offset", previousOffset, previousPriority)
      } else {
        html.style.removeProperty("--snap-deck-header-offset")
      }
    }
  }, [headerOffsetPx])
  return null
}
