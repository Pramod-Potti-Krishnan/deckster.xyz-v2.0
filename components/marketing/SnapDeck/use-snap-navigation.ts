import { HEADER_OFFSET_PX, SCROLL_TOLERANCE_PX } from "./constants"

const HEADER_OFFSET_PROPERTY = "--snap-deck-header-offset"

export function getHeaderOffsetPx(): number {
  const value = document.documentElement.style.getPropertyValue(HEADER_OFFSET_PROPERTY)
  const offset = Number.parseFloat(value)
  return Number.isFinite(offset) ? offset : HEADER_OFFSET_PX
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  return false
}

export function getSlides(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('main section[data-snap="slide"]'),
  )
}

/** One target per slide, or one per declared stop inside a tall slide. */
export function getSnapTargets(): number[] {
  const headerOffset = getHeaderOffsetPx()
  const viewportHeight = window.innerHeight - headerOffset

  return getSlides().flatMap((slide) => {
    const top = slide.offsetTop - headerOffset
    if (!slide.dataset.stops) return [top]

    const span = slide.offsetHeight - viewportHeight
    return slide.dataset.stops
      .split(",")
      .map(Number)
      .filter(Number.isFinite)
      .map((stop) => top + stop * span)
  })
}

function scrollToTarget(top: number) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" })
}

export function snapToAdjacent(direction: 1 | -1) {
  const targets = getSnapTargets()
  if (targets.length === 0) return
  const currentTop = window.scrollY

  if (direction === 1) {
    const next = targets.find((top) => top > currentTop + SCROLL_TOLERANCE_PX)
    if (next !== undefined) scrollToTarget(next)
  } else {
    let prev: number | undefined
    for (const top of targets) {
      if (top < currentTop - SCROLL_TOLERANCE_PX) prev = top
      else break
    }
    if (prev !== undefined) scrollToTarget(prev)
  }
}

export function snapToEdge(edge: "first" | "last") {
  const slides = getSlides()
  if (slides.length === 0) return
  const target = edge === "first" ? slides[0] : slides[slides.length - 1]
  scrollToTarget(target.offsetTop - getHeaderOffsetPx())
}

export function computeBounds(): { canUp: boolean; canDown: boolean } {
  const targets = getSnapTargets()
  if (targets.length === 0) return { canUp: false, canDown: false }
  const currentTop = window.scrollY
  const canUp = targets.some((top) => top < currentTop - SCROLL_TOLERANCE_PX)
  const canDown = targets.some((top) => top > currentTop + SCROLL_TOLERANCE_PX)
  return { canUp, canDown }
}
