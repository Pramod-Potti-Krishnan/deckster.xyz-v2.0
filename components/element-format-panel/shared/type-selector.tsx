"use client"

import { cn } from '@/lib/utils'

interface TypeSelectorProps<T extends string> {
  label: string
  options: { type: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  columns?: number
}

export function TypeSelector<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  columns = 2,
}: TypeSelectorProps<T>) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {options.map(({ type, label: optionLabel }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            disabled={disabled}
            className={cn(
              "px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              value === type
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            )}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
