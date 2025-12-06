"use client"

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption<T> {
  value: T
  label: string
}

interface PanelSelectProps<T extends string> {
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function PanelSelect<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select...",
  className,
}: PanelSelectProps<T>) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className={cn(
          "w-full h-7 px-2 pr-7 appearance-none",
          "bg-gray-800/60 rounded-md",
          "border border-transparent hover:border-gray-700 focus:border-gray-600",
          "text-[11px] text-white",
          "focus:outline-none transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {!value && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
    </div>
  )
}
