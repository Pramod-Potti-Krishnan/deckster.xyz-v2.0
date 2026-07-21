"use client"

import React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { Home, PanelLeft } from "lucide-react"
import {
  BuildFingerprintBadge,
  BuildVersionGuard,
} from "@/components/build-version-guard"

export interface BuilderHeaderProps {
  wsError: any
  onOpenChatHistory: () => void
  isChatHistoryOpen?: boolean
  toolbarSlotRef?: (el: HTMLDivElement | null) => void
}

export function BuilderHeader({
  wsError,
  onOpenChatHistory,
  isChatHistoryOpen = false,
  toolbarSlotRef,
}: BuilderHeaderProps) {
  // Theme is owned by next-themes; the in-toolbar light/dark toggle lives
  // in the Mode dropdown (inside presentation-viewer.tsx). We still read
  // resolvedTheme here to flip BuilderHeader's own chrome styling.
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <>
      <header
        className={
          isDark
            ? "bg-slate-900 border-b border-slate-800 h-14 flex-shrink-0"
            : "bg-white border-b border-slate-200 h-14 flex-shrink-0"
        }
      >
        <div className="h-full px-4 flex items-center">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={
                isDark
                  ? "flex-shrink-0 hover:bg-slate-800"
                  : "flex-shrink-0 hover:bg-slate-100"
              }
              aria-label="Go to home"
              title="Home"
            >
              <Link href="https://deckster.xyz">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenChatHistory}
              className={
                isDark
                  ? `flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white ${isChatHistoryOpen ? 'bg-slate-800 text-white' : ''}`
                  : `flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900 ${isChatHistoryOpen ? 'bg-slate-200 text-slate-900' : ''}`
              }
              aria-label={isChatHistoryOpen ? 'Close deck list' : 'Open deck list'}
              title={isChatHistoryOpen ? 'Close decks' : 'All decks'}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Portal target for presentation toolbar */}
          <div ref={toolbarSlotRef} className="flex-1 min-w-0 h-full overflow-hidden" />

          {/* One-button-width gap before the profile so it reads as separate from present actions */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-[72px]">
            <BuildFingerprintBadge />
            <UserProfileMenu />
          </div>
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
