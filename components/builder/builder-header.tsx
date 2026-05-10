"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { History, Home, Menu } from "lucide-react"

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
      <header className="bg-gray-50 border-b h-12 flex-shrink-0">
        <div className="h-full px-4 flex items-center">
          <div className="flex items-center gap-4 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  aria-label="Open builder menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={onOpenChatHistory}
                >
                  <History className="h-4 w-4" />
                  Chat history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
