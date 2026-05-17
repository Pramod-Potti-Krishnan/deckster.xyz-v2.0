"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { Home, Menu } from "lucide-react"

export interface BuilderHeaderProps {
  wsError: any
  onOpenChatHistory: () => void
  toolbarSlotRef?: (el: HTMLDivElement | null) => void
}

export function BuilderHeader({
  wsError,
  onOpenChatHistory,
  toolbarSlotRef,
}: BuilderHeaderProps) {
  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 h-12 flex-shrink-0">
        <div className="h-full px-4 flex items-center">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenChatHistory}
              className="flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
              aria-label="Go home"
            >
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Portal target for presentation toolbar */}
          <div ref={toolbarSlotRef} className="flex-1 min-w-0 h-full overflow-hidden" />

          <div className="flex items-center gap-4 flex-shrink-0">
            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* Connection Error Alert */}
      {wsError && (
        <div className="px-4 py-2 bg-white border-b">
          <ConnectionError onRetry={() => window.location.reload()} />
        </div>
      )}
    </>
  )
}
