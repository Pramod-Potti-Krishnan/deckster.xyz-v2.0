"use client"

import { cn } from '@/lib/utils'

interface DividerProps {
  className?: string
  label?: string
}

export function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3 py-3", className)}>
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>
    )
  }

  return <div className={cn("h-px bg-gray-800 my-4", className)} />
}
