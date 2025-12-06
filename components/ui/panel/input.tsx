"use client"

import { cn } from '@/lib/utils'

interface PanelInputProps {
  type?: 'text' | 'number'
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  suffix?: string
  prefix?: string
  disabled?: boolean
  min?: number
  max?: number
  className?: string
  inputClassName?: string
}

export function PanelInput({
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  suffix,
  prefix,
  disabled = false,
  min,
  max,
  className,
  inputClassName,
}: PanelInputProps) {
  return (
    <div
      className={cn(
        "flex items-center h-7 bg-gray-800/60 rounded-md",
        "border border-transparent hover:border-gray-700 focus-within:border-gray-600",
        "transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {prefix && (
        <span className="pl-2 text-[10px] text-gray-500">{prefix}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={cn(
          "flex-1 min-w-0 px-2 py-1 bg-transparent",
          "text-[11px] text-white placeholder:text-gray-600",
          "focus:outline-none",
          type === 'number' && "text-right",
          inputClassName
        )}
      />
      {suffix && (
        <span className="pr-2 text-[10px] text-gray-500">{suffix}</span>
      )}
    </div>
  )
}
