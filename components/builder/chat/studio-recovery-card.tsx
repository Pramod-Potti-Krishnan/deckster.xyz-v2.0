"use client"

import { ShieldCheck } from "lucide-react"
import type { StudioChatRecoveryCard } from "@/lib/studio-chat-recovery"
import "./studio-recovery-card.css"

/**
 * PASS2-DIRECTOR-CHAT PR D, item 7 (flag NEXT_PUBLIC_STUDIO_CHAT_RECOVERY, Studio shell only, default off).
 * A calm card at the end of the transcript when something interrupted Director. Presentation only: words in, markup out. It has no
 * button, no handler and no effect, so it cannot send, retry or reconnect anything; the existing message box stays the only way to
 * resend, and the existing StudioDirectorNotice above the transcript is untouched.
 */
export function StudioRecoveryCard({ card }: { card: StudioChatRecoveryCard }) {
  return (
    <div data-studio-chat-recovery={card.kind} role="note" aria-label="Director was interrupted">
      <ShieldCheck size={14} aria-hidden="true" />
      <div>
        <p data-studio-chat-recovery-part="title">{card.title}</p>
        <p data-studio-chat-recovery-part="body">{card.body}</p>
      </div>
    </div>
  )
}
