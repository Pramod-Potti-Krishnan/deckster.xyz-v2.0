// CHAT PARITY, MORE (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off): the icon of each remaining command's row in the "/" menu (the same lucide set and 3 x 3 size the other rows use).
// Kept apart from the composer glue so the menu (components/builder/chat/studio-chat-parity-viewer-menu.tsx) imports only icons.
import type React from 'react'
import { ArrowLeftRight, Gauge, MessageCircleQuestion, Search, Trash2 } from 'lucide-react'
import type { MoreName } from '@/lib/studio-chat-parity-more'

export const MORE_ICONS: Record<MoreName, React.ComponentType<{ className?: string }>> = {
  'delete-theme': Trash2, 'delete-template': Trash2, model: Gauge, 'kg-search': Search, ask: MessageCircleQuestion, 'switch-template': ArrowLeftRight,
}
