// CHAT PARITY, WORKSPACE (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off): the icon of each workspace command's row in the "/" menu (the same lucide set and 3 x 3 size the other rows use).
// Kept apart from the composer glue so the menu (components/builder/chat/studio-chat-parity-viewer-menu.tsx) imports only icons.
import type React from 'react'
import { Brain, Clapperboard, Columns2, History, LayoutTemplate, Monitor, Moon, Sparkles, StickyNote, Sun } from 'lucide-react'
import type { WorkspaceName } from '@/lib/studio-chat-parity-workspace'

export const WORKSPACE_ICONS: Record<WorkspaceName, React.ComponentType<{ className?: string }>> = {
  kg: Brain, template: LayoutTemplate, 'template-mode': Sparkles, notes: StickyNote, dark: Moon, light: Sun, system: Monitor, intro: Clapperboard, pane: Columns2, history: History,
}
