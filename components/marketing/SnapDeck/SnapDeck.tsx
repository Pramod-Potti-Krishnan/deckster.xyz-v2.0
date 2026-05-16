"use client"

import { useEffect } from "react"
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
 * - Arrow keys / PageUp / PageDown / Home / End jump exactly one slide,
 *   ignoring focus inside form fields so typing isn't hijacked.
 *
 * Drop this once at the top of any page composed of `<section data-snap="slide">`
 * sections. Pair with <SlideNavArrows /> for on-screen up/down buttons.
 */
export function SnapDeck() {
  useEffect(() => {
    const html = document.documentElement
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

    window.addEventListener("keydown", onKey, { passive: false })

    return () => {
      window.removeEventListener("keydown", onKey)
      html.classList.remove("snap-deck")
    }
  }, [])
  return null
}
