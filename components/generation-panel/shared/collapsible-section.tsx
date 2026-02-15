'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function CollapsibleSection({ title, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 py-2 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  )
}
