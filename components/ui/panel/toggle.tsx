"use client"

import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  accentColor?: 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'indigo'
  size?: 'sm' | 'md'
}

const ACCENT_COLORS = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  amber: 'bg-amber-600',
  purple: 'bg-purple-600',
  teal: 'bg-teal-600',
  indigo: 'bg-indigo-600',
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  accentColor = 'blue',
  size = 'md',
}: ToggleProps) {
  const dimensions = size === 'sm'
    ? { track: 'w-8 h-[18px]', thumb: 'h-[14px] w-[14px]', translate: 'translate-x-[14px]' }
    : { track: 'w-9 h-5', thumb: 'h-4 w-4', translate: 'translate-x-4' }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors duration-150",
        dimensions.track,
        checked ? ACCENT_COLORS[accentColor] : "bg-gray-700",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-150",
          dimensions.thumb,
          checked ? dimensions.translate : "translate-x-1"
        )}
      />
    </button>
  )
}
