"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface LayoutTabProps {
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
}

const BORDER_STYLES = [
  { label: 'None', value: 'none' },
  { label: 'Line', value: 'solid' }
]

// Background color swatches
const BACKGROUND_SWATCHES = [
  'transparent',
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db',
  '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff',
  '#fef2f2', '#ecfdf5', '#eff6ff', '#fdf4ff', '#f5f3ff',
  '#000000', '#1f2937', '#374151'
]

// Border color swatches
const BORDER_SWATCHES = [
  '#000000', '#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#be185d', '#7c3aed'
]

export function LayoutTab({ formatting, onSendCommand, isApplying, elementId }: LayoutTabProps) {
  // Layout state
  const [columns, setColumns] = useState(1)
  const [textInset, setTextInset] = useState('5')
  const [autosizeText, setAutosizeText] = useState(true)

  // Indents state
  const [isIndentsOpen, setIsIndentsOpen] = useState(false)
  const [firstIndent, setFirstIndent] = useState('0')
  const [leftIndent, setLeftIndent] = useState('0')
  const [rightIndent, setRightIndent] = useState('0')

  // Paragraph borders state
  const [isBordersOpen, setIsBordersOpen] = useState(false)
  const [borderStyle, setBorderStyle] = useState('none')
  const [borderColor, setBorderColor] = useState('#d1d5db')
  const [borderWidth, setBorderWidth] = useState('1')
  const [borderPositions, setBorderPositions] = useState<string[]>([])
  const [borderOffset, setBorderOffset] = useState('6')
  const [roundedCorners, setRoundedCorners] = useState(false)

  // Background state
  const [backgroundColor, setBackgroundColor] = useState('transparent')

  // Handlers
  const handleColumnsChange = async (delta: number) => {
    const newColumns = Math.max(1, Math.min(4, columns + delta))
    setColumns(newColumns)
    await onSendCommand('setTextBoxColumns', { columns: newColumns })
  }

  const handleTextInsetChange = async (value: string) => {
    setTextInset(value)
    await onSendCommand('setTextBoxPadding', { padding: `${value}pt` })
  }

  const handleAutosizeChange = async (checked: boolean) => {
    setAutosizeText(checked)
    await onSendCommand('setTextBoxAutosize', { autosize: checked })
  }

  const handleIndentChange = async (type: 'first' | 'left' | 'right', value: string) => {
    if (type === 'first') setFirstIndent(value)
    if (type === 'left') setLeftIndent(value)
    if (type === 'right') setRightIndent(value)

    await onSendCommand('setTextBoxIndents', {
      firstIndent: type === 'first' ? `${value}pt` : `${firstIndent}pt`,
      leftIndent: type === 'left' ? `${value}pt` : `${leftIndent}pt`,
      rightIndent: type === 'right' ? `${value}pt` : `${rightIndent}pt`
    })
  }

  const handleBorderStyleChange = async (style: string) => {
    setBorderStyle(style)
    if (style === 'none') {
      setBorderPositions([])
    }
    await onSendCommand('setTextBoxBorder', {
      borderStyle: style,
      borderWidth: `${borderWidth}pt`,
      borderColor,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const handleBorderColorChange = async (color: string) => {
    setBorderColor(color)
    await onSendCommand('setTextBoxBorder', {
      borderStyle,
      borderWidth: `${borderWidth}pt`,
      borderColor: color,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const handleBorderWidthChange = async (value: string) => {
    setBorderWidth(value)
    await onSendCommand('setTextBoxBorder', {
      borderStyle,
      borderWidth: `${value}pt`,
      borderColor,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const toggleBorderPosition = async (position: string) => {
    const newPositions = borderPositions.includes(position)
      ? borderPositions.filter(p => p !== position)
      : [...borderPositions, position]
    setBorderPositions(newPositions)
    await onSendCommand('setTextBoxBorderPositions', { positions: newPositions })
  }

  const handleBorderOffsetChange = async (value: string) => {
    setBorderOffset(value)
    await onSendCommand('setTextBoxBorderOffset', { offset: `${value}pt` })
  }

  const handleRoundedCornersChange = async (checked: boolean) => {
    setRoundedCorners(checked)
    await onSendCommand('setTextBoxBorder', {
      borderStyle,
      borderWidth: `${borderWidth}pt`,
      borderColor,
      borderRadius: checked ? '4px' : '0px'
    })
  }

  const handleBackgroundChange = async (color: string) => {
    setBackgroundColor(color)
    await onSendCommand('setTextBoxBackground', { backgroundColor: color })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Columns */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Columns</label>
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
          <button
            onClick={() => handleColumnsChange(-1)}
            disabled={isApplying || columns <= 1}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{columns}</span>
          <button
            onClick={() => handleColumnsChange(1)}
            disabled={isApplying || columns >= 4}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Text Inset */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Text Inset</label>
        <div className="flex items-center bg-gray-800 rounded-lg">
          <input
            type="number"
            value={textInset}
            onChange={(e) => setTextInset(e.target.value)}
            onBlur={() => handleTextInsetChange(textInset)}
            disabled={isApplying}
            min="0"
            max="100"
            className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
          />
          <span className="text-xs text-gray-400 pr-3">pt</span>
        </div>
      </div>

      {/* Autosize Text */}
      <div className="flex items-center justify-between py-2">
        <label className="text-sm">Autosize Text</label>
        <button
          onClick={() => handleAutosizeChange(!autosizeText)}
          disabled={isApplying}
          className={cn(
            "w-10 h-6 rounded-full transition-colors relative",
            autosizeText ? "bg-blue-600" : "bg-gray-700"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              autosizeText ? "left-5" : "left-1"
            )}
          />
        </button>
      </div>

      {/* Indents Section (Collapsible) */}
      <Collapsible open={isIndentsOpen} onOpenChange={setIsIndentsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Indents</span>
          {isIndentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">First</label>
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={firstIndent}
                  onChange={(e) => setFirstIndent(e.target.value)}
                  onBlur={() => handleIndentChange('first', firstIndent)}
                  disabled={isApplying}
                  className="w-full px-2 py-1.5 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-2">pt</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Left</label>
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={leftIndent}
                  onChange={(e) => setLeftIndent(e.target.value)}
                  onBlur={() => handleIndentChange('left', leftIndent)}
                  disabled={isApplying}
                  className="w-full px-2 py-1.5 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-2">pt</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Right</label>
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={rightIndent}
                  onChange={(e) => setRightIndent(e.target.value)}
                  onBlur={() => handleIndentChange('right', rightIndent)}
                  disabled={isApplying}
                  className="w-full px-2 py-1.5 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-2">pt</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Paragraph Borders Section (Collapsible) */}
      <Collapsible open={isBordersOpen} onOpenChange={setIsBordersOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Paragraph Borders</span>
          {isBordersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Border Style */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {BORDER_STYLES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleBorderStyleChange(value)}
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

          {borderStyle !== 'none' && (
            <>
              {/* Border Color */}
              <ColorPicker
                value={borderColor}
                onChange={handleBorderColorChange}
                swatches={BORDER_SWATCHES}
                disabled={isApplying}
                showCurrentColor={false}
              />

              {/* Border Width */}
              <div className="flex items-center bg-gray-800 rounded-lg">
                <input
                  type="number"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(e.target.value)}
                  onBlur={() => handleBorderWidthChange(borderWidth)}
                  disabled={isApplying}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-gray-400 pr-3">pt</span>
              </div>

              {/* Border Position Buttons */}
              <div className="space-y-2">
                <div className="flex bg-gray-800 rounded-lg p-1">
                  {['left', 'top', 'right', 'bottom'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => toggleBorderPosition(pos)}
                      disabled={isApplying}
                      className={cn(
                        "flex-1 py-2 text-xs rounded transition-colors capitalize",
                        borderPositions.includes(pos) ? "bg-blue-600" : "hover:bg-gray-700"
                      )}
                    >
                      {pos.charAt(0).toUpperCase()}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const allPositions = ['left', 'top', 'right', 'bottom']
                      setBorderPositions(allPositions)
                      onSendCommand('setTextBoxBorderPositions', { positions: allPositions })
                    }}
                    disabled={isApplying}
                    className={cn(
                      "flex-1 py-2 text-xs rounded transition-colors",
                      borderPositions.length === 4 ? "bg-blue-600" : "hover:bg-gray-700"
                    )}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Border Offset */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Border Offset</label>
                <div className="flex items-center bg-gray-800 rounded-lg">
                  <input
                    type="number"
                    value={borderOffset}
                    onChange={(e) => setBorderOffset(e.target.value)}
                    onBlur={() => handleBorderOffsetChange(borderOffset)}
                    disabled={isApplying}
                    className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                  />
                  <span className="text-xs text-gray-400 pr-3">pt</span>
                </div>
              </div>

              {/* Rounded Corners */}
              <div className="flex items-center justify-between py-1">
                <label className="text-xs text-gray-400">Rounded Corners</label>
                <button
                  onClick={() => handleRoundedCornersChange(!roundedCorners)}
                  disabled={isApplying}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    roundedCorners ? "bg-blue-600 border-blue-600" : "border-gray-500"
                  )}
                >
                  {roundedCorners && <span className="text-white text-xs">✓</span>}
                </button>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Paragraph Background */}
      <ColorPicker
        label="Paragraph Background"
        value={backgroundColor}
        onChange={handleBackgroundChange}
        swatches={BACKGROUND_SWATCHES}
        disabled={isApplying}
        showCurrentColor={true}
      />
    </div>
  )
}
