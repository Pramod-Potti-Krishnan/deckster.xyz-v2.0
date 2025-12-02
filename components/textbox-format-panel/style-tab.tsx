"use client"

import { useState, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  List,
  ListOrdered,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

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
  'Open Sans',
  'Helvetica Neue'
]

const FONT_WEIGHTS = [
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' }
]

// Extended font sizes up to 120pt with common presets
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '64', '72', '96', '115', '120']

const LINE_HEIGHTS = [
  { label: '0.8', value: '0.8' },
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' }
]

// Text color swatches
const TEXT_COLOR_SWATCHES = [
  '#000000', '#1f2937', '#374151', '#6b7280', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#be185d', '#7c3aed'
]

export function StyleTab({ formatting, onSendCommand, isApplying, elementId }: StyleTabProps) {
  const [fontFamily, setFontFamily] = useState(formatting?.fontFamily || 'Inter')
  const [fontWeight, setFontWeight] = useState(formatting?.fontWeight || '400')
  const [fontSize, setFontSize] = useState(formatting?.fontSize?.replace('px', '').replace('pt', '') || '16')
  const [textColor, setTextColor] = useState(formatting?.color || '#000000')
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false)
  const [isWeightDropdownOpen, setIsWeightDropdownOpen] = useState(false)
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false)
  const [isSpacingOpen, setIsSpacingOpen] = useState(true)
  const [isBulletsOpen, setIsBulletsOpen] = useState(false)
  const [lineHeight, setLineHeight] = useState('1.15')
  const [beforeParagraph, setBeforeParagraph] = useState('0')
  const [afterParagraph, setAfterParagraph] = useState('0')

  const fontSizeInputRef = useRef<HTMLInputElement>(null)

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

  // Set font weight
  const handleWeightChange = async (weight: string) => {
    setFontWeight(weight)
    setIsWeightDropdownOpen(false)
    await onSendCommand('setTextBoxFontWeight', { fontWeight: weight })
  }

  // Set font size - validates input (1-200pt)
  const handleSizeChange = async (size: string) => {
    const numSize = parseInt(size, 10)
    if (isNaN(numSize) || numSize < 1) return
    const clampedSize = Math.min(Math.max(numSize, 1), 200)
    setFontSize(String(clampedSize))
    setIsSizeDropdownOpen(false)
    await onSendCommand('setTextBoxFontSize', { fontSize: `${clampedSize}pt` })
  }

  // Handle font size input change (live validation)
  const handleSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '')
    setFontSize(value)
  }

  // Handle font size input blur (apply change)
  const handleSizeInputBlur = () => {
    if (fontSize) {
      handleSizeChange(fontSize)
    }
  }

  // Handle font size input key press
  const handleSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSizeChange(fontSize)
      fontSizeInputRef.current?.blur()
    }
  }

  // Set text color
  const handleColorChange = async (color: string) => {
    setTextColor(color)
    await onSendCommand('setTextBoxColor', { color })
  }

  // Set horizontal alignment
  const handleAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxAlignment', { alignment })
  }

  // Set vertical alignment
  const handleVerticalAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxVerticalAlignment', { verticalAlignment: alignment })
  }

  // Set line height
  const handleLineHeight = async (value: string) => {
    setLineHeight(value)
    await onSendCommand('setTextBoxLineHeight', { lineHeight: value })
  }

  // Set paragraph spacing
  const handleParagraphSpacing = async (before: string, after: string) => {
    setBeforeParagraph(before)
    setAfterParagraph(after)
    await onSendCommand('setTextBoxParagraphSpacing', {
      marginTop: `${before}pt`,
      marginBottom: `${after}pt`
    })
  }

  return (
    <div className="p-4 space-y-4">
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

      {/* Font Weight */}
      <div className="space-y-2">
        <div className="relative">
          <button
            onClick={() => setIsWeightDropdownOpen(!isWeightDropdownOpen)}
            disabled={isApplying}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            <span>{FONT_WEIGHTS.find(w => w.value === fontWeight)?.label || 'Regular'}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {isWeightDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-10">
              {FONT_WEIGHTS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleWeightChange(value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors",
                    value === fontWeight && "bg-gray-700"
                  )}
                  style={{ fontWeight: value }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Font Size (type-in) + B/I/U/S Buttons */}
      <div className="flex gap-2">
        {/* Font Size - Type-in with dropdown */}
        <div className="relative flex-1">
          <div className="flex items-center bg-gray-800 rounded-lg">
            <input
              ref={fontSizeInputRef}
              type="text"
              value={fontSize}
              onChange={handleSizeInputChange}
              onBlur={handleSizeInputBlur}
              onKeyDown={handleSizeInputKeyDown}
              disabled={isApplying}
              className="w-14 px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
              placeholder="16"
            />
            <span className="text-xs text-gray-400 pr-1">pt</span>
            <button
              onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
              disabled={isApplying}
              className="px-2 py-2 hover:bg-gray-700 rounded-r-lg transition-colors"
            >
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </div>
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
                  {size} pt
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
      <ColorPicker
        label="Text Color"
        value={textColor}
        onChange={handleColorChange}
        swatches={TEXT_COLOR_SWATCHES}
        disabled={isApplying}
        showCurrentColor={true}
      />

      {/* Horizontal Alignment */}
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

      {/* Vertical Alignment */}
      <div className="space-y-2">
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => handleVerticalAlignment('top')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Top"
          >
            <AlignVerticalJustifyStart className="h-4 w-4 mx-auto" />
          </button>
          <button
            onClick={() => handleVerticalAlignment('middle')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Middle"
          >
            <AlignVerticalJustifyCenter className="h-4 w-4 mx-auto" />
          </button>
          <button
            onClick={() => handleVerticalAlignment('bottom')}
            disabled={isApplying}
            className="flex-1 p-2 rounded hover:bg-gray-700 transition-colors"
            title="Align Bottom"
          >
            <AlignVerticalJustifyEnd className="h-4 w-4 mx-auto" />
          </button>
        </div>
      </div>

      {/* Spacing Section (Collapsible) */}
      <Collapsible open={isSpacingOpen} onOpenChange={setIsSpacingOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Spacing</span>
          {isSpacingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Line Spacing */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Lines</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              {LINE_HEIGHTS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleLineHeight(value)}
                  disabled={isApplying}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded transition-colors",
                    lineHeight === value ? "bg-gray-600" : "hover:bg-gray-700"
                  )}
                  title={`Line height: ${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Before/After Paragraph */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Before Paragraph</label>
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={beforeParagraph}
                  onChange={(e) => setBeforeParagraph(e.target.value)}
                  onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
                  disabled={isApplying}
                  min="0"
                  max="100"
                  className="w-full px-2 py-1.5 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-2">pt</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">After Paragraph</label>
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={afterParagraph}
                  onChange={(e) => setAfterParagraph(e.target.value)}
                  onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
                  disabled={isApplying}
                  min="0"
                  max="100"
                  className="w-full px-2 py-1.5 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-2">pt</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Bullets & Lists Section (Collapsible) */}
      <Collapsible open={isBulletsOpen} onOpenChange={setIsBulletsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Bullets & Lists</span>
          {isBulletsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
