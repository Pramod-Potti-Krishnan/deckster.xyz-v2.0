"use client"

import { cn } from '@/lib/utils'

interface ControlRowProps {
  label: string
  children: React.ReactNode
  hint?: string
  className?: string
  labelWidth?: 'sm' | 'md' | 'lg'
}

const LABEL_WIDTHS = {
  sm: 'w-12',
  md: 'w-[72px]',
  lg: 'w-24',
}

export function ControlRow({
  label,
  children,
  hint,
  className,
  labelWidth = 'md',
}: ControlRowProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 min-h-[28px]">
        <span className={cn(
          "text-[11px] text-gray-400 flex-shrink-0",
          LABEL_WIDTHS[labelWidth]
        )}>
          {label}
        </span>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
      {hint && (
        <p className="text-[9px] text-gray-600 pl-[80px]">{hint}</p>
      )}
    </div>
  )
}
