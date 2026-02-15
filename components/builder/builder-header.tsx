"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import { Menu } from "lucide-react"

export interface BuilderHeaderProps {
  wsError: any
  onOpenChatHistory: () => void
}

export function BuilderHeader({
  wsError,
  onOpenChatHistory,
}: BuilderHeaderProps) {
  return (
    <>
      <header className="bg-white border-b h-12 flex-shrink-0">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu - Chat History */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenChatHistory}
              className="flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
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
