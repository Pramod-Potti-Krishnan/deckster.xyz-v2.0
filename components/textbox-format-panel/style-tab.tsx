"use client"

import { useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ChevronDown
} from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { cn } from '@/lib/utils'

interface StyleTabProps {
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
}

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Roboto',
  'Open Sans'
]

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '64', '72']

const LINE_HEIGHTS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' }
]

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'
]

export function StyleTab({ formatting, onSendCommand, isApplying, elementId }: StyleTabProps) {
  const [fontFamily, setFontFamily] = useState(formatting?.fontFamily || 'Inter')
  const [fontSize, setFontSize] = useState(formatting?.fontSize?.replace('px', '') || '16')
  const [textColor, setTextColor] = useState(formatting?.color || '#000000')
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false)
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false)

  // Apply text format command (bold, italic, etc.)
  const handleFormatCommand = async (command: string) => {
    await onSendCommand('applyTextFormatCommand', { command })
  }

  // Set font family
  const handleFontChange = async (font: string) => {
    setFontFamily(font)
    setIsFontDropdownOpen(false)
    await onSendCommand('setTextBoxFont', { fontFamily: font })
  }

  // Set font size
  const handleSizeChange = async (size: string) => {
    setFontSize(size)
    setIsSizeDropdownOpen(false)
    await onSendCommand('setTextBoxFontSize', { fontSize: `${size}px` })
  }

  // Set text color
  const handleColorChange = async (color: string) => {
    setTextColor(color)
    await onSendCommand('setTextBoxColor', { color })
  }

  // Set alignment
  const handleAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxAlignment', { alignment })
  }

  // Set line height
  const handleLineHeight = async (lineHeight: string) => {
    await onSendCommand('setTextBoxLineHeight', { lineHeight })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Font Family */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Font</label>
        <div className="relative">
          <button
            onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
            disabled={isApplying}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            <span style={{ fontFamily }}>{fontFamily}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {isFontDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font}
                  onClick={() => handleFontChange(font)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors",
                    font === fontFamily && "bg-gray-700"
                  )}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Font Size & Style */}
      <div className="flex gap-2">
        {/* Font Size Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
            disabled={isApplying}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            <span>{fontSize}px</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {isSizeDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors",
                    size === fontSize && "bg-gray-700"
                  )}
                >
                  {size}px
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Style Buttons */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => handleFormatCommand('bold')}
            disabled={isApplying}
            className="p-2 rounded hover:bg-gray-700 transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFormatCommand('italic')}
            disabled={isApplying}
            className="p-2 rounded hover:bg-gray-700 transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFormatCommand('underline')}
            disabled={isApplying}
            className="p-2 rounded hover:bg-gray-700 transition-colors"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFormatCommand('strikethrough')}
            disabled={isApplying}
            className="p-2 rounded hover:bg-gray-700 transition-colors"
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Text Color */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Text Color</label>
        <div className="grid grid-cols-5 gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              disabled={isApplying}
              className={cn(
                "w-full aspect-square rounded-lg border-2 hover:scale-110 transition-transform",
                textColor === color ? "border-blue-500" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Alignment</label>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => handleAlignment('left')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4 mx-auto" />
          </button>
          <button
            onClick={() => handleAlignment('center')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4 mx-auto" />
          </button>
          <button
            onClick={() => handleAlignment('right')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4 mx-auto" />
          </button>
          <button
            onClick={() => handleAlignment('justify')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Justify"
          >
            <AlignJustify className="h-4 w-4 mx-auto" />
          </button>
        </div>
      </div>

      {/* Line Spacing */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Line Spacing</label>
        <div className="flex bg-gray-800 rounded-lg p-1">
          {LINE_HEIGHTS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleLineHeight(value)}
              disabled={isApplying}
              className="flex-1 py-2 text-xs rounded hover:bg-gray-700 transition-colors"
              title={`Line height: ${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lists */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Lists</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleFormatCommand('insertUnorderedList')}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            title="Bullet list"
          >
            <List className="h-4 w-4" />
            <span className="text-xs">Bullets</span>
          </button>
          <button
            onClick={() => handleFormatCommand('insertOrderedList')}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            title="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
            <span className="text-xs">Numbered</span>
          </button>
        </div>
      </div>
    </div>
  )
}
