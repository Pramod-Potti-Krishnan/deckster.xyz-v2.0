"use client"

import React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { Brain, Home, PanelLeft, Plus } from "lucide-react"
import {
  BuildFingerprintBadge,
  BuildVersionGuard,
} from "@/components/build-version-guard"
import { DeckIdentityDialog } from "@/components/builder/deck-identity-dialog"
import { isDeckIdentityEnabled } from "@/lib/deck-identity"
import { StudioNavigationHint } from "@/components/layout/studio-navigation-hint"

export interface BuilderHeaderProps {
  onNewPresentation?: () => void
  deckTitle?: string
  wsError: any
  onOpenChatHistory: () => void
  isChatHistoryOpen?: boolean
  toolbarSlotRef?: (el: HTMLDivElement | null) => void
  introAction?: React.ReactNode
  onToolbarInteract?: () => void
}

export function BuilderHeader({
  onNewPresentation,
  deckTitle = "Studio",
  wsError,
  onOpenChatHistory,
  isChatHistoryOpen = false,
  toolbarSlotRef,
  onToolbarInteract,
  introAction,
}: BuilderHeaderProps) {
  // Theme is owned by next-themes; the in-toolbar light/dark toggle lives
  // in the Mode dropdown (inside presentation-viewer.tsx). We still read
  // resolvedTheme here to flip BuilderHeader's own chrome styling.
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const studioLabels = process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === 'true'

  const headerRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    if (!studioShell) return
    const container = headerRef.current?.querySelector<HTMLDivElement>('[data-studio-v4-toolbar-target]')
    if (!container) return
    const revealToolbarFocus = (event: FocusEvent) => {
      const control = event.target
      if (!(control instanceof HTMLElement) || !container.contains(control)) return
      const bounds = container.getBoundingClientRect()
      const focused = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      const outline = style.outlineStyle === 'none' ? 0 : Math.max(
        0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0),
      )
      const left = bounds.left + container.clientLeft
      const right = left + container.clientWidth
      const delta = focused.left - outline < left
        ? focused.left - outline - left
        : Math.max(0, focused.right + outline - right)
      // Move this horizontal strip only; retain focus, page position and controls.
      if (delta) container.scrollLeft += delta
    }
    // The toolbar is portaled here from another React subtree. Observe its DOM
    // focus path; menus portaled outside this container never enter this listener.
    container.addEventListener('focusin', revealToolbarFocus)
    return () => container.removeEventListener('focusin', revealToolbarFocus)
  }, [studioShell])

  React.useEffect(() => {
    if (!studioShell || !onToolbarInteract) return
    const container = headerRef.current?.querySelector<HTMLDivElement>('[data-studio-v4-toolbar-target]')
    if (!container) return
    const interact = () => onToolbarInteract()
    // Native events follow the physical toolbar node even when controls are portaled.
    container.addEventListener('focusin', interact)
    container.addEventListener('pointerdown', interact)
    return () => {
      container.removeEventListener('focusin', interact)
      container.removeEventListener('pointerdown', interact)
    }
  }, [studioShell, onToolbarInteract])

  return (
    <>
      <header
        ref={headerRef}
        data-studio-v4-shell-header="true"
        aria-label={studioLabels ? "Studio" : undefined}
        data-studio-v4-chrome={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined}
        className={
          isDark
            ? "bg-slate-900 border-b border-slate-800 h-14 flex-shrink-0"
            : "bg-white border-b border-slate-200 h-14 flex-shrink-0"
        }
      >
        <div className="h-full px-4 flex items-center">
          {!studioShell && <div data-studio-v4-shell-legacy-nav="true" className="flex items-center gap-1.5 flex-shrink-0">
            <StudioNavigationHint enabled={studioLabels} label="Home">
              <Button
                asChild
                data-studio-v4-nav="true"
                variant="ghost"
                size="icon"
                className={
                  isDark
                    ? "flex-shrink-0 hover:bg-slate-800"
                    : "flex-shrink-0 hover:bg-slate-100"
                }
                aria-label="Go to home"
                title={studioLabels ? undefined : "Home"}
              >
                <Link href="https://deckster.xyz">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
            </StudioNavigationHint>
            <StudioNavigationHint enabled={studioLabels} label={isChatHistoryOpen ? 'Close decks' : 'All decks'}>
              <Button
                data-studio-v4-nav="true"
                variant="ghost"
                size="icon"
                onClick={onOpenChatHistory}
                className={
                  isDark
                    ? `flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white ${isChatHistoryOpen ? 'bg-slate-800 text-white' : ''}`
                    : `flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900 ${isChatHistoryOpen ? 'bg-slate-200 text-slate-900' : ''}`
                }
                aria-label={isChatHistoryOpen ? 'Close deck list' : 'Open deck list'}
                title={studioLabels ? undefined : isChatHistoryOpen ? 'Close decks' : 'All decks'}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            </StudioNavigationHint>
            <StudioNavigationHint enabled={studioLabels} label="Knowledge">
              <Button
                asChild
                data-studio-v4-nav="true"
                variant="ghost"
                size="icon"
                className={
                  isDark
                    ? "flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                    : "flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }
                aria-label="Open Knowledge"
                title={studioLabels ? undefined : "Knowledge"}
              >
                <Link href="/knowledge">
                  <Brain className="h-5 w-5" />
                </Link>
              </Button>
            </StudioNavigationHint>
            {/* Contract G3. Gated here as well as inside the component, so with
                the flag off nothing about it is even mounted. */}
            {isDeckIdentityEnabled() && <DeckIdentityDialog isDark={isDark} />}
          </div>}

          {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && <div className="studio-shell-heading">
            <StudioNavigationHint enabled label={isChatHistoryOpen ? "Close sessions" : "Sessions"}>
              <Button variant="ghost" size="icon" onClick={onOpenChatHistory} aria-label={isChatHistoryOpen ? 'Close deck list' : 'Open deck list'}><PanelLeft className="h-5 w-5" /></Button>
            </StudioNavigationHint>
            <span title={deckTitle}>{deckTitle}</span>
            {isDeckIdentityEnabled() && <DeckIdentityDialog isDark={isDark} />}
          </div>}
          {/* Portal target for presentation toolbar; same node across drawer changes. */}
          <div data-studio-v4-toolbar-target="true" ref={toolbarSlotRef} className="flex-1 min-w-0 h-full overflow-hidden" />

          {/* One-button-width gap before the profile so it reads as separate from present actions */}
          {!studioShell && (
            <div data-studio-v4-shell-diagnostics="true" className="flex items-center gap-1 flex-shrink-0 ml-[72px]">
              <BuildFingerprintBadge />
              {!studioShell && <UserProfileMenu studioLabels={studioLabels} studioPalette={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === "true"} />}
            </div>
          )}
          {studioShell && introAction}
          {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && <Button className="studio-shell-new" onClick={onNewPresentation}><Plus className="h-4 w-4" />Presentation</Button>}
        </div>
      </header>

      {/* Connection Error Alert */}
      {wsError && (
        <div className="px-4 py-2 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
          <ConnectionError onRetry={() => window.location.reload()} />
        </div>
      )}
      <BuildVersionGuard />
    </>
  )
}
