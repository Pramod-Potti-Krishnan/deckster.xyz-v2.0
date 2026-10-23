"use client"

import { useEffect, useRef } from "react"

/** A soft light that follows the pointer on night slides (mouse only; off for reduced motion). */
export function V3Spotlight() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const html = document.documentElement
    let raf = 0
    const onMove = (event: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        el.style.setProperty("--mx", `${event.clientX}px`)
        el.style.setProperty("--my", `${event.clientY}px`)
        html.classList.add("mv3-spot-on")
      })
    }
    const onLeave = () => html.classList.remove("mv3-spot-on")
    window.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("pointerleave", onLeave)
    return () => {
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeave)
      html.classList.remove("mv3-spot-on")
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div className="v3-spot" ref={ref} aria-hidden="true" />
}
