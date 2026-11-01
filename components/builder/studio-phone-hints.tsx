"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCw, X } from "lucide-react"
import {
  STUDIO_PHONE_LANDSCAPE_QUERY,
  STUDIO_PHONE_PORTRAIT_QUERY,
  studioPhoneLandscapeStage,
  studioPhonePortraitSlideView,
} from "@/lib/studio-phone-landscape"
import {
  STUDIO_PHONE_FULLSCREEN_ATTRIBUTE,
  STUDIO_PHONE_HINTS_ATTRIBUTE,
  STUDIO_PHONE_ROTATE_HINT_KEY,
  STUDIO_PHONE_SWIPE_ATTRIBUTE,
  STUDIO_PHONE_SWIPE_HINT_KEY,
  studioPhoneHintRemember,
  studioPhoneHintSeen,
  studioPhoneRotateHintShown,
  studioPhoneSwipeHintShown,
  studioPhoneSwipeOn,
  type StudioHintStorage,
} from "@/lib/studio-phone-hints"
import { useStudioPhoneQuery } from "@/hooks/use-studio-phone-landscape"
import { setStudioPhoneSwipeOn, useStudioPhoneFullscreen, useStudioPhoneSwipeState } from "@/hooks/use-studio-phone-hints"
import "./studio-phone-hints.css"

/** The slide's own box on the page (the viewer's frame), which the portrait hints are placed against. */
const SLIDE_FRAME = "[data-studio-slide-space] iframe"
const SWIPE_HINT_MILLISECONDS = 7000

/** localStorage, or nothing: reading the property itself can throw (Safari private mode, blocked site data). */
const storage = (): StudioHintStorage | null => { try { return window.localStorage } catch { return null } }

interface Frame { left: number; top: number; right: number; bottom: number }

/**
 * STUDIO PHONE HINTS (NEXT_PUBLIC_STUDIO_PHONE_HINTS, default off, with PR 1's flag; F-13 PR 2): the portrait slide view's one-time "Rotate for the best view" card and "Full screen" button, swipe to change slide with a one-time swipe hint
 * (stored per phone), and in the landscape stage a Full screen button beside Chat. Full screen is the browser's, asked for in the tap, or a fixed 100dvh stage of our own; never an orientation lock. The page passes where the user is (a deck on the stage,
 * the stage on screen, editing or not); the decisions are lib/studio-phone-hints.ts, the swipe and Full screen are hooks/use-studio-phone-hints.ts, and the stylesheet is keyed to the attributes this sets on <html>.
 */
export function StudioPhoneHints({ deckOnStage, stageVisible, editing, slideCount }: { deckOnStage: boolean; stageVisible: boolean; editing: boolean; slideCount: number }) {
  const landscape = useStudioPhoneQuery(STUDIO_PHONE_LANDSCAPE_QUERY)
  const portrait = useStudioPhoneQuery(STUDIO_PHONE_PORTRAIT_QUERY)
  const stage = studioPhoneLandscapeStage({ enabled: true, landscape, deckOnStage, stageVisible })
  const slideView = studioPhonePortraitSlideView({ enabled: true, portrait, deckOnStage, stageVisible })
  const { state: fullscreen, enter, exit } = useStudioPhoneFullscreen()
  const { swipes } = useStudioPhoneSwipeState()
  const [rotateSeen, setRotateSeen] = useState<boolean | null>(null)
  const [swipeSeen, setSwipeSeen] = useState<boolean | null>(null)
  const [swipeHint, setSwipeHint] = useState(false)
  const [frame, setFrame] = useState<Frame | null>(null)
  const swipeOn = studioPhoneSwipeOn({ enabled: true, portraitSlideView: slideView, fallback: fullscreen === "fallback", editing, slideCount })
  const rotateShown = studioPhoneRotateHintShown({ enabled: true, portraitSlideView: slideView, seen: rotateSeen, fullscreen })
  const swipeShown = studioPhoneSwipeHintShown({ swipeOn, seen: swipeSeen, slideCount })

  // What this phone has been shown, read once on the client (nothing flashes before that); a storage that throws reads as "not seen" and the in-memory answer holds for the page load.
  useEffect(() => {
    setRotateSeen(studioPhoneHintSeen(storage(), STUDIO_PHONE_ROTATE_HINT_KEY))
    setSwipeSeen(studioPhoneHintSeen(storage(), STUDIO_PHONE_SWIPE_HINT_KEY))
  }, [])
  const dismissRotate = () => { studioPhoneHintRemember(storage(), STUDIO_PHONE_ROTATE_HINT_KEY); setRotateSeen(true) }
  // Seen in the landscape stage: turning the phone was the answer, so the card is never needed again.
  useEffect(() => { if (stage) dismissRotate() }, [stage])

  // The swipe hint is shown once: stored when it first appears, gone after a swipe, a few seconds, or leaving the view where a swipe works (the hiding effect is declared first, so a view that turns the swipe on and shows the hint in one commit ends with it shown).
  useEffect(() => { setSwipeHint(false) }, [swipes, swipeOn])
  useEffect(() => {
    if (!swipeShown) return
    studioPhoneHintRemember(storage(), STUDIO_PHONE_SWIPE_HINT_KEY)
    setSwipeSeen(true)
    setSwipeHint(true)
  }, [swipeShown])
  useEffect(() => {
    if (!swipeHint) return
    const timer = setTimeout(() => setSwipeHint(false), SWIPE_HINT_MILLISECONDS)
    return () => clearTimeout(timer)
  }, [swipeHint])

  // The attributes the stylesheet is keyed to, and the swipe's state for the viewer; taken off again when this goes.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute(STUDIO_PHONE_HINTS_ATTRIBUTE, "on")
    return () => { root.removeAttribute(STUDIO_PHONE_HINTS_ATTRIBUTE); root.removeAttribute(STUDIO_PHONE_FULLSCREEN_ATTRIBUTE); root.removeAttribute(STUDIO_PHONE_SWIPE_ATTRIBUTE); setStudioPhoneSwipeOn(false) }
  }, [])
  useEffect(() => {
    const root = document.documentElement
    if (fullscreen === "off") root.removeAttribute(STUDIO_PHONE_FULLSCREEN_ATTRIBUTE); else root.setAttribute(STUDIO_PHONE_FULLSCREEN_ATTRIBUTE, fullscreen)
  }, [fullscreen])
  useEffect(() => {
    const root = document.documentElement
    if (swipeOn) root.setAttribute(STUDIO_PHONE_SWIPE_ATTRIBUTE, "on"); else root.removeAttribute(STUDIO_PHONE_SWIPE_ATTRIBUTE)
    setStudioPhoneSwipeOn(swipeOn)
  }, [swipeOn])

  // The slide's box, followed (the viewer fits it with a ResizeObserver of its own and the frame comes and goes with the page): the portrait hints sit against it.
  useEffect(() => {
    if (!slideView) { setFrame(null); return }
    let pending = 0
    const measure = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        const box = document.querySelector(SLIDE_FRAME)?.getBoundingClientRect()
        setFrame(current => {
          const next = box && box.width > 0 ? { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom) } : null
          return current && next && current.left === next.left && current.top === next.top && current.right === next.right && current.bottom === next.bottom ? current : next
        })
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    const space = document.querySelector("[data-studio-slide-space]")
    if (space) observer.observe(space)
    const mutations = new MutationObserver(measure)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", measure)
    return () => { cancelAnimationFrame(pending); observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", measure) }
  }, [slideView])

  return (
    <>
      {fullscreen === "fallback" && (
        <button type="button" data-studio-phone-exit="true" aria-label="Exit full screen" onClick={exit}><Minimize2 aria-hidden="true" /></button>
      )}
      {slideView && fullscreen === "off" && (
        <button type="button" data-studio-phone-fullscreen-pill="true" style={frame ? { left: Math.max(8, frame.right - 112), top: Math.max(8, frame.top - 38) } : undefined} onClick={enter}><Maximize2 aria-hidden="true" />Full screen</button>
      )}
      {stage && fullscreen === "off" && (
        <button type="button" data-studio-phone-fullscreen-button="true" aria-label="Full screen" onClick={enter}><Maximize2 aria-hidden="true" /></button>
      )}
      {rotateShown && (
        <section data-studio-phone-rotate-hint="true" aria-label="Rotate for the best view" style={frame ? { top: Math.min(frame.bottom + 22, Math.max(8, window.innerHeight - 220)) } : undefined}>
          <button type="button" data-studio-phone-hint-dismiss="true" aria-label="Dismiss" onClick={dismissRotate}><X aria-hidden="true" /></button>
          <div data-studio-phone-hint-head="true">
            <span data-studio-phone-hint-tile="true" aria-hidden="true"><RotateCw /></span>
            <div><h2>Rotate for the best view</h2><p>Turn your phone sideways and the slide fills the screen.</p></div>
          </div>
          <div data-studio-phone-hint-actions="true">
            <button type="button" data-studio-phone-hint-primary="true" onClick={() => { dismissRotate(); enter() }}><Maximize2 aria-hidden="true" />Full screen</button>
            <button type="button" data-studio-phone-hint-quiet="true" onClick={dismissRotate}>Not now</button>
          </div>
        </section>
      )}
      {swipeHint && (
        <div data-studio-phone-swipe-hint="true" role="status" style={frame ? { top: Math.max(8, frame.bottom - 44) } : undefined}><ChevronLeft aria-hidden="true" />Swipe to change slide<ChevronRight aria-hidden="true" /></div>
      )}
    </>
  )
}
