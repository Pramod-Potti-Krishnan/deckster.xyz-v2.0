"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { V3_CONTENT } from "@/lib/marketing/v3-content"
import {
  STUDIO_P2_MENU_ATTR,
  STUDIO_P2_MENU_WORDS,
  studioP2MenuKeyEvent,
  studioP2MenuLinks,
  studioP2MenuNext,
  studioP2MenuRestoresFocus,
  type StudioP2MenuEvent,
} from "@/lib/studio-p2-landing"
import "@/styles/marketing-v3-p2.css"

/**
 * PASS2 LAND-06 (flag NEXT_PUBLIC_STUDIO_P2_LANDING; HeaderV3 renders this only with it on): the phone menu. The header's page links are hidden at 900px and below, so this
 * button (shown at those widths only, see styles/marketing-v3-p2.css) opens a small panel with Bring / Present / Experts / Pricing: the desktop header's own links.
 * Closes on Escape (the focus goes back to the button), on a press outside, and when a link is chosen.
 */
export function HeaderMenuP2() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  const links = studioP2MenuLinks(V3_CONTENT.nav)

  const send = (event: StudioP2MenuEvent) => {
    setOpen(current => studioP2MenuNext(current, event))
    if (studioP2MenuRestoresFocus(event)) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const action = studioP2MenuKeyEvent(event.key)
      if (action) send(action)
    }
    const onPress = (event: Event) => {
      const target = event.target as Node | null
      if (target && wrapRef.current?.contains(target)) return
      send("outside")
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPress)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPress)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="p2-menu" {...{ [STUDIO_P2_MENU_ATTR]: "true" }} data-open={open ? "true" : "false"}>
      <button
        ref={buttonRef}
        type="button"
        className="p2-menu__btn"
        aria-label={open ? STUDIO_P2_MENU_WORDS.close : STUDIO_P2_MENU_WORDS.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => send("toggle")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <nav id={panelId} className="p2-menu__panel" aria-label={STUDIO_P2_MENU_WORDS.navLabel} hidden={!open}>
        {links.map(item => (
          <Link key={item.label} href={item.href} className={pathname === item.href.split("#")[0] ? "is-here" : undefined} onClick={() => send("choose")}>{item.label}</Link>
        ))}
      </nav>
    </div>
  )
}
