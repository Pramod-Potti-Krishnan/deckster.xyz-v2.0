"use client"

import React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { PanelLeft, Sun, Moon } from "lucide-react"

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
  // Read the actual resolved theme from next-themes — this is the same
  // source of truth that powers the "Dark Mode" toggle in the user profile
  // menu, so toggling from either place stays in sync.
  const { resolvedTheme, setTheme } = useTheme()
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
              aria-label="Go home"
              title="Deckster home"
            >
              <Link href="/">
                <img
                  src="/logo-icon.png"
                  alt=""
                  aria-hidden
                  className="h-7 w-7"
                />
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

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={
                isDark
                  ? "flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                  : "flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
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
    </>
  )
}
