// NEXT_PUBLIC_STUDIO_PASS3_POLISH, PR G (FRONTEND-2, 25 Oct; default off, exact "true", read at build time). The SAME flag as PR A to F: it is PR A's STUDIO_PASS3_POLISH_ENABLED (exact "true" and the Studio shell), not a
// flag of its own.
//
// PK's review of the phone proposals (25 Oct), decision C, "Original sizes, iPhone-only zoom fix". PR A's section 2 made every phone text control 16px, because iOS Safari zooms the page when a text control under 16px takes
// focus; PK finds 16px too big. With the flag on, section 2 is gone (components/studio-pass3-polish/studio-pass3-polish.css: a phone's text controls keep the sizes and lines the Studio's own stylesheets give them) and the
// zoom is stopped where it happens instead: on iPhone and iPad only, <meta name="viewport"> gets maximum-scale=1 (the rest of its content stays). Safari has let a visitor pinch-zoom whatever the viewport says since iOS 10,
// so nothing is taken away from them. Android and desktop browsers do not zoom on focus, and maximum-scale there WOULD block pinch zoom, so their meta is never touched.
//
// What is here: isIosDevice and iosZoomViewportContent are pure ((user agent, touch points, content) in, content out: the unit-tested part), installIosZoomFix sets the content on the document's viewport meta and returns the
// function that puts the original back, useStudioPass3PolishGViewport is the effect that calls it. The Builder page calls the hook, the account pages draw StudioPass3PolishGMount (app/(app)/layout.tsx); both only with the flag
// on. Flag off, nothing here runs: the hook returns before it reads the document, so the meta is never read or written.
//
// The one thing a Chromium test cannot prove is Safari's reaction to the changed content: a real iPhone tap test (focus a text control, the page must not zoom) is needed before the flag is switched on.

import { useEffect } from 'react'
import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish'

export const STUDIO_PASS3_POLISH_G_ENABLED = STUDIO_PASS3_POLISH_ENABLED

/** The directive added to the viewport meta's content on iPhone and iPad. */
export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=1'

/**
 * iOS and iPadOS: "iPhone", "iPod" or "iPad" in the user agent, or (iPadOS 13 and later, whose Safari sends a Mac user agent in its desktop mode) "Macintosh" with more than one touch point, which no Mac has.
 * Android, Windows, Linux and a Mac with no touch screen are not.
 */
export function isIosDevice(userAgent: unknown, maxTouchPoints: unknown): boolean {
  const ua = typeof userAgent === 'string' ? userAgent : ''
  if (/iP(hone|od|ad)/.test(ua)) return true
  return /Macintosh/.test(ua) && typeof maxTouchPoints === 'number' && maxTouchPoints > 1
}

/**
 * The viewport meta's content on this device: on iPhone and iPad, the current content with maximum-scale=1 (an existing maximum-scale is set to 1, every other directive and its place stay as they were; with none
 * it is added at the end, after ", "); on every other device, and for a content with no directive at all, the content as it is. Pure: nothing is read from the page.
 */
export function iosZoomViewportContent(userAgent: unknown, maxTouchPoints: unknown, content: unknown): string {
  const current = typeof content === 'string' ? content : ''
  if (!isIosDevice(userAgent, maxTouchPoints)) return current
  if (!/\S/.test(current)) return current
  const existing = /(^|[,;\s])maximum-scale\s*=\s*([^,;\s]*)/i.exec(current)
  if (existing) {
    if (Number(existing[2]) === 1) return current
    return current.replace(/(^|[,;\s])(maximum-scale\s*=\s*)([^,;\s]*)/i, (_all, lead: string, key: string) => `${lead}${key}1`)
  }
  return `${current.replace(/[\s,;]+$/, '')}, ${IOS_MAX_SCALE_DIRECTIVE}`
}

interface ViewportMeta { getAttribute(name: string): string | null; setAttribute(name: string, value: string): void; isConnected?: boolean }

// The meta this module changed, the content it had, the content it set, and how many mounts hold the change (the account layout and the Builder are never on screen together, but React strict mode runs an effect, its
// cleanup and the effect again).
let held: { meta: ViewportMeta; original: string; applied: string } | null = null
let holders = 0

/**
 * Puts maximum-scale=1 into the document's viewport meta on iPhone and iPad and returns the function that gives the original content back (only when the meta still holds what this set, and only when the LAST holder lets
 * go; a holder that lets go twice counts once). On any other device, or with no viewport meta, it changes nothing and returns a function that does nothing. `doc` and `nav` are the document and the navigator (a test
 * passes stand-ins); only querySelector, userAgent and maxTouchPoints are read.
 */
export function installIosZoomFix(doc: { querySelector(selector: string): ViewportMeta | null }, nav: { userAgent?: unknown; maxTouchPoints?: unknown }): () => void {
  if (held === null) {
    const meta = doc.querySelector('meta[name="viewport"]')
    if (!meta) return () => {}
    const original = meta.getAttribute('content') ?? ''
    const next = iosZoomViewportContent(nav.userAgent, nav.maxTouchPoints, original)
    if (next === original) return () => {}
    meta.setAttribute('content', next)
    held = { meta, original, applied: next }
  }
  holders += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holders -= 1
    if (holders > 0 || held === null) return
    const { meta, original, applied } = held
    held = null
    holders = 0
    if (meta.isConnected !== false && meta.getAttribute('content') === applied) meta.setAttribute('content', original)
  }
}

/** The effect: iPhone and iPad get maximum-scale=1 while a Studio route is on screen and the flag is on. Flag off, it returns before it reads the document. */
export function useStudioPass3PolishGViewport(): void {
  useEffect(() => {
    if (!STUDIO_PASS3_POLISH_G_ENABLED) return
    return installIosZoomFix(document, navigator)
  }, [])
}
