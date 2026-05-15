"use client"

import { useEffect, useRef, useState } from "react"
import {
  AGENT_TEAM,
  type AgentId,
} from "@/lib/marketing/homepage-v2-content"
import type { ChatLineSpec, ChoreoState, SpeakerId } from "./types"

const AGENT_BY_ID = new Map(AGENT_TEAM.map((a) => [a.id, a]))

function speakerLabel(id: SpeakerId): { name: string; color: string } {
  if (id === "user") return { name: "You", color: "#ffffff" }
  const meta = AGENT_BY_ID.get(id as AgentId)
  return {
    name: meta?.name ?? id,
    color: meta?.color ?? "#ffffff",
  }
}

interface ChatPanelProps {
  state: ChoreoState
  reducedMotion: boolean
}

export function ChatPanel({ state, reducedMotion }: ChatPanelProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom whenever a new line lands.
  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [state.chatLines.length, state.seq, reducedMotion])

  return (
    <div
      ref={scrollerRef}
      className="relative h-full overflow-y-auto rounded-xl border border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md scrollbar-thin scrollbar-thumb-white/10"
      aria-label="Live agent conversation"
    >
      {state.chatLines.length === 0 ? (
        <p className="px-1 py-2 font-mono text-xs text-white/30">
          waiting for input…
        </p>
      ) : null}

      <ul className="space-y-3">
        {state.chatLines.map((line) => (
          <ChatBubble
            key={`${state.seq}-${line.id}`}
            line={line}
            reducedMotion={reducedMotion}
          />
        ))}
      </ul>
    </div>
  )
}

interface ChatBubbleProps {
  line: ChatLineSpec
  reducedMotion: boolean
}

function ChatBubble({ line, reducedMotion }: ChatBubbleProps) {
  const { name, color } = speakerLabel(line.speaker)
  const isUser = line.speaker === "user"
  const [revealed, setRevealed] = useState(reducedMotion ? line.text.length : 0)

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(line.text.length)
      return
    }
    if (line.text.length === 0) return
    const totalChars = line.text.length
    const stepMs = Math.max(20, line.typeMs / totalChars)
    const startedAt = performance.now()
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - startedAt
      const next = Math.min(totalChars, Math.floor(elapsed / stepMs))
      setRevealed(next)
      if (next < totalChars) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [line.text, line.typeMs, reducedMotion])

  const done = revealed >= line.text.length
  const textShown = line.text.slice(0, revealed)

  return (
    <li
      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
    >
      <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {!isUser ? (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span style={{ color: isUser ? "#ffffff" : color }}>{name}</span>
      </div>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2 font-mono text-[12px] leading-relaxed sm:text-[13px] ${
          isUser
            ? "rounded-tr-sm bg-white/[0.08] text-white"
            : "rounded-tl-sm bg-white/[0.04] text-white/85"
        }`}
        style={
          isUser
            ? undefined
            : { boxShadow: `inset 0 0 0 1px ${color}33` }
        }
      >
        <span>{textShown}</span>
        {!done ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-3 w-1 -translate-y-px bg-white/70 align-middle motion-reduce:hidden animate-pulse"
          />
        ) : null}
      </div>
    </li>
  )
}
