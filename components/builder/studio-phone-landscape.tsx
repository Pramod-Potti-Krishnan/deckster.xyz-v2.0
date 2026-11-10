"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FilePlus2, FolderOpen, Layers, LayoutTemplate, Menu, MessageSquare, MoreHorizontal, Palette, PanelLeft, PanelLeftClose, PanelLeftOpen, PencilLine, Plus, Shapes, StickyNote, UserRound, X } from "lucide-react"
import { STUDIO_PHONE_DECK_MENU_TARGETS, studioDirectorDot } from "@/lib/studio-phone-builder-top"
import {
  STUDIO_PHONE_FAN_ATTRIBUTE,
  STUDIO_PHONE_FAN_OPENS_MENU,
  STUDIO_PHONE_LANDSCAPE_QUERY,
  STUDIO_PHONE_NAV_ORDER,
  STUDIO_PHONE_STAGE_ATTRIBUTE,
  STUDIO_PHONE_STRIP_ATTRIBUTE,
  STUDIO_PHONE_STRIP_DEFAULT,
  studioPhoneFanItems,
  studioPhoneLandscapeStage,
  studioPhoneMenuToggle,
  studioPhoneNavItems,
  studioPhoneNavSelector,
  studioPhoneStripToggle,
  type StudioPhoneFanKey,
  type StudioPhoneFanProbe,
  type StudioPhoneMenu,
  type StudioPhoneNavKey,
  type StudioPhoneNavProbe,
  type StudioPhoneStripState,
} from "@/lib/studio-phone-landscape"
import { useStudioPhoneQuery, useStudioPhoneRailSync } from "@/hooks/use-studio-phone-landscape"
import "./studio-phone-landscape.css"
import { STUDIO_PHONE_POLISH_ATTRIBUTE, STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED } from "@/lib/studio-phone-polish" // PHONE-POLISH
import "../layout/studio-phone-polish.css" // PHONE-POLISH

/** The authoring row's own controls (the viewer portals them into its authoring slot), found by the words they carry. */
const AUTHORING_SLOT = "[data-studio-authoring-slot] button"
const AUTHORING_WORDS: Partial<Record<StudioPhoneFanKey, RegExp>> = { addSlide: /^\s*Add Slide\s*$/i, addElement: /^\s*Add Element\s*$/i }
/** The strip's own box, measured so its header band is as wide as it is (the rail's width is the viewer's own). */
const RAIL = "[data-studio-v4-thumbnails]"
const FAN_ICONS: Record<StudioPhoneFanKey, typeof Plus> = {
  addSlide: Plus, addElement: Shapes, newDeck: FilePlus2, export: Download, notes: StickyNote, thumbnails: PanelLeft, slide: PencilLine, deckList: FolderOpen, presenter: UserRound,
}

const NAV_ICONS: Record<StudioPhoneNavKey, typeof Plus> = { studio: Layers, decks: FolderOpen, templates: LayoutTemplate, themes: Palette, more: MoreHorizontal }

const find = (selector: string): HTMLElement | null => { try { return document.querySelector<HTMLElement>(selector) } catch { return null } }
/** The page's own controls the deck actions use: the same ones the phone "..." menu uses (lib/studio-phone-builder-top.ts). */
const DECK_TARGETS: Partial<Record<StudioPhoneFanKey, string>> = {
  newDeck: STUDIO_PHONE_DECK_MENU_TARGETS.newDeck, export: STUDIO_PHONE_DECK_MENU_TARGETS.export, notes: STUDIO_PHONE_DECK_MENU_TARGETS.notes,
  slide: STUDIO_PHONE_DECK_MENU_TARGETS.slide, deckList: STUDIO_PHONE_DECK_MENU_TARGETS.deckList, presenter: STUDIO_PHONE_DECK_MENU_TARGETS.presenter,
}
const locate = (key: StudioPhoneFanKey): HTMLElement | null => {
  const words = AUTHORING_WORDS[key]
  if (words) return Array.from(document.querySelectorAll<HTMLElement>(AUTHORING_SLOT)).find(button => words.test(button.textContent ?? "")) ?? null
  const target = DECK_TARGETS[key]
  return target ? find(target) : null
}
const probe = (key: StudioPhoneFanKey): StudioPhoneFanProbe | null => {
  const control = locate(key)
  if (!control) return null
  const disabled = control.matches(":disabled") || control.getAttribute("aria-disabled") === "true"
  return { label: AUTHORING_WORDS[key] ? control.textContent : control.getAttribute("aria-label") ?? control.getAttribute("title"), disabled }
}
/** A destination is the phone tab bar's own control (the bar is hidden on the stage, not removed): its words, and aria-current for the page the user is on. */
const probeNav = (key: StudioPhoneNavKey): StudioPhoneNavProbe | null => {
  const control = find(studioPhoneNavSelector(key))
  return control ? { label: control.textContent, current: control.getAttribute("aria-current") === "page" } : null
}

/**
 * STUDIO PHONE LANDSCAPE (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, default off, with the phone shell; F-13 PR 1): what a phone gets when the slide is on screen. Sideways, the page is a viewing stage (components/builder/studio-phone-landscape.css,
 * keyed to attributes this sets on <html> while it is mounted): the slide fills the screen, the thumbnails are a collapsible strip on the left, a Chat button is the way back to the Director (the page's own pane switch), and two
 * small floating buttons open one overlay menu at a time: a hamburger for the bar's destinations (Studio, Your decks, Templates, Themes, More: each is a click on the phone tab bar's own control, so its link, its handler and its More sheet are used
 * as they are) and a plus for the editing fan (Add slide, Add element and the deck actions the phone "..." menu has, each of which uses the page's own control). Nothing is re-implemented. In portrait this draws nothing: the phone shell's bottom tab bar stays.
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
  const [strip, setStrip] = useState<StudioPhoneStripState>(STUDIO_PHONE_STRIP_DEFAULT)
  const toggleStudioPhoneStrip = useCallback(() => setStrip(studioPhoneStripToggle), [])
  const stage = studioPhoneLandscapeStage({ enabled: true, landscape, deckOnStage, stageVisible })
  const [menu, setMenu] = useState<StudioPhoneMenu>(null)
  const [items, setItems] = useState<ReturnType<typeof studioPhoneFanItems>>([])
  const [navItems, setNavItems] = useState<ReturnType<typeof studioPhoneNavItems>>([])
  const burger = useRef<HTMLButtonElement>(null)
  const fab = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)

  // The viewer's own rail follows the strip while the stage is on (through the viewer's own toggle), and goes back to the portrait value after.
  useStudioPhoneRailSync(stage, strip)

  // The stage and the strip are attributes of the page the stylesheet reads; they are taken off again when this goes (a page that leaves, the flag's own component unmounting).
  useEffect(() => {
    const root = document.documentElement
    const set = (name: string, value: string | null) => { if (value === null) root.removeAttribute(name); else root.setAttribute(name, value) }
    set(STUDIO_PHONE_STAGE_ATTRIBUTE, stage ? "stage" : null)
    set(STUDIO_PHONE_STRIP_ATTRIBUTE, stage ? strip : null)
    set(STUDIO_PHONE_FAN_ATTRIBUTE, stage && menu === "fan" ? "open" : null)
  }, [stage, strip, menu])
  useEffect(() => () => {
    const root = document.documentElement
    for (const name of [STUDIO_PHONE_STAGE_ATTRIBUTE, STUDIO_PHONE_STRIP_ATTRIBUTE, STUDIO_PHONE_FAN_ATTRIBUTE]) root.removeAttribute(name)
  }, [])

  // The menus belong to the stage: turning the phone, or leaving the slide, closes whichever is open.
  useEffect(() => { if (!stage) setMenu(null) }, [stage])
  useEffect(() => { // PHONE-POLISH: the stage's lifted buttons (components/layout/studio-phone-polish.css) are keyed to this attribute, which exists only with the flag on and only while the stage is on
    if (!STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED || !stage) return // PHONE-POLISH
    const root = document.documentElement // PHONE-POLISH
    root.setAttribute(STUDIO_PHONE_POLISH_ATTRIBUTE, "stage") // PHONE-POLISH
    return () => root.removeAttribute(STUDIO_PHONE_POLISH_ATTRIBUTE) // PHONE-POLISH
  }, [stage]) // PHONE-POLISH

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

  const closeMenu = useCallback(() => { setMenu(null); (menu === "nav" ? burger : fab).current?.focus({ preventScroll: true }) }, [menu])
  useEffect(() => {
    if (!menu) return
    card.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); closeMenu() } }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [menu, closeMenu])

  // One menu at a time: a button closes its own menu, or opens its menu in place of the other's (the entries are read from the page as it is now).
  const toggleMenu = (tapped: "fan" | "nav") => {
    const next = studioPhoneMenuToggle(menu, tapped)
    if (next === null) { closeMenu(); return }
    if (next === "fan") setItems(studioPhoneFanItems(Object.fromEntries((["addSlide", "addElement", "newDeck", "export", "notes", "slide", "deckList", "presenter"] as const).map(key => [key, probe(key)])), strip))
    else setNavItems(studioPhoneNavItems(Object.fromEntries(STUDIO_PHONE_NAV_ORDER.map(key => [key, probeNav(key)]))))
    setMenu(next)
  }

  // An entry uses the page's own control once the menu has gone (so the page's own menu, panel or sheet opens over a clean stage): a click, or the key a menu trigger opens on.
  const run = (key: StudioPhoneFanKey) => {
    setMenu(null)
    if (key === "thumbnails") { toggleStudioPhoneStrip(); fab.current?.focus({ preventScroll: true }); return }
    const control = locate(key)
    if (!control) return
    requestAnimationFrame(() => {
      if (STUDIO_PHONE_FAN_OPENS_MENU[key]) control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      else control.click()
    })
  }
  // A destination is a click on the phone tab bar's own control: its Link, its Studio handler, its More sheet.
  const runNav = (key: StudioPhoneNavKey) => {
    setMenu(null)
    const control = find(studioPhoneNavSelector(key))
    if (control) requestAnimationFrame(() => control.click())
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
          {menu && <button type="button" data-studio-phone-menu-backdrop="true" aria-label="Close menu" tabIndex={-1} onClick={closeMenu} />}
          {menu === "fan" && (
            <div ref={card} data-studio-phone-fan-card="true" role="menu" aria-label="Deck actions">
              {items.map(item => {
                const Icon = FAN_ICONS[item.key]
                return <button key={item.key} type="button" role="menuitem" data-studio-phone-fan-item={item.key} disabled={item.disabled} onClick={() => run(item.key)}><Icon aria-hidden="true" /><span>{item.label}</span></button>
              })}
            </div>
          )}
          {menu === "nav" && (
            <div ref={card} data-studio-phone-nav-card="true" role="menu" aria-label="Studio destinations">
              {navItems.map(item => {
                const Icon = NAV_ICONS[item.key]
                return <button key={item.key} type="button" role="menuitem" data-studio-phone-nav-item={item.key} aria-current={item.current ? "page" : undefined} onClick={() => runNav(item.key)}><Icon aria-hidden="true" /><span>{item.label}</span></button>
              })}
            </div>
          )}
          <div data-studio-phone-dock="true">
            <button ref={burger} type="button" data-studio-phone-nav-button="true" aria-label="Navigation" aria-haspopup="menu" aria-expanded={menu === "nav"} onClick={() => toggleMenu("nav")}>{menu === "nav" ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
            <button ref={fab} type="button" data-studio-phone-fab="true" aria-label="Actions" aria-haspopup="menu" aria-expanded={menu === "fan"} onClick={() => toggleMenu("fan")}>{menu === "fan" ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}</button>
          </div>
        </div>
      )}
    </>
  )
}
