"use client"

import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"
import type { StudioDirectorConnectionState } from "./studio-welcome"
import "./studio-director-header.css"

export interface StudioDirectorHeaderProps {
  connectionState: StudioDirectorConnectionState
  isLoadingSession?: boolean
  /** Optional trailing actions (Director call entry, behind its own flag). */
  actions?: ReactNode
}

const CONNECTION_LABELS: Record<StudioDirectorConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
  error: "Connection error",
}

/** Persistent local identity. Connection describes the socket, not send availability. */
export function StudioDirectorHeader({ connectionState, isLoadingSession = false, actions }: StudioDirectorHeaderProps) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") return null
  return (
    <header data-studio-director-header="true" role="group" aria-label="Director conversation">
      <span aria-hidden="true"><Sparkles size={13} /></span>
      <strong>Director</strong>
      <span role="status" aria-label="Director connection" aria-atomic="true" data-connection-state={isLoadingSession ? "loading" : connectionState}>
        {isLoadingSession ? "Loading conversation…" : CONNECTION_LABELS[connectionState]}
      </span>
      {actions}
    </header>
  )
}
