"use client"

import { cn } from '@/lib/utils'

interface ButtonGroupOption<T> {
  value: T
  label: string
  icon?: React.ReactNode
  title?: string
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  accentColor?: 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'indigo' | 'gray'
  size?: 'sm' | 'md'
  className?: string
}

const ACCENT_COLORS = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  amber: 'bg-amber-600',
  purple: 'bg-purple-600',
  teal: 'bg-teal-600',
  indigo: 'bg-indigo-600',
  gray: 'bg-gray-600',
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  accentColor = 'gray',
  size = 'md',
  className,
}: ButtonGroupProps<T>) {
  return (
    <div
      className={cn(
        "flex bg-gray-800/60 rounded-md p-[2px]",
        size === 'sm' ? 'h-6' : 'h-7',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            title={option.title || option.label}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 rounded transition-all",
              "text-[11px] font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected
                ? cn(ACCENT_COLORS[accentColor], "text-white shadow-sm")
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
            )}
          >
            {option.icon}
            {!option.icon && option.label}
          </button>
        )
      })}
    </div>
  )
}
