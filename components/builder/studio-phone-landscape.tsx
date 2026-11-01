"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FilePlus2, FolderOpen, Menu, MessageSquare, PanelLeft, PanelLeftClose, PanelLeftOpen, PencilLine, Plus, Shapes, StickyNote, UserRound, X } from "lucide-react"
import { STUDIO_PHONE_DECK_MENU_TARGETS, studioDirectorDot } from "@/lib/studio-phone-builder-top"
import {
  STUDIO_PHONE_BAR_ATTRIBUTE,
  STUDIO_PHONE_FAN_ATTRIBUTE,
  STUDIO_PHONE_FAN_OPENS_MENU,
  STUDIO_PHONE_LANDSCAPE_QUERY,
  STUDIO_PHONE_PORTRAIT_QUERY,
  STUDIO_PHONE_STAGE_ATTRIBUTE,
  STUDIO_PHONE_STRIP_ATTRIBUTE,
  studioPhoneBarState,
  studioPhoneFanItems,
  studioPhoneLandscapeStage,
  studioPhonePortraitSlideView,
  type StudioPhoneFanKey,
  type StudioPhoneFanProbe,
} from "@/lib/studio-phone-landscape"
import { setStudioPhoneStage, toggleStudioPhoneStrip, useStudioPhoneQuery, useStudioPhoneStage } from "@/hooks/use-studio-phone-landscape"
import "./studio-phone-landscape.css"

/** The authoring row's own controls (the viewer portals them into its authoring slot), found by the words they carry. */
const AUTHORING_SLOT = "[data-studio-authoring-slot] button"
const AUTHORING_WORDS: Partial<Record<StudioPhoneFanKey, RegExp>> = { addSlide: /^\s*Add Slide\s*$/i, addElement: /^\s*Add Element\s*$/i }
/** The strip's own box, measured so its header band is as wide as it is (the rail's width is the viewer's own). */
const RAIL = "[data-studio-v4-thumbnails]"
const FAN_ICONS: Record<StudioPhoneFanKey, typeof Plus> = {
  addSlide: Plus, addElement: Shapes, newDeck: FilePlus2, export: Download, notes: StickyNote, thumbnails: PanelLeft, slide: PencilLine, deckList: FolderOpen, presenter: UserRound,
}

const find = (selector: string): HTMLElement | null => { try { return document.querySelector<HTMLElement>(selector) } catch { return null } }
const locate = (key: StudioPhoneFanKey): HTMLElement | null => {
  const words = AUTHORING_WORDS[key]
  if (words) return Array.from(document.querySelectorAll<HTMLElement>(AUTHORING_SLOT)).find(button => words.test(button.textContent ?? "")) ?? null
  if (key === "thumbnails") return null
  return find(STUDIO_PHONE_DECK_MENU_TARGETS[key])
}
const probe = (key: StudioPhoneFanKey): StudioPhoneFanProbe | null => {
  const control = locate(key)
  if (!control) return null
  const disabled = control.matches(":disabled") || control.getAttribute("aria-disabled") === "true"
  return { label: AUTHORING_WORDS[key] ? control.textContent : control.getAttribute("aria-label") ?? control.getAttribute("title"), disabled }
}

/**
 * STUDIO PHONE LANDSCAPE (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, default off, with the phone shell; F-13 PR 1): what a phone gets when the slide is on screen. Sideways, the page is a viewing stage (components/builder/studio-phone-landscape.css,
 * keyed to attributes this sets on <html> while it is mounted): the slide fills the screen, the thumbnails are a collapsible strip on the left, a Chat button is the way back to the Director (the page's own pane switch), and one
 * floating button opens an overlay fan: Add slide, Add element and the deck actions the phone "..." menu has, each of which uses the page's own control (nothing is re-implemented). In portrait the bottom bar folds to one Menu button.
 * The page passes where the user is (a deck on the stage, the stage on screen); the decisions are lib/studio-phone-landscape.ts and the strip's state is the viewer's rail's while the stage is on (hooks/use-studio-phone-landscape.ts).
 */
export function StudioPhoneLandscape({ deckOnStage, stageVisible, slideNumber, connectionState, reconnectStatus, onChat }: {
  deckOnStage: boolean
  stageVisible: boolean
  slideNumber: number
  connectionState: string
  reconnectStatus?: string | null
  onChat: () => void
}) {
  const landscape = useStudioPhoneQuery(STUDIO_PHONE_LANDSCAPE_QUERY)
  const portrait = useStudioPhoneQuery(STUDIO_PHONE_PORTRAIT_QUERY)
  const { strip } = useStudioPhoneStage()
  const stage = studioPhoneLandscapeStage({ enabled: true, landscape, deckOnStage, stageVisible })
  const slideView = studioPhonePortraitSlideView({ enabled: true, portrait, deckOnStage, stageVisible })
  const [fanOpen, setFanOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [items, setItems] = useState<ReturnType<typeof studioPhoneFanItems>>([])
  const fab = useRef<HTMLButtonElement>(null)
  const fan = useRef<HTMLDivElement>(null)
  const bar = studioPhoneBarState(slideView, menuOpen)

  // The stage, the bar and the strip are attributes of the page the stylesheet reads; they are taken off again when this goes (a page that leaves, the flag's own component unmounting).
  useEffect(() => {
    setStudioPhoneStage(stage)
    const root = document.documentElement
    const set = (name: string, value: string | null) => { if (value === null) root.removeAttribute(name); else root.setAttribute(name, value) }
    set(STUDIO_PHONE_STAGE_ATTRIBUTE, stage ? "stage" : null)
    set(STUDIO_PHONE_STRIP_ATTRIBUTE, stage ? strip : null)
    set(STUDIO_PHONE_BAR_ATTRIBUTE, bar)
    set(STUDIO_PHONE_FAN_ATTRIBUTE, stage && fanOpen ? "open" : null)
  }, [stage, strip, bar, fanOpen])
  useEffect(() => () => {
    setStudioPhoneStage(false)
    const root = document.documentElement
    for (const name of [STUDIO_PHONE_STAGE_ATTRIBUTE, STUDIO_PHONE_STRIP_ATTRIBUTE, STUDIO_PHONE_BAR_ATTRIBUTE, STUDIO_PHONE_FAN_ATTRIBUTE]) root.removeAttribute(name)
  }, [])

  // The fan and the Menu card belong to their own view: turning the phone, or leaving the slide, closes them.
  useEffect(() => { if (!stage) setFanOpen(false) }, [stage])
  useEffect(() => { if (!slideView) setMenuOpen(false) }, [slideView])

  // The strip's header band is as wide as the rail the viewer draws (its width is the viewer's own, and can be changed there).
  useEffect(() => {
    if (!stage || strip !== "open") return
    const root = document.documentElement
    let observed: Element | null = null
    const observer = new ResizeObserver(entries => { for (const entry of entries) root.style.setProperty("--studio-phone-strip-width", `${Math.round((entry.target as HTMLElement).offsetWidth)}px`) })
    const attach = () => {
      const rail = document.querySelector(RAIL)
      if (rail === observed) return
      if (observed) observer.unobserve(observed)
      observed = rail
      if (rail) observer.observe(rail)
    }
    attach()
    const mutations = new MutationObserver(attach)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mutations.disconnect(); root.style.removeProperty("--studio-phone-strip-width") }
  }, [stage, strip])

  const closeFan = useCallback(() => { setFanOpen(false); fab.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (!fanOpen) return
    fan.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); closeFan() } }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [fanOpen, closeFan])
  useEffect(() => {
    if (bar !== "open") return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [bar])

  const toggleFan = () => {
    if (fanOpen) { closeFan(); return }
    setItems(studioPhoneFanItems(Object.fromEntries((["addSlide", "addElement", "newDeck", "export", "notes", "slide", "deckList", "presenter"] as const).map(key => [key, probe(key)])), strip))
    setFanOpen(true)
  }

  // An entry uses the page's own control once the fan has gone (so the page's own menu or panel opens over a clean stage): a click, or the key a menu trigger opens on.
  const run = (key: StudioPhoneFanKey) => {
    setFanOpen(false)
    if (key === "thumbnails") { toggleStudioPhoneStrip(); fab.current?.focus({ preventScroll: true }); return }
    const control = locate(key)
    if (!control) return
    requestAnimationFrame(() => {
      if (STUDIO_PHONE_FAN_OPENS_MENU[key]) control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      else control.click()
    })
  }

  const dot = studioDirectorDot(connectionState, reconnectStatus)
  return (
    <>
      {stage && (
        <div data-studio-phone-landscape-layer="stage">
          {strip === "open" ? (
            <div data-studio-phone-strip-head="true">
              <button type="button" aria-label="Collapse thumbnails" aria-expanded="true" onClick={toggleStudioPhoneStrip}><PanelLeftClose aria-hidden="true" /></button>
            </div>
          ) : (
            <div data-studio-phone-strip-handle="true">
              <button type="button" aria-label="Expand thumbnails" aria-expanded="false" onClick={toggleStudioPhoneStrip}><PanelLeftOpen aria-hidden="true" /></button>
              <span data-studio-phone-strip-current="true" aria-label={`Slide ${slideNumber}`}>{slideNumber}</span>
              <span data-studio-phone-strip-label="true" aria-hidden="true">Slides</span>
            </div>
          )}
          <div data-studio-phone-controls="true">
            <button type="button" data-studio-phone-chat="true" onClick={onChat}>
              <MessageSquare aria-hidden="true" />
              <span data-studio-phone-chat-dot={dot.tone} aria-hidden="true" />
              Chat<span className="sr-only">{` ${dot.state}`}</span>
            </button>
          </div>
          {fanOpen && <button type="button" data-studio-phone-fan-backdrop="true" aria-label="Close actions" tabIndex={-1} onClick={closeFan} />}
          {fanOpen && (
            <div ref={fan} data-studio-phone-fan-card="true" role="menu" aria-label="Deck actions">
              {items.map(item => {
                const Icon = FAN_ICONS[item.key]
                return <button key={item.key} type="button" role="menuitem" data-studio-phone-fan-item={item.key} disabled={item.disabled} onClick={() => run(item.key)}><Icon aria-hidden="true" /><span>{item.label}</span></button>
              })}
            </div>
          )}
          <button ref={fab} type="button" data-studio-phone-fab="true" aria-label="Actions" aria-haspopup="menu" aria-expanded={fanOpen} onClick={toggleFan}>{fanOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}</button>
        </div>
      )}
      {slideView && (
        <button type="button" data-studio-phone-menu="true" aria-label={menuOpen ? "Close menu" : "Menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      )}
    </>
  )
}
