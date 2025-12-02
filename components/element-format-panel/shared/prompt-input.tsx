"use client"

import { cn } from '@/lib/utils'
import { PromptInputProps } from '../types'

export function PromptInput({
  value,
  onChange,
  placeholder = "Describe what you want...",
  disabled = false,
  rows = 3,
}: PromptInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={cn(
        "w-full px-3 py-2 bg-gray-800 rounded-lg text-sm",
        "placeholder:text-gray-500 resize-none",
        "focus:outline-none focus:ring-1 focus:ring-blue-500",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    />
  )
}
