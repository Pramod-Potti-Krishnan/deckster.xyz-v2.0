"use client"

import React from 'react'
import {
  BadgeCheck,
  BookOpenCheck,
  Brush,
  ClipboardList,
  Compass,
  FileSearch,
  LayoutGrid,
  ListOrdered,
  Package,
  Palette,
  PenLine,
  ShieldCheck,
  Sparkles,
  SquarePlus,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { iconKeyForStage } from '@/lib/build-narration-heuristics'

/** Canvas v2 R2 — one icon per stage slug (keys from iconKeyForStage). */
const ICONS: Record<string, LucideIcon> = {
  framing: Compass,
  research: BookOpenCheck,
  outline: ListOrdered,
  slide_layouts: LayoutGrid,
  slide_research: FileSearch,
  theme: Palette,
  package: Package,
  plan: ClipboardList,
  validate: ShieldCheck,
  render: Brush,
  insert: SquarePlus,
  content: PenLine,
  qa: BadgeCheck,
  style: Wand2,
  default: Sparkles,
}

export function StageIcon({
  stage,
  className,
}: {
  stage: string | null | undefined
  className?: string
}) {
  const Icon = ICONS[iconKeyForStage(stage)] || Sparkles
  return <Icon className={className || 'h-3.5 w-3.5'} aria-hidden />
}
