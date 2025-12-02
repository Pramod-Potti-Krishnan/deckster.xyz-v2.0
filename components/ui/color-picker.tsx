"use client"

import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface CompactColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

// Checkerboard pattern for transparent color display
const TRANSPARENT_BG = "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"

/**
 * Compact color picker matching Keynote's design:
 * [Label] ─────────────── [swatch][rainbow]
 *
 * - Swatch shows current color
 * - Rainbow button opens OS/browser color picker
 */
export function CompactColorPicker({
  label,
  value,
  onChange,
  disabled = false
}: CompactColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const isTransparent = value === 'transparent' || value === ''

  return (
    <div className="flex items-center justify-between py-1">
      {label && (
        <span className="text-sm text-gray-300">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        {/* Current color swatch */}
        <div
          className={cn(
            "w-12 h-6 rounded border border-gray-600",
            isTransparent && TRANSPARENT_BG
          )}
          style={!isTransparent ? { backgroundColor: value } : {}}
        />
        {/* Rainbow button - triggers hidden color input */}
        <button
          onClick={() => colorInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "w-6 h-6 rounded-full",
            "bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]",
            "border border-gray-500",
            "hover:scale-110 transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title="Choose custom color"
        />
        {/* Hidden native color input */}
        <input
          ref={colorInputRef}
          type="color"
          value={isTransparent ? '#000000' : value}
          onChange={handleColorChange}
          disabled={disabled}
          className="sr-only"
        />
      </div>
    </div>
  )
}

// Keep backward compatibility - export as both names
export { CompactColorPicker as ColorPicker }
