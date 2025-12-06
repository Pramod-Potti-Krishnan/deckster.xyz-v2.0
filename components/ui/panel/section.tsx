"use client"

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PanelSectionProps {
  title?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}

export function PanelSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!collapsible) {
    return (
      <div className={cn("space-y-3", className)}>
        {title && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {title}
            </span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
        )}
        {children}
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-2 group"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-gray-500 group-hover:text-gray-300 transition-colors" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500 group-hover:text-gray-300 transition-colors" />
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
          {title}
        </span>
        <div className="flex-1 h-px bg-gray-800" />
      </button>
      {isOpen && (
        <div className="space-y-3 pb-1">
          {children}
        </div>
      )}
    </div>
  )
}
