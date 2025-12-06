"use client"

import { useState, useCallback, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CSSClassesInputProps {
  value: string[]
  onChange: (classes: string[]) => void
  disabled?: boolean
  placeholder?: string
}

// Validate CSS class name (basic validation)
const isValidClassName = (name: string): boolean => {
  if (!name || name.trim().length === 0) return false
  // CSS class names can't start with a digit, and can only contain letters, digits, hyphens, underscores
  return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(name.trim())
}

export function CSSClassesInput({
  value = [],
  onChange,
  disabled = false,
  placeholder = "Add class..."
}: CSSClassesInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addClass = useCallback((className: string) => {
    const trimmed = className.trim()
    if (trimmed && isValidClassName(trimmed) && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }, [value, onChange])

  const removeClass = useCallback((className: string) => {
    onChange(value.filter(c => c !== className))
  }, [value, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addClass(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last class when backspace is pressed on empty input
      removeClass(value[value.length - 1])
    }
  }, [inputValue, value, addClass, removeClass])

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addClass(inputValue)
    }
  }, [inputValue, addClass])

  return (
    <div className="space-y-1.5">
      {/* Tags display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((className) => (
            <span
              key={className}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                "bg-blue-600/20 text-blue-400 border border-blue-600/30",
                disabled && "opacity-50"
              )}
            >
              {className}
              {!disabled && (
                <button
                  onClick={() => removeClass(className)}
                  className="hover:text-blue-200 transition-colors"
                  type="button"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input field */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 bg-gray-800 rounded text-[10px] text-white",
          "focus:outline-none focus:ring-1 focus:ring-blue-500",
          "border border-transparent hover:border-gray-600 transition-colors",
          "placeholder:text-gray-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />

      {/* Helper text */}
      <p className="text-[9px] text-gray-500">
        Press Enter or comma to add
      </p>
    </div>
  )
}
