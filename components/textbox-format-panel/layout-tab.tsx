"use client"

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { cn } from '@/lib/utils'

interface LayoutTabProps {
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
}

const PADDING_OPTIONS = ['0', '4', '8', '12', '16', '20', '24', '32']

const BORDER_STYLES = [
  { label: 'None', value: 'none' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }
]

const BORDER_WIDTHS = ['0', '1', '2', '3', '4']

const BORDER_RADIUS_OPTIONS = ['0', '4', '8', '12', '16', '24', '9999']

const BACKGROUND_COLORS = [
  'transparent',
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db',
  '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff',
  '#fef2f2', '#ecfdf5', '#eff6ff', '#fdf4ff', '#f5f3ff'
]

const BORDER_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899'
]

export function LayoutTab({ formatting, onSendCommand, isApplying, elementId }: LayoutTabProps) {
  const [padding, setPadding] = useState('8')
  const [borderStyle, setBorderStyle] = useState('none')
  const [borderWidth, setBorderWidth] = useState('1')
  const [borderColor, setBorderColor] = useState('#d1d5db')
  const [borderRadius, setBorderRadius] = useState('4')
  const [backgroundColor, setBackgroundColor] = useState('transparent')
  const [isPaddingDropdownOpen, setIsPaddingDropdownOpen] = useState(false)
  const [isRadiusDropdownOpen, setIsRadiusDropdownOpen] = useState(false)

  // Set padding
  const handlePaddingChange = async (value: string) => {
    setPadding(value)
    setIsPaddingDropdownOpen(false)
    await onSendCommand('setTextBoxPadding', { padding: `${value}px` })
  }

  // Set border
  const handleBorderChange = async (
    style?: string,
    width?: string,
    color?: string,
    radius?: string
  ) => {
    const newStyle = style ?? borderStyle
    const newWidth = width ?? borderWidth
    const newColor = color ?? borderColor
    const newRadius = radius ?? borderRadius

    if (style) setBorderStyle(style)
    if (width) setBorderWidth(width)
    if (color) setBorderColor(color)
    if (radius) {
      setBorderRadius(radius)
      setIsRadiusDropdownOpen(false)
    }

    await onSendCommand('setTextBoxBorder', {
      borderStyle: newStyle,
      borderWidth: `${newWidth}px`,
      borderColor: newColor,
      borderRadius: `${newRadius}px`
    })
  }

  // Set background
  const handleBackgroundChange = async (color: string) => {
    setBackgroundColor(color)
    await onSendCommand('setTextBoxBackground', { backgroundColor: color })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Text Inset (Padding) */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Text Inset</label>
        <div className="relative">
          <button
            onClick={() => setIsPaddingDropdownOpen(!isPaddingDropdownOpen)}
            disabled={isApplying}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            <span>{padding}px</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {isPaddingDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-10">
              {PADDING_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => handlePaddingChange(value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors",
                    value === padding && "bg-gray-700"
                  )}
                >
                  {value}px
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Border Style */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Border Style</label>
        <div className="flex bg-gray-800 rounded-lg p-1">
          {BORDER_STYLES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleBorderChange(value)}
              disabled={isApplying}
              className={cn(
                "flex-1 py-2 text-xs rounded transition-colors",
                borderStyle === value ? "bg-gray-600" : "hover:bg-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Border Width */}
      {borderStyle !== 'none' && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Border Width</label>
          <div className="flex bg-gray-800 rounded-lg p-1">
            {BORDER_WIDTHS.map((width) => (
              <button
                key={width}
                onClick={() => handleBorderChange(undefined, width)}
                disabled={isApplying}
                className={cn(
                  "flex-1 py-2 text-xs rounded transition-colors",
                  borderWidth === width ? "bg-gray-600" : "hover:bg-gray-700"
                )}
              >
                {width}px
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Border Color */}
      {borderStyle !== 'none' && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Border Color</label>
          <div className="grid grid-cols-7 gap-1.5">
            {BORDER_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleBorderChange(undefined, undefined, color)}
                disabled={isApplying}
                className={cn(
                  "aspect-square rounded border-2 hover:scale-110 transition-transform",
                  borderColor === color ? "border-blue-500" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Border Radius */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Corner Radius</label>
        <div className="relative">
          <button
            onClick={() => setIsRadiusDropdownOpen(!isRadiusDropdownOpen)}
            disabled={isApplying}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            <span>{borderRadius === '9999' ? 'Full' : `${borderRadius}px`}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {isRadiusDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-10">
              {BORDER_RADIUS_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => handleBorderChange(undefined, undefined, undefined, value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors",
                    value === borderRadius && "bg-gray-700"
                  )}
                >
                  {value === '9999' ? 'Full (pill)' : `${value}px`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Background</label>
        <div className="grid grid-cols-5 gap-2">
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleBackgroundChange(color)}
              disabled={isApplying}
              className={cn(
                "w-full aspect-square rounded-lg border-2 hover:scale-110 transition-transform",
                backgroundColor === color ? "border-blue-500" : "border-gray-600",
                color === 'transparent' && "bg-gray-700"
              )}
              style={color !== 'transparent' ? { backgroundColor: color } : {}}
              title={color === 'transparent' ? 'No background' : color}
            >
              {color === 'transparent' && (
                <span className="text-xs text-gray-400">-</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Opacity</label>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="100"
          disabled={isApplying}
          onChange={async (e) => {
            const opacity = parseInt(e.target.value) / 100
            await onSendCommand('setTextBoxOpacity', { opacity })
          }}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  )
}
