"use client"

import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import type { DirectorReconnectStatus } from "@/lib/director-reconnect-policy"
import type { StudioDirectorConnectionState } from "./studio-welcome"
import "./studio-director-header.css"

export interface StudioDirectorHeaderProps {
  connectionState: StudioDirectorConnectionState
  isLoadingSession?: boolean
  actions?: ReactNode
  /**
   * PASS2-DIRECTOR-CHAT PR C (flag NEXT_PUBLIC_STUDIO_CHAT_HEADER): the reconnect status the Director hook already reports,
   * passed through untouched. It only chooses words; with the flag off it is ignored.
   */
  reconnectStatus?: DirectorReconnectStatus
}

const CONNECTION_LABELS: Record<StudioDirectorConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
  error: "Connection error",
}

/**
 * PASS2-DIRECTOR-CHAT PR C (flag NEXT_PUBLIC_STUDIO_CHAT_HEADER, default off): the connection in plain words, from state the
 * hook already reports (`connectionState`, `reconnectStatus`). Nothing is inferred: "Connected" only while the socket is
 * open, and the three waiting/failed phrases only for the hook's own `scheduled`, `paused_offline` and `exhausted`.
 * NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB: `superseded` (only ever reported with that flag on) reads "Open in another tab" (the words of
 * SUPERSEDED_STATUS_TEXT in lib/studio-one-live-tab.ts; kept as a literal here so this file keeps its imports; test-studio-one-live-tab pins them equal).
 */
function chatHeaderConnection(
  connectionState: StudioDirectorConnectionState,
  reconnectStatus: DirectorReconnectStatus | undefined,
): { tone: string; text: string } {
  if (connectionState === "connected") return { tone: "ready", text: "Connected" }
  if (reconnectStatus === "superseded") return { tone: "superseded", text: "Open in another tab" }
  if (reconnectStatus === "scheduled") return { tone: "reconnecting", text: "Reconnecting…" }
  if (reconnectStatus === "paused_offline") return { tone: "offline", text: "Offline, will retry" }
  if (reconnectStatus === "exhausted") return { tone: "failed", text: "Couldn't reconnect" }
  if (connectionState === "connecting") return { tone: "connecting", text: CONNECTION_LABELS.connecting }
  if (connectionState === "error") return { tone: "error", text: CONNECTION_LABELS.error }
  return { tone: "disconnected", text: CONNECTION_LABELS.disconnected }
}

/** Persistent local identity. Connection describes the socket, not send availability. */
export function StudioDirectorHeader({ connectionState, isLoadingSession = false, actions, reconnectStatus }: StudioDirectorHeaderProps) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") return null
  // Flag off: `chatHeader` is undefined, so the three spreads below add nothing and the markup is what it always was.
  const chatHeader = process.env.NEXT_PUBLIC_STUDIO_CHAT_HEADER === "true"
    ? isLoadingSession
      ? { tone: "loading", text: "Loading conversation…" }
      : chatHeaderConnection(connectionState, reconnectStatus)
    : undefined
  return (
    <header data-studio-director-header="true" role="group" aria-label="Director conversation" {...(chatHeader ? { "data-studio-chat-header": "true" } : undefined)}>
      <span aria-hidden="true"><Sparkles size={13} /></span>
      <strong>Director</strong>
      <span role="status" aria-label="Director connection" aria-atomic="true" data-connection-state={isLoadingSession ? "loading" : connectionState} {...(chatHeader ? { "data-studio-chat-header-state": chatHeader.tone } : undefined)}>
        {chatHeader ? chatHeader.text : isLoadingSession ? "Loading conversation…" : CONNECTION_LABELS[connectionState]}
      </span>
      {actions}
    </header>
  )
}
