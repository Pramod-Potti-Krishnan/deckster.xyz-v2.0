"use client"

import { cn } from '@/lib/utils'

interface IconButtonProps {
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
  className?: string
  accentColor?: 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'indigo'
}

const ACCENT_COLORS = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  amber: 'bg-amber-600',
  purple: 'bg-purple-600',
  teal: 'bg-teal-600',
  indigo: 'bg-indigo-600',
}

export function IconButton({
  icon,
  onClick,
  disabled = false,
  active = false,
  title,
  className,
  accentColor = 'blue',
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        active
          ? cn(ACCENT_COLORS[accentColor], "text-white")
          : "text-gray-400 hover:text-white hover:bg-gray-700/50",
        className
      )}
    >
      {icon}
    </button>
  )
}
