import { HEADER_OFFSET_PX, SCROLL_TOLERANCE_PX } from "./constants"

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

export function snapToAdjacent(direction: 1 | -1) {
  const slides = getSlides()
  if (slides.length === 0) return
  const currentTop = window.scrollY + HEADER_OFFSET_PX

  if (direction === 1) {
    const next = slides.find(
      (s) => s.offsetTop > currentTop + SCROLL_TOLERANCE_PX,
    )
    next?.scrollIntoView({ behavior: "smooth", block: "start" })
  } else {
    let prev: HTMLElement | null = null
    for (const s of slides) {
      if (s.offsetTop < currentTop - SCROLL_TOLERANCE_PX) prev = s
      else break
    }
    prev?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

export function snapToEdge(edge: "first" | "last") {
  const slides = getSlides()
  if (slides.length === 0) return
  const target = edge === "first" ? slides[0] : slides[slides.length - 1]
  target.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function computeBounds(): { canUp: boolean; canDown: boolean } {
  const slides = getSlides()
  if (slides.length === 0) return { canUp: false, canDown: false }
  const currentTop = window.scrollY + HEADER_OFFSET_PX
  const canUp = slides.some(
    (s) => s.offsetTop < currentTop - SCROLL_TOLERANCE_PX,
  )
  const canDown = slides.some(
    (s) => s.offsetTop > currentTop + SCROLL_TOLERANCE_PX,
  )
  return { canUp, canDown }
}
