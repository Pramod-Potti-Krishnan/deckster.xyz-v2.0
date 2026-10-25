"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  STUDIO_PHONE_DECK_MENU_ORDER,
  STUDIO_PHONE_DECK_MENU_TARGETS,
  studioDirectorDot,
  studioPhoneDeckMenuItems,
  type StudioPhoneDeckMenuKey,
  type StudioPhoneDeckMenuProbe,
} from "@/lib/studio-phone-builder-top"
import "./studio-phone-builder-top.css"

/** Row 1's host: the Builder top bar's action group (BuilderHeader draws it; the "..." menu is portalled in, and placed first by its stylesheet). */
export const STUDIO_PHONE_DECK_MENU_HOST = '[data-studio-v4-shell-column] > [data-studio-v4-shell-header] .studio-shell-header-actions'
/** Row 2's Director segment: today's Slides | Director switch (NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2), the segment with the Director icon. The dot is portalled into it. */
export const STUDIO_PHONE_DIRECTOR_SEGMENT = '[data-studio-v4-shell-workspace] > [data-studio-workspace-switch-v2="true"] .swsv2-segments > button:has(> svg.lucide-message-square)'

// :has() needs a 2022 or later browser; where a selector cannot be read the menu or the dot is simply not placed (and the stylesheet's :has() rules, which keep the old rows, do not apply either).
const find = (selector: string): Element | null => { try { return document.querySelector(selector) } catch { return null } }

const probe = (key: StudioPhoneDeckMenuKey): StudioPhoneDeckMenuProbe | null => {
  const control = document.querySelector<HTMLElement>(STUDIO_PHONE_DECK_MENU_TARGETS[key])
  if (!control) return null
  return { label: control.getAttribute("aria-label") ?? control.getAttribute("title"), disabled: control.matches(":disabled") || control.getAttribute("aria-disabled") === "true" }
}

/**
 * STUDIO PHONE SHELL, PR 2 (NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off; drawn only with it on): the Builder top PK chose for phones (decision B). It draws nothing where it stands: the "..." menu goes into
 * row 1 (the top bar's action group) and the Director dot into row 2's Director segment, both by portal, so BuilderHeader and the switch are not edited. components/builder/studio-phone-builder-top.css
 * shows them at 640 px and narrower only, takes the title, the deck list button, New deck and Export out of row 1, the "Director / Connected" row and the edge pull tabs out of the workspace,
 * and (at every width) turns the Director panel's status line into a dot beside "Director" with words only when it is not connected. Every entry of the menu opens the page's own control, with its
 * own handler: nothing is re-implemented, so no function is lost.
 */
export function StudioPhoneBuilderTop({ connectionState, reconnectStatus }: { connectionState: string; reconnectStatus?: string | null }) {
  const [menuHost, setMenuHost] = useState<Element | null>(null)
  const [dotHost, setDotHost] = useState<Element | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [items, setItems] = useState<ReturnType<typeof studioPhoneDeckMenuItems>>([])
  const pending = useRef<StudioPhoneDeckMenuKey | null>(null)
  const root = useRef<HTMLSpanElement>(null)

  // Both hosts are the page's own elements; the switch comes and goes with the pane layout, so they are looked up again after every render of the page.
  useEffect(() => {
    const nextMenu = find(STUDIO_PHONE_DECK_MENU_HOST)
    const nextDot = find(STUDIO_PHONE_DIRECTOR_SEGMENT)
    setMenuHost(current => (current === nextMenu ? current : nextMenu))
    setDotHost(current => (current === nextDot ? current : nextDot))
  })

  const onOpenChange = (open: boolean) => {
    if (!open) return
    setTitle(document.querySelector(STUDIO_PHONE_DECK_MENU_TARGETS.title)?.getAttribute("title") ?? null)
    setItems(studioPhoneDeckMenuItems(Object.fromEntries(STUDIO_PHONE_DECK_MENU_ORDER.map(key => [key, probe(key)]))))
  }

  // The entry's control is used once the menu has closed. Export and Presenter details open a menu or a dialog of their own, which takes the focus; everything else gives it back to "...".
  const onCloseAutoFocus = (event: Event) => {
    const key = pending.current
    pending.current = null
    if (!key) return
    const control = document.querySelector<HTMLElement>(STUDIO_PHONE_DECK_MENU_TARGETS[key])
    if (!control) return
    if (key === "export") {
      event.preventDefault()
      // Export is hidden in row 1 on a phone: shown for the moment it takes to open its own menu (it then stays while that menu is open or it has focus), opened the way a keyboard opens it.
      root.current?.setAttribute("data-export-open", "true")
      control.focus()
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      requestAnimationFrame(() => root.current?.removeAttribute("data-export-open"))
      return
    }
    if (key === "presenter") event.preventDefault()
    control.click()
  }

  const dot = studioDirectorDot(connectionState, reconnectStatus)
  return (
    <>
      {menuHost && createPortal(
        <span ref={root} data-studio-phone-deck-menu="true">
          <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Deck menu"><MoreHorizontal aria-hidden="true" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-studio-v4-shell="true" data-studio-phone-deck-menu-content="true" align="end" sideOffset={6} onCloseAutoFocus={onCloseAutoFocus}>
              <DropdownMenuLabel data-studio-phone-deck-menu-title="true">{title ?? "Studio"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.map(item => (
                <DropdownMenuItem key={item.key} data-studio-phone-deck-menu-item={item.key} disabled={item.disabled} onSelect={() => { pending.current = item.key }}>{item.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>,
        menuHost,
      )}
      {dotHost && createPortal(
        <span data-studio-phone-director-dot={dot.tone}><span className="sr-only">{` ${dot.state}`}</span></span>,
        dotHost,
      )}
    </>
  )
}
