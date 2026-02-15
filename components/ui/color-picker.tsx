"use client"

import { useRef, useState } from 'react'
import { cn, normalizeColorToHex } from '@/lib/utils'
import { X } from 'lucide-react'

export interface CompactColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  /** Allow "No Fill" / transparent option */
  allowNoFill?: boolean
  /** Custom preset colors (overrides default palette) */
  presetColors?: string[]
}

// Checkerboard pattern for transparent color display
const TRANSPARENT_BG = "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"

// Default color palette - common presentation colors
const DEFAULT_PALETTE = [
  // Row 1: Blacks & Grays
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  // Row 2: Theme colors
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  // Row 3: Lighter variants
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  // Row 4: Darker variants
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
]

/**
 * Compact color picker with palette support:
 * [Label] ─────────────── [swatch][rainbow]
 *
 * Click on swatch to open palette dropdown
 * Click on rainbow to open OS/browser color picker
 *
 * - Swatch shows current color and opens palette on click
 * - Rainbow button opens OS/browser color picker for custom colors
 * - Palette includes preset colors and optional "No Fill"
 */
export function CompactColorPicker({
  label,
  value,
  onChange,
  disabled = false,
  allowNoFill = false,
  presetColors = DEFAULT_PALETTE
}: CompactColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [showPalette, setShowPalette] = useState(false)

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handlePaletteSelect = (color: string) => {
    onChange(color)
    setShowPalette(false)
  }

  const handleNoFill = () => {
    onChange('transparent')
    setShowPalette(false)
  }

  const isTransparent = value === 'transparent' || value === ''

  return (
    <div className="flex items-center justify-between py-1 relative">
      {label && (
        <span className="text-sm text-gray-300">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        {/* Current color swatch - click to open palette */}
        <button
          onClick={() => !disabled && setShowPalette(!showPalette)}
          disabled={disabled}
          className={cn(
            "w-12 h-6 rounded border border-gray-600 cursor-pointer hover:border-gray-400 transition-colors",
            isTransparent && TRANSPARENT_BG,
            disabled && "cursor-not-allowed opacity-50"
          )}
          style={!isTransparent ? { backgroundColor: value } : {}}
          title="Click to choose from palette"
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
          value={isTransparent ? '#000000' : normalizeColorToHex(value)}
          onChange={handleColorChange}
          disabled={disabled}
          className="sr-only"
        />

        {/* Color Palette Dropdown */}
        {showPalette && (
          <div
            className="absolute right-0 top-full mt-1 z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 p-2"
            style={{ width: '220px' }}
          >
            {/* No Fill option */}
            {allowNoFill && (
              <button
                onClick={handleNoFill}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 transition-colors mb-2",
                  isTransparent && "bg-gray-700"
                )}
              >
                <div className={cn("w-5 h-5 rounded border border-gray-500 flex items-center justify-center", TRANSPARENT_BG)}>
                  <X className="w-3 h-3 text-red-500" />
                </div>
                <span className="text-xs text-gray-300">No Fill</span>
              </button>
            )}

            {/* Color grid */}
            <div className="grid grid-cols-10 gap-0.5">
              {presetColors.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  onClick={() => handlePaletteSelect(color)}
                  className={cn(
                    "w-5 h-5 rounded-sm border hover:scale-110 transition-transform",
                    value === color ? "border-white ring-1 ring-white" : "border-gray-600"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            {/* Close on click outside */}
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setShowPalette(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Keep backward compatibility - export as both names
export { CompactColorPicker as ColorPicker }
