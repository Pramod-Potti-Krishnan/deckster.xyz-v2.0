"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { Home, FolderOpen, Sun, Moon } from "lucide-react"

export interface BuilderHeaderProps {
  wsError: any
  onOpenChatHistory: () => void
  toolbarSlotRef?: (el: HTMLDivElement | null) => void
  builderTheme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function BuilderHeader({
  wsError,
  onOpenChatHistory,
  toolbarSlotRef,
  builderTheme,
  onToggleTheme,
}: BuilderHeaderProps) {
  return (
    <>
      <header
        className={
          builderTheme === 'dark'
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
                builderTheme === 'dark'
                  ? "flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                  : "flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }
              aria-label="Go home"
              title="Home"
            >
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenChatHistory}
              className={
                builderTheme === 'dark'
                  ? "flex-shrink-0 h-9 px-3 gap-1.5 text-slate-200 hover:bg-slate-800 hover:text-white"
                  : "flex-shrink-0 h-9 px-3 gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }
              aria-label="Open all decks"
              title="All decks"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="text-sm font-medium">Decks</span>
            </Button>
          </div>

          {/* Portal target for presentation toolbar */}
          <div ref={toolbarSlotRef} className="flex-1 min-w-0 h-full overflow-hidden" />

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className={
                builderTheme === 'dark'
                  ? "flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                  : "flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }
              aria-label={builderTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={builderTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {builderTheme === 'dark' ? (
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
