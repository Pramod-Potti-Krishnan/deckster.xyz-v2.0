"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useReveal } from "./use-reveal"

export function useV3Deck() {
  const pathname = usePathname()
  useReveal()
  useEffect(() => {
    const html = document.documentElement
    const header = document.querySelector<HTMLElement>(".mv3 [data-v3-header]")
    const slides = Array.from(document.querySelectorAll<HTMLElement>(".mv3 main > section.slide"))
    html.classList.add("mv3-page")
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
    }
  }, [pathname])
}
