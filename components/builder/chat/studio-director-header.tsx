"use client"

import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import type { DirectorReconnectStatus } from "@/lib/director-reconnect-policy"
import type { StudioDirectorConnectionState } from "./studio-welcome"
import "./studio-director-header.css"
import "./studio-director-mark-trim.css" // STUDIO-DIRECTOR-MARK-TRIM
import { studioDirectorMark } from "@/lib/studio-director-mark" // STUDIO-DIRECTOR-MARK-TRIM

export interface StudioDirectorHeaderProps {
  connectionState: StudioDirectorConnectionState
  isLoadingSession?: boolean
  actions?: ReactNode
  /**
   * PASS2-DIRECTOR-CHAT PR C (flag NEXT_PUBLIC_STUDIO_CHAT_HEADER): the reconnect status the Director hook already reports,
   * passed through untouched. It only chooses words; with the flag off it is ignored.
   */
  reconnectStatus?: DirectorReconnectStatus
  /**
   * PASS2B J1-02 (flag NEXT_PUBLIC_STUDIO_CHAT_RECONNECT, default off): the page's own `connect()`, the same explicit reconnect the composer does when
   * you send while disconnected and "Use here" does for a paused tab. Passed only with the flag on; drawn only once the retries are used up.
   */
  onReconnect?: () => void
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
export function StudioDirectorHeader({ connectionState, isLoadingSession = false, actions, reconnectStatus, onReconnect }: StudioDirectorHeaderProps) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") return null
  // Flag off: `chatHeader` is undefined, so the three spreads below add nothing and the markup is what it always was.
  const chatHeader = process.env.NEXT_PUBLIC_STUDIO_CHAT_HEADER === "true"
    ? isLoadingSession
      ? { tone: "loading", text: "Loading conversation…" }
      : chatHeaderConnection(connectionState, reconnectStatus)
    : undefined
  // PASS2B J1-02 (flag NEXT_PUBLIC_STUDIO_CHAT_RECONNECT, default off): once every bounded retry is used up (`exhausted`, the one state where nothing
  // happens by itself) a small "Reconnect" button calls the page's existing connect(). It shares the `actions` slot, so with the flag off the header's
  // children are exactly what they were. No send, no state and no effect is added; a click only opens a new socket, as sending from the box already does.
  const reconnect = onReconnect && process.env.NEXT_PUBLIC_STUDIO_CHAT_RECONNECT === 'true' && !isLoadingSession
    && (connectionState === 'disconnected' || connectionState === 'error') && reconnectStatus === 'exhausted'
    ? <button type="button" data-studio-chat-reconnect="true" aria-label="Reconnect to Director" onClick={() => onReconnect()}>Reconnect</button>
    : null
  const markTrim = studioDirectorMark() // STUDIO-DIRECTOR-MARK-TRIM: null with the flag off (the star, as today); { src: null } draws nothing; { src } draws the real Deckster mark (lib/studio-director-mark.ts)
  return (
    <header data-studio-director-header="true" role="group" aria-label="Director conversation" {...(chatHeader ? { "data-studio-chat-header": "true" } : undefined)}>
      {markTrim ? ( // STUDIO-DIRECTOR-MARK-TRIM
        markTrim.src && <span aria-hidden="true"><img data-studio-director-mark="deckster" src={markTrim.src} alt="" width={13} height={13} /></span> // STUDIO-DIRECTOR-MARK-TRIM
      ) : ( // STUDIO-DIRECTOR-MARK-TRIM
      <span aria-hidden="true"><Sparkles size={13} /></span>
      ) /* STUDIO-DIRECTOR-MARK-TRIM */}
      <strong>Director</strong>
      <span role="status" aria-label="Director connection" aria-atomic="true" data-connection-state={isLoadingSession ? "loading" : connectionState} {...(chatHeader ? { "data-studio-chat-header-state": chatHeader.tone } : undefined)}>
        {chatHeader ? chatHeader.text : isLoadingSession ? "Loading conversation…" : CONNECTION_LABELS[connectionState]}
      </span>
      {reconnect ? <>{reconnect}{actions}</> : actions}
    </header>
  )
}
