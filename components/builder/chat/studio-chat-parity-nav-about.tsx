"use client"

// CHAT PARITY, NAVIGATION (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off): /about opens the existing About dialog (components/studio-about-dialog.tsx, the one the account menu's About opens). The open state is the one
// lib/studio-chat-parity-nav.ts keeps; this component only draws the dialog from it, and is mounted by the composer hook (so only with the flag on).
import { useSyncExternalStore } from 'react'
import { StudioAboutDialog } from '@/components/studio-about-dialog'
import { aboutSnapshot, setAboutOpen, subscribeAbout } from '@/lib/studio-chat-parity-nav'

export function ChatNavAbout() {
  const open = useSyncExternalStore(subscribeAbout, aboutSnapshot, () => false)
  return <StudioAboutDialog open={open} onOpenChange={setAboutOpen} />
}
