"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * The small behaviours the v4 pages need beyond the shared deck runtime:
 * the dashed connectors on the Bring flow (each file to the mark, the mark to each asset), the theme switch on the Brand slide,
 * and the companion clips: each <video class="castv"> shows its still as the poster; on wider screens the short muted loop
 * is loaded and played only while it is on screen (phones and reduced-motion keep the still).
 */
export function V4Runtime() {
  const pathname = usePathname()
  useEffect(() => {
    const curve = (x1: number, y1: number, x2: number, y2: number) => {
      const mx = (x1 + x2) / 2
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const drawFlows = () => {
      document.querySelectorAll<HTMLElement>(".mv4 .flow").forEach((flow) => {
        const svg = flow.querySelector<SVGSVGElement>(".flow__svg")
        const core = flow.querySelector<HTMLElement>(".core")
        if (!svg || !core) return
        const box = flow.getBoundingClientRect()
        if (!box.width) return
        const c = core.getBoundingClientRect()
        const cy = c.top + c.height / 2 - box.top
        let paths = ""
        flow.querySelectorAll<HTMLElement>(".flow__col:first-of-type .file").forEach((file) => {
          const r = file.getBoundingClientRect()
          paths += `<path class="in" d="${curve(r.right - box.left, r.top + r.height / 2 - box.top, c.left - box.left, cy)}"/>`
        })
        flow.querySelectorAll<HTMLElement>(".flow__col:last-of-type .asset").forEach((asset) => {
          const r = asset.getBoundingClientRect()
          paths += `<path class="out" d="${curve(c.right - box.left, cy, r.left - box.left, r.top + r.height / 2 - box.top)}"/>`
        })
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`)
        svg.innerHTML = paths
      })
    }
    const onThemeClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".mv4 [data-theme-switch] button") : null
      if (!button) return
      const scope = button.closest(".themes") ?? document
      scope.querySelectorAll<HTMLButtonElement>("[data-theme-switch] button").forEach((other) => {
        other.classList.toggle("is-on", other === button)
        other.setAttribute("aria-pressed", String(other === button))
      })
      scope.querySelectorAll<HTMLImageElement>("img[data-theme]").forEach((img) => img.classList.toggle("is-on", img.dataset.theme === button.dataset.theme))
    }
    let clips: IntersectionObserver | null = null
    if (window.innerWidth >= 700 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clips = new IntersectionObserver((entries) => entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) {
          if (!video.getAttribute("src") && video.dataset.src) video.src = video.dataset.src
          video.muted = true
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      }), { threshold: 0.25 })
      document.querySelectorAll<HTMLVideoElement>(".mv4 video.castv[data-src]").forEach((video) => clips?.observe(video))
    }
    drawFlows()
    const timer = setTimeout(drawFlows, 400)
    window.addEventListener("resize", drawFlows)
    document.addEventListener("click", onThemeClick)
    return () => {
      clips?.disconnect()
      clearTimeout(timer)
      window.removeEventListener("resize", drawFlows)
      document.removeEventListener("click", onThemeClick)
    }
  }, [pathname])
  return null
}
