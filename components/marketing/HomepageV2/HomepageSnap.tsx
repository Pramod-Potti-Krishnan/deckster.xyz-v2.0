"use client"

import { useEffect } from "react"

/**
 * Scopes scroll-snap behaviour to the homepage only. Mounts a `snap-homepage`
 * class on <html> so the page-level scroll container snaps to each slide as
 * the user scrolls. Removed on unmount so other routes (builder, billing,
 * etc.) keep their normal scroll feel.
 *
 * Per-section snap alignment is declared via the `data-snap="slide"`
 * attribute on each marketing section + the matching rule in globals.css.
 */
export function HomepageSnap() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add("snap-homepage")
    return () => {
      html.classList.remove("snap-homepage")
    }
  }, [])
  return null
}
