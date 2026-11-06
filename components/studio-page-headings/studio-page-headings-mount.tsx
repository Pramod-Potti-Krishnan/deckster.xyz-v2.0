"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { STUDIO_PAGE_CONTAINER_ATTR, STUDIO_PAGE_HEADING_ATTR, STUDIO_PAGE_HEADINGS_ATTR, studioPageContainerRoles } from "@/lib/studio-page-headings"
import "./studio-page-headings.css"

// UX-09 (NEXT_PUBLIC_STUDIO_PAGE_HEADINGS, default off): drawn by app/(app)/layout.tsx only with the flag on. It only sets attributes (on <html>, the page's first <h1> and the centring
// containers above it); it adds, removes and rewrites no node. Re-marks on each route change and, briefly, as the page streams in. It draws nothing.
export function StudioPageHeadingsMount() {
  const pathname = usePathname()
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute(STUDIO_PAGE_HEADINGS_ATTR, "true")
    const mark = () => {
      const workspace = document.querySelector('[data-studio-v4-account-frame="true"] [data-studio-v4-shell-workspace="true"]')
      const heading = workspace?.querySelector("h1")
      if (!workspace || !heading) return
      document.querySelectorAll(`[${STUDIO_PAGE_CONTAINER_ATTR}]`).forEach(node => node.removeAttribute(STUDIO_PAGE_CONTAINER_ATTR))
      const chain: HTMLElement[] = []
      for (let node = heading.parentElement; node && node !== workspace; node = node.parentElement) chain.unshift(node)
      const roles = studioPageContainerRoles(chain.map(node => getComputedStyle(node)))
      chain.forEach((node, index) => { const role = roles[index]; if (role) node.setAttribute(STUDIO_PAGE_CONTAINER_ATTR, role) })
      heading.setAttribute(STUDIO_PAGE_HEADING_ATTR, "true")
    }
    mark()
    const observer = new MutationObserver(mark)
    const target = document.querySelector('[data-studio-v4-shell-workspace="true"]')
    if (target) observer.observe(target, { childList: true, subtree: true })
    const stop = window.setTimeout(() => observer.disconnect(), 4000)
    return () => { observer.disconnect(); window.clearTimeout(stop) }
  }, [pathname])
  useEffect(() => () => document.documentElement.removeAttribute(STUDIO_PAGE_HEADINGS_ATTR), [])
  return null
}
