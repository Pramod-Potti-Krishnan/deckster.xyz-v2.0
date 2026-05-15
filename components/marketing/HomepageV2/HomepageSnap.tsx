"use client"

import { useEffect } from "react"

/**
 * Scopes scroll-snap behaviour to the homepage only AND wires keyboard
 * navigation that explicitly snaps to the prev/next slide.
 *
 * - Mounts a `snap-homepage` class on <html> so the page-level scroll
 *   snaps to each slide as the user scrolls. Removed on unmount so other
 *   routes keep their normal scroll feel.
 * - Per-section snap alignment is declared via `data-snap="slide"` + the
 *   matching rule in globals.css.
 * - Arrow keys / PageUp / PageDown / Home / End jump exactly one slide,
 *   ignoring focus inside form fields so typing isn't hijacked.
 */
const HEADER_OFFSET_PX = 48
const SCROLL_TOLERANCE_PX = 32

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  return false
}

function getSlides(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('main section[data-snap="slide"]'),
  )
}

function snapToAdjacent(direction: 1 | -1) {
  const slides = getSlides()
  if (slides.length === 0) return
  const currentTop = window.scrollY + HEADER_OFFSET_PX

  if (direction === 1) {
    const next = slides.find(
      (s) => s.offsetTop > currentTop + SCROLL_TOLERANCE_PX,
    )
    if (next) {
      next.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  } else {
    let prev: HTMLElement | null = null
    for (const s of slides) {
      if (s.offsetTop < currentTop - SCROLL_TOLERANCE_PX) prev = s
      else break
    }
    if (prev) prev.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

function snapToEdge(edge: "first" | "last") {
  const slides = getSlides()
  if (slides.length === 0) return
  const target = edge === "first" ? slides[0] : slides[slides.length - 1]
  target.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function HomepageSnap() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add("snap-homepage")

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
      html.classList.remove("snap-homepage")
    }
  }, [])
  return null
}
