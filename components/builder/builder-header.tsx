"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ConnectionError } from "@/components/connection-error"
import {
  ContentContextDisplay,
  ContentContext,
} from '@/components/content-context-form'
import {
  Sparkles,
  Settings,
  Menu,
  SlidersHorizontal,
} from "lucide-react"

export interface BuilderHeaderProps {
  connected: boolean
  connecting: boolean
  wsError: any
  hasGeneratedContent: boolean
  contentContext: ContentContext
  showContentContextPanel: boolean
  onToggleContentContextPanel: () => void
  onOpenSettings: () => void
  onOpenChatHistory: () => void
}

export function BuilderHeader({
  connected,
  connecting,
  wsError,
  hasGeneratedContent,
  contentContext,
  showContentContextPanel,
  onToggleContentContextPanel,
  onOpenSettings,
  onOpenChatHistory,
}: BuilderHeaderProps) {
  return (
    <>
      <header className="bg-white border-b h-16 flex-shrink-0">
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

            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 transition-transform group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                deckster
              </span>
            </Link>
            <Badge variant="secondary" className="hidden sm:flex">
              Director v3.4
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Content Context Display (when set) */}
            {hasGeneratedContent && (
              <ContentContextDisplay context={contentContext} className="hidden md:flex text-xs" />
            )}
            {/* Connection Status */}
            <Badge
              variant={connected ? "default" : connecting ? "secondary" : "destructive"}
              className="hidden sm:flex"
            >
              {connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}
            </Badge>
            {/* Content Context Settings */}
            <Button
              variant={showContentContextPanel ? "secondary" : "ghost"}
              size="icon"
              onClick={onToggleContentContextPanel}
              title="Presentation Settings (Audience, Purpose, Duration)"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
            >
              <Settings className="h-5 w-5" />
            </Button>
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
