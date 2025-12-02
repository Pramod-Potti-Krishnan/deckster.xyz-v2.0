"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { CompactColorPicker } from '@/components/ui/color-picker'
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
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')

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
    <div className="p-3 space-y-3">
      {/* Columns - Compact */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Columns</span>
        <div className="flex items-center bg-gray-800 rounded-lg">
          <button
            onClick={() => handleColumnsChange(-1)}
            disabled={isApplying || columns <= 1}
            className="p-1.5 rounded-l-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-sm">{columns}</span>
          <button
            onClick={() => handleColumnsChange(1)}
            disabled={isApplying || columns >= 4}
            className="p-1.5 rounded-r-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Text Inset - Compact */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Text Inset</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={textInset}
            onChange={(e) => setTextInset(e.target.value)}
            onBlur={() => handleTextInsetChange(textInset)}
            disabled={isApplying}
            min="0"
            max="100"
            className="w-12 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
          />
          <span className="text-xs text-gray-500">pt</span>
        </div>
      </div>

      {/* Autosize Text - Compact */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Autosize Text</span>
        <button
          onClick={() => handleAutosizeChange(!autosizeText)}
          disabled={isApplying}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative",
            autosizeText ? "bg-blue-600" : "bg-gray-700"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              autosizeText ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Indents Section (Collapsible) */}
      <Collapsible open={isIndentsOpen} onOpenChange={setIsIndentsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Indents</span>
          {isIndentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {/* First Indent */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">First</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={firstIndent}
                onChange={(e) => setFirstIndent(e.target.value)}
                onBlur={() => handleIndentChange('first', firstIndent)}
                disabled={isApplying}
                className="w-12 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
          {/* Left Indent */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Left</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={leftIndent}
                onChange={(e) => setLeftIndent(e.target.value)}
                onBlur={() => handleIndentChange('left', leftIndent)}
                disabled={isApplying}
                className="w-12 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
          {/* Right Indent */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Right</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={rightIndent}
                onChange={(e) => setRightIndent(e.target.value)}
                onBlur={() => handleIndentChange('right', rightIndent)}
                disabled={isApplying}
                className="w-12 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Paragraph Borders Section (Collapsible) */}
      <Collapsible open={isBordersOpen} onOpenChange={setIsBordersOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Paragraph Borders</span>
          {isBordersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {/* Border Style + Color + Width - Compact Row */}
          <div className="flex items-center gap-2">
            <select
              value={borderStyle}
              onChange={(e) => handleBorderStyleChange(e.target.value)}
              disabled={isApplying}
              className="w-20 px-2 py-1 bg-gray-800 rounded text-xs text-white focus:outline-none"
            >
              {BORDER_STYLES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {borderStyle !== 'none' && (
              <>
                {/* Border Color - Inline swatch + rainbow */}
                <div className="flex items-center gap-1">
                  <div
                    className="w-8 h-5 rounded border border-gray-600"
                    style={{ backgroundColor: borderColor }}
                  />
                  <button
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'color'
                      input.value = borderColor
                      input.onchange = (e) => handleBorderColorChange((e.target as HTMLInputElement).value)
                      input.click()
                    }}
                    disabled={isApplying}
                    className="w-5 h-5 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] border border-gray-500 hover:scale-110 transition-transform"
                  />
                </div>

                {/* Border Width */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(e.target.value)}
                    onBlur={() => handleBorderWidthChange(borderWidth)}
                    disabled={isApplying}
                    min="1"
                    max="10"
                    className="w-10 px-1 py-1 bg-gray-800 rounded text-xs text-white text-center focus:outline-none"
                  />
                  <span className="text-xs text-gray-500">pt</span>
                </div>
              </>
            )}
          </div>

          {borderStyle !== 'none' && (
            <>
              {/* Border Position Buttons - Compact */}
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                {['left', 'top', 'right', 'bottom'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => toggleBorderPosition(pos)}
                    disabled={isApplying}
                    className={cn(
                      "flex-1 py-1 text-xs rounded transition-colors",
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
                    "flex-1 py-1 text-xs rounded transition-colors",
                    borderPositions.length === 4 ? "bg-blue-600" : "hover:bg-gray-700"
                  )}
                >
                  All
                </button>
              </div>

              {/* Border Offset - Inline */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Border Offset</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={borderOffset}
                    onChange={(e) => setBorderOffset(e.target.value)}
                    onBlur={() => handleBorderOffsetChange(borderOffset)}
                    disabled={isApplying}
                    className="w-12 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
                  />
                  <span className="text-xs text-gray-500">pt</span>
                </div>
              </div>

              {/* Rounded Corners - Compact */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Rounded Corners</span>
                <button
                  onClick={() => handleRoundedCornersChange(!roundedCorners)}
                  disabled={isApplying}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
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

      {/* Paragraph Background - Compact */}
      <CompactColorPicker
        label="Paragraph Background"
        value={backgroundColor}
        onChange={handleBackgroundChange}
        disabled={isApplying}
      />
    </div>
  )
}
