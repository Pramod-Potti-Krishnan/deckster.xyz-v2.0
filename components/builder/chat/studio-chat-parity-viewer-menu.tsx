"use client"

// CHAT PARITY, VIEWER (NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS, default off; needs NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the rows of the "/" menu for the viewer commands, in three groups (Slides · View · Deck).
// Presentation only: lib/studio-chat-parity-viewer.ts decides every row (its words, whether it can run now, why not). The rows sit on the same surface and take the same row props as the existing
// commands, so the arrows, Enter, Tab, hover and the ARIA ids work through the one index the composer's menu already keeps. A row that cannot run says why in place of its description and is marked
// aria-disabled; picking it does nothing and the menu stays open, so a reason is always on screen.
import React from 'react'
import { ChevronLeft, ChevronRight, Eye, FilePlus, Grid2x2, Hash, Layers, Layout, Monitor, Palette, PanelLeft, Pencil, Play, RotateCcw, Save, Square } from 'lucide-react'
import type { ParityGroup, ParityName, ParityRow } from '@/lib/studio-chat-parity-viewer'
import '../studio-chat-parity-viewer.css'
import { WORKSPACE_ICONS } from '@/components/builder/chat/studio-chat-parity-workspace-icons' // CHAT-PARITY-WORKSPACE

const ICONS: Record<ParityName, React.ComponentType<{ className?: string }>> = {
  goto: Hash, next: ChevronRight, prev: ChevronLeft, 'blank-slide': FilePlus, layout: Layout,
  present: Play, edit: Pencil, view: Eye, rail: PanelLeft, grid: Grid2x2, borders: Square,
  save: Save, discard: RotateCcw, version: Layers, theme: Palette, canvas: Monitor,
  ...WORKSPACE_ICONS, // CHAT-PARITY-WORKSPACE: the workspace commands' rows (the Workspace group)
}

export interface ChatParityRowsProps {
  rows: ParityRow[]
  /** The index of the first of these rows in the menu's one list (the existing commands come first). */
  offset: number
  /** The menu's own row props for an index (id, role, hover, pick, class): one source for every row. */
  rowProps: (index: number) => Record<string, unknown>
  headingClass: string
}

export function ChatParityRows({ rows, offset, rowProps, headingClass }: ChatParityRowsProps) {
  const out: React.ReactNode[] = []
  let group: ParityGroup | null = null
  rows.forEach((row, index) => {
    if (row.group !== group) {
      group = row.group
      out.push(<p key={`heading:${row.group}`} role="presentation" data-studio-v4-type-role="mention-heading" data-studio-chat-commands-heading={row.group.toLowerCase()} className={headingClass}>{row.group}</p>)
    }
    const Icon = ICONS[row.command]
    const said = row.hint ?? row.disabled ?? row.blurb
    const off = Boolean(row.hint || row.disabled)
    out.push(
      <button key={row.key} {...rowProps(offset + index)} data-studio-chat-command={row.command} data-studio-chat-parity="true" aria-disabled={off ? 'true' : undefined}
        data-studio-chat-parity-hint={row.hint ? 'true' : undefined} aria-label={`${row.label}: ${said}`}>
        <Icon className="h-3 w-3 shrink-0" />
        <span data-studio-v4-type-role="mention-number" className="font-medium shrink-0">{row.label}</span>
        <span className="truncate text-gray-500 dark:text-slate-400">{said}</span>
      </button>,
    )
  })
  return <>{out}</>
}
