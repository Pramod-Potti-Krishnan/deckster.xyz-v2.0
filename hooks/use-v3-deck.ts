"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useReveal } from "./use-reveal"
import { STUDIO_P2_NIGHT_CLASS, studioP2LandingOn } from "@/lib/studio-p2-landing"

// PASS2 LAND-01 (flag NEXT_PUBLIC_STUDIO_P2_LANDING, default off): <html> carries the marker the night background is scoped to. Off, no class is added.
const STUDIO_P2_LANDING = studioP2LandingOn(process.env.NEXT_PUBLIC_STUDIO_P2_LANDING)

export function useV3Deck() {
  const pathname = usePathname()
  useReveal()
  useEffect(() => {
    const html = document.documentElement
    const header = document.querySelector<HTMLElement>(".mv3 [data-v3-header]")
    const slides = Array.from(document.querySelectorAll<HTMLElement>(".mv3 main > section.slide"))
    html.classList.add("mv3-page")
    if (STUDIO_P2_LANDING) html.classList.add(STUDIO_P2_NIGHT_CLASS)
    let raf: number | null = null
    const update = () => {
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        let active = 0
        const y = window.scrollY + 56 + 32
        slides.forEach((section, index) => {
          if (section.offsetTop <= y) active = index
        })
        header?.classList.toggle("is-light", slides[active]?.classList.contains("slide--paper") ?? false)
        raf = null
      })
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      if (raf !== null) cancelAnimationFrame(raf)
      html.classList.remove("mv3-page")
      if (STUDIO_P2_LANDING) html.classList.remove(STUDIO_P2_NIGHT_CLASS)
    }
  }, [pathname])
}
