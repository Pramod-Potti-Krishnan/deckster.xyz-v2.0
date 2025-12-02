"use client"

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  swatches?: string[]
  disabled?: boolean
  label?: string
  showCurrentColor?: boolean
}

// Default color swatches - expanded palette
const DEFAULT_SWATCHES = [
  // Grayscale
  '#000000', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af',
  '#d1d5db', '#e5e7eb', '#f3f4f6', '#f9fafb', '#ffffff', 'transparent',
  // Reds
  '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171',
  // Oranges
  '#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c',
  // Yellows
  '#713f12', '#854d0e', '#a16207', '#ca8a04', '#eab308', '#facc15',
  // Greens
  '#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80',
  // Teals
  '#134e4a', '#115e59', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf',
  // Blues
  '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  // Indigos
  '#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#818cf8',
  // Purples
  '#581c87', '#6b21a8', '#7e22ce', '#9333ea', '#a855f7', '#c084fc',
  // Pinks
  '#831843', '#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6',
]

export function ColorPicker({
  value,
  onChange,
  swatches = DEFAULT_SWATCHES,
  disabled = false,
  label,
  showCurrentColor = true
}: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value)
  const [hexInput, setHexInput] = useState(value)
  const [isCustomOpen, setIsCustomOpen] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Sync hex input with value
  useEffect(() => {
    setHexInput(value)
    setCustomColor(value)
  }, [value])

  const handleSwatchClick = (color: string) => {
    onChange(color)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    setHexInput(color)
    onChange(color)
  }

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setHexInput(input)

    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
      setCustomColor(input)
      onChange(input)
    }
  }

  const handleHexInputBlur = () => {
    // Ensure valid hex on blur
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(value)
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
      )}

      {/* Current color indicator */}
      {showCurrentColor && (
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              "w-8 h-8 rounded-lg border border-gray-600",
              value === 'transparent' && "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
            )}
            style={value !== 'transparent' ? { backgroundColor: value } : {}}
          />
          <span className="text-xs text-gray-400">{value}</span>
        </div>
      )}

      {/* Swatches Grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {swatches.map((color, index) => (
          <button
            key={`${color}-${index}`}
            onClick={() => handleSwatchClick(color)}
            disabled={disabled}
            className={cn(
              "aspect-square rounded border-2 hover:scale-110 transition-transform disabled:opacity-50",
              value === color ? "border-blue-500" : "border-transparent",
              color === 'transparent' && "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
            )}
            style={color !== 'transparent' ? { backgroundColor: color } : {}}
            title={color === 'transparent' ? 'Transparent' : color}
          />
        ))}
      </div>

      {/* Custom Color Button */}
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            Custom Color...
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 bg-gray-800 border-gray-700" side="right" align="start">
          <div className="space-y-3">
            <div className="text-xs text-gray-400 font-medium">Custom Color</div>

            {/* Color spectrum picker */}
            <div className="relative">
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-full h-32 rounded-lg cursor-pointer border-0"
                style={{ padding: 0 }}
              />
            </div>

            {/* Hex input */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border border-gray-600 flex-shrink-0"
                style={{ backgroundColor: customColor }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                onBlur={handleHexInputBlur}
                placeholder="#000000"
                className="flex-1 px-2 py-1.5 bg-gray-700 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Apply button */}
            <button
              onClick={() => {
                onChange(customColor)
                setIsCustomOpen(false)
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
            >
              Apply Color
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
