"use client"

// STRAWMAN CHAT (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT, default off; lib/studio-strawman-chat.ts decides everything). Mounted only with the flag on:
//   StudioStrawmanChatLine     the chat's ONE quiet status line while a build is narrated and the stage is hidden ("Drafting your outline… 0:18"); nothing once the stage is open
import React, { useEffect, useState } from 'react'
import { strawmanChatLine } from '@/lib/studio-strawman-chat'
import './studio-strawman-chat.css'

export interface StudioStrawmanChatLineProps {
  narration: { active: boolean; phase: string; control: string; startedAt: number | null }
  /** The stage is open: the chat says nothing. */
  stageOpen: boolean
  autoProceed: boolean
  /** A held build is already said by a bar above the composer. */
  heldCovered: boolean
  loadingSession?: boolean
}

export function StudioStrawmanChatLine({ narration, stageOpen, autoProceed, heldCovered, loadingSession }: StudioStrawmanChatLineProps) {
  const [now, setNow] = useState(() => Date.now())
  const read = (at: number) => strawmanChatLine({ enabled: true, active: narration.active, phase: narration.phase, control: narration.control, startedAt: narration.startedAt, now: at, stageOpen, autoProceed, heldCovered })
  const running = read(now)?.running === true
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  const line = read(now)
  if (!line) return null
  return (
    <p data-studio-strawman-chat-line={narration.phase} role="status" aria-live="polite" hidden={loadingSession ? true : undefined}>
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      <span data-studio-strawman-chat-words="true">{line.words}</span>
      {line.elapsed ? <span data-studio-strawman-chat-elapsed="true" aria-hidden="true">{line.elapsed}</span> : null}
    </p>
  )
}
