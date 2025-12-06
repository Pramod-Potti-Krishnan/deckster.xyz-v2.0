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
import { CompactColorPicker } from '@/components/ui/color-picker'
import { CSSClassesInput } from '@/components/ui/css-classes-input'
import { cn } from '@/lib/utils'
import { TEXT_TRANSFORMS, TextTransform } from '@/types/elements'
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

const BORDER_STYLES = [
  { label: 'None', value: 'none' },
  { label: 'Line', value: 'solid' }
]

// Helper to parse fontSize which may come as number or string (with px/pt suffix)
const parseFontSize = (size: string | number | undefined | null): string => {
  if (size === undefined || size === null) return '16'
  const str = String(size)
  return str.replace('px', '').replace('pt', '')
}

export function StyleTab({ formatting, onSendCommand, isApplying, elementId }: StyleTabProps) {
  // Font state
  const [fontFamily, setFontFamily] = useState(formatting?.fontFamily || 'Inter')
  const [fontWeight, setFontWeight] = useState(formatting?.fontWeight || '400')
  const [fontSize, setFontSize] = useState(parseFontSize(formatting?.fontSize))
  const [textColor, setTextColor] = useState(formatting?.color || '#000000')
  const [highlightColor, setHighlightColor] = useState(formatting?.backgroundColor || 'transparent')
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false)
  const [isWeightDropdownOpen, setIsWeightDropdownOpen] = useState(false)
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false)

  // Spacing state
  const [isSpacingOpen, setIsSpacingOpen] = useState(false)
  const [isBulletsOpen, setIsBulletsOpen] = useState(false)
  const [lineHeight, setLineHeight] = useState('1.15')
  const [beforeParagraph, setBeforeParagraph] = useState('0')
  const [afterParagraph, setAfterParagraph] = useState('0')

  // Box styling state (moved from Layout tab)
  const [isBoxOpen, setIsBoxOpen] = useState(false)
  const [textInset, setTextInset] = useState('5')
  const [borderStyle, setBorderStyle] = useState('none')
  const [borderColor, setBorderColor] = useState('#d1d5db')
  const [borderWidth, setBorderWidth] = useState('1')
  const [roundedCorners, setRoundedCorners] = useState(false)
  const [boxBackground, setBoxBackground] = useState('#ffffff')

  // Text transform and CSS classes state
  const [textTransform, setTextTransform] = useState<TextTransform>('none')
  const [cssClasses, setCssClasses] = useState<string[]>([])

  const fontSizeInputRef = useRef<HTMLInputElement>(null)

  // Apply text format command (bold, italic, etc.)
  const handleFormatCommand = async (command: string) => {
    await onSendCommand('applyTextFormatCommand', { elementId, command })
  }

  // Set font family
  const handleFontChange = async (font: string) => {
    setFontFamily(font)
    setIsFontDropdownOpen(false)
    await onSendCommand('setTextBoxFont', { elementId, fontFamily: font })
  }

  // Set font weight
  const handleWeightChange = async (weight: string) => {
    setFontWeight(weight)
    setIsWeightDropdownOpen(false)
    await onSendCommand('setTextBoxFontWeight', { elementId, fontWeight: weight })
  }

  // Set font size - validates input (1-200pt)
  const handleSizeChange = async (size: string) => {
    const numSize = parseInt(size, 10)
    if (isNaN(numSize) || numSize < 1) return
    const clampedSize = Math.min(Math.max(numSize, 1), 200)
    setFontSize(String(clampedSize))
    setIsSizeDropdownOpen(false)
    await onSendCommand('setTextBoxFontSize', { elementId, fontSize: `${clampedSize}pt` })
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
    await onSendCommand('setTextBoxColor', { elementId, color })
  }

  // Set text highlight color (inline highlighting for selected text)
  const handleHighlightChange = async (color: string) => {
    setHighlightColor(color)
    // Use setTextHighlightColor for inline text highlighting (like a highlighter pen)
    // User must select text first - this applies background to selected text only
    await onSendCommand('setTextHighlightColor', { elementId, color })
  }

  // Set horizontal alignment
  const handleAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxAlignment', { elementId, alignment })
  }

  // Set vertical alignment
  const handleVerticalAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxVerticalAlignment', { elementId, verticalAlignment: alignment })
  }

  // Set line height
  const handleLineHeight = async (value: string) => {
    setLineHeight(value)
    await onSendCommand('setTextBoxLineHeight', { elementId, lineHeight: value })
  }

  // Set paragraph spacing
  const handleParagraphSpacing = async (before: string, after: string) => {
    setBeforeParagraph(before)
    setAfterParagraph(after)
    await onSendCommand('setTextBoxParagraphSpacing', {
      elementId,
      marginTop: `${before}pt`,
      marginBottom: `${after}pt`
    })
  }

  // Box styling handlers
  const handleTextInsetChange = async (value: string) => {
    setTextInset(value)
    await onSendCommand('setTextBoxPadding', { elementId, padding: `${value}pt` })
  }

  const handleBorderStyleChange = async (style: string) => {
    setBorderStyle(style)
    await onSendCommand('setTextBoxBorder', {
      elementId,
      borderStyle: style,
      borderWidth: `${borderWidth}pt`,
      borderColor,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const handleBorderColorChange = async (color: string) => {
    setBorderColor(color)
    await onSendCommand('setTextBoxBorder', {
      elementId,
      borderStyle,
      borderWidth: `${borderWidth}pt`,
      borderColor: color,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const handleBorderWidthChange = async (value: string) => {
    setBorderWidth(value)
    await onSendCommand('setTextBoxBorder', {
      elementId,
      borderStyle,
      borderWidth: `${value}pt`,
      borderColor,
      borderRadius: roundedCorners ? '4px' : '0px'
    })
  }

  const handleRoundedCornersChange = async (checked: boolean) => {
    setRoundedCorners(checked)
    await onSendCommand('setTextBoxBorder', {
      elementId,
      borderStyle,
      borderWidth: `${borderWidth}pt`,
      borderColor,
      borderRadius: checked ? '4px' : '0px'
    })
  }

  const handleBoxBackgroundChange = async (color: string) => {
    setBoxBackground(color)
    await onSendCommand('setTextBoxBackground', { elementId, backgroundColor: color })
  }

  // Text transform handler
  const handleTextTransformChange = async (value: TextTransform) => {
    setTextTransform(value)
    await onSendCommand('setTextBoxTextTransform', { elementId, textTransform: value })
  }

  // CSS classes handler
  const handleCssClassesChange = async (classes: string[]) => {
    setCssClasses(classes)
    await onSendCommand('setElementClasses', { elementId, classes })
  }

  return (
    <div className="p-2 space-y-1.5">
      {/* Font Section - Compact */}
      <div className="space-y-1.5">
        {/* Row 1: Font Family (60%) + Weight (40%) */}
        <div className="flex gap-1.5">
          <div className="relative w-[60%]">
            <button
              onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
              disabled={isApplying}
              className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
              title="Font Family"
            >
              <span className="truncate" style={{ fontFamily }}>{fontFamily}</span>
              <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0 ml-1" />
            </button>
            {isFontDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto border border-gray-700">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font}
                    onClick={() => handleFontChange(font)}
                    className={cn(
                      "w-full px-2 py-1.5 text-left text-xs hover:bg-gray-700 transition-colors truncate",
                      font === fontFamily && "bg-gray-700 text-blue-400"
                    )}
                    style={{ fontFamily: font }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative w-[40%]">
            <button
              onClick={() => setIsWeightDropdownOpen(!isWeightDropdownOpen)}
              disabled={isApplying}
              className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
              title="Font Weight"
            >
              <span className="truncate">{FONT_WEIGHTS.find(w => w.value === fontWeight)?.label || 'Regular'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0 ml-1" />
            </button>
            {isWeightDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-20 border border-gray-700">
                {FONT_WEIGHTS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => handleWeightChange(value)}
                    className={cn(
                      "w-full px-2 py-1.5 text-left text-xs hover:bg-gray-700 transition-colors",
                      value === fontWeight && "bg-gray-700 text-blue-400"
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

        {/* Row 2: Size + Styles */}
        <div className="flex gap-1.5">
          {/* Font Size */}
          <div className="relative w-20">
            <div className="flex items-center bg-gray-800 rounded border border-transparent hover:border-gray-600 transition-colors">
              <input
                ref={fontSizeInputRef}
                type="text"
                value={fontSize}
                onChange={handleSizeInputChange}
                onBlur={handleSizeInputBlur}
                onKeyDown={handleSizeInputKeyDown}
                disabled={isApplying}
                className="w-full px-1.5 py-1 bg-transparent text-xs text-white focus:outline-none text-center"
                placeholder="16"
              />
              <span className="text-[10px] text-gray-500 mr-1">pt</span>
              <button
                onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
                disabled={isApplying}
                className="px-1 py-1 hover:bg-gray-700 rounded-r transition-colors border-l border-gray-700"
              >
                <ChevronDown className="h-2.5 w-2.5 text-gray-400" />
              </button>
            </div>
            {isSizeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto border border-gray-700">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    className={cn(
                      "w-full px-2 py-1 text-left text-xs hover:bg-gray-700 transition-colors",
                      size === fontSize && "bg-gray-700 text-blue-400"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Style Buttons */}
          <div className="flex flex-1 bg-gray-800 rounded border border-transparent p-0.5">
            <button
              onClick={() => handleFormatCommand('bold')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormatCommand('italic')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormatCommand('underline')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
              title="Underline"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormatCommand('strikethrough')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
              title="Strikethrough"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 3: Colors (Side by Side) */}
        <div className="flex gap-1.5">
          <div className="flex-1">
            <CompactColorPicker
              label="Text"
              value={textColor}
              onChange={handleColorChange}
              disabled={isApplying}
            />
          </div>
          <div className="flex-1">
            <CompactColorPicker
              label="Highlight"
              value={highlightColor}
              onChange={handleHighlightChange}
              disabled={isApplying}
              allowNoFill={true}
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-800 my-2" />

      {/* Alignment Section - Compact */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Alignment</label>
        <div className="flex gap-1.5">
          {/* Horizontal */}
          <div className="flex flex-1 bg-gray-800 rounded p-0.5 border border-transparent">
            <button onClick={() => handleAlignment('left')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Left"><AlignLeft className="h-3.5 w-3.5 mx-auto" /></button>
            <button onClick={() => handleAlignment('center')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Center"><AlignCenter className="h-3.5 w-3.5 mx-auto" /></button>
            <button onClick={() => handleAlignment('right')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Right"><AlignRight className="h-3.5 w-3.5 mx-auto" /></button>
            <button onClick={() => handleAlignment('justify')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Justify"><AlignJustify className="h-3.5 w-3.5 mx-auto" /></button>
          </div>
          {/* Vertical */}
          <div className="flex w-[40%] bg-gray-800 rounded p-0.5 border border-transparent">
            <button onClick={() => handleVerticalAlignment('top')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Top"><AlignVerticalJustifyStart className="h-3.5 w-3.5 mx-auto" /></button>
            <button onClick={() => handleVerticalAlignment('middle')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Middle"><AlignVerticalJustifyCenter className="h-3.5 w-3.5 mx-auto" /></button>
            <button onClick={() => handleVerticalAlignment('bottom')} disabled={isApplying} className="flex-1 p-1 rounded hover:bg-gray-700 transition-colors" title="Align Bottom"><AlignVerticalJustifyEnd className="h-3.5 w-3.5 mx-auto" /></button>
          </div>
        </div>
      </div>

      {/* Text Transform */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">Transform</span>
        <select
          value={textTransform}
          onChange={(e) => handleTextTransformChange(e.target.value as TextTransform)}
          disabled={isApplying}
          className="w-24 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-white focus:outline-none border border-transparent hover:border-gray-600"
        >
          {TEXT_TRANSFORMS.map(({ transform, label }) => (
            <option key={transform} value={transform}>{label}</option>
          ))}
        </select>
      </div>

      <div className="h-px bg-gray-800 my-2" />

      {/* Spacing Section (Collapsible) */}
      <Collapsible open={isSpacingOpen} onOpenChange={setIsSpacingOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-[10px] text-gray-400 uppercase tracking-wide hover:text-white transition-colors group">
          <span className="group-hover:text-gray-300">Spacing</span>
          {isSpacingOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-1.5">
          {/* Lines - Inline */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Lines</span>
            <select
              value={lineHeight}
              onChange={(e) => handleLineHeight(e.target.value)}
              disabled={isApplying}
              className="w-16 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-white focus:outline-none border border-transparent hover:border-gray-600"
            >
              {LINE_HEIGHTS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Before/After Paragraph - Inline */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Before</span>
            <div className="flex items-center gap-0.5 bg-gray-800 rounded px-1 border border-transparent hover:border-gray-600">
              <input
                type="number"
                value={beforeParagraph}
                onChange={(e) => setBeforeParagraph(e.target.value)}
                onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
                disabled={isApplying}
                min="0"
                max="100"
                className="w-8 py-0.5 bg-transparent text-[10px] text-white text-right focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">pt</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">After</span>
            <div className="flex items-center gap-0.5 bg-gray-800 rounded px-1 border border-transparent hover:border-gray-600">
              <input
                type="number"
                value={afterParagraph}
                onChange={(e) => setAfterParagraph(e.target.value)}
                onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
                disabled={isApplying}
                min="0"
                max="100"
                className="w-8 py-0.5 bg-transparent text-[10px] text-white text-right focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">pt</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="h-px bg-gray-800 my-2" />

      {/* Bullets & Lists Section (Collapsible) */}
      <Collapsible open={isBulletsOpen} onOpenChange={setIsBulletsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-[10px] text-gray-400 uppercase tracking-wide hover:text-white transition-colors group">
          <span className="group-hover:text-gray-300">Lists</span>
          {isBulletsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => handleFormatCommand('insertUnorderedList')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 rounded hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
              title="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
              <span className="text-[10px]">Bullets</span>
            </button>
            <button
              onClick={() => handleFormatCommand('insertOrderedList')}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 rounded hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
              title="Numbered list"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span className="text-[10px]">Numbered</span>
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="h-px bg-gray-800 my-2" />

      {/* Box Styling Section (Collapsible) */}
      <Collapsible open={isBoxOpen} onOpenChange={setIsBoxOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-[10px] text-gray-400 uppercase tracking-wide hover:text-white transition-colors group">
          <span className="group-hover:text-gray-300">Box Style</span>
          {isBoxOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-1.5">
          {/* Text Inset (Padding) */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Padding</span>
            <div className="flex items-center gap-0.5 bg-gray-800 rounded px-1 border border-transparent hover:border-gray-600">
              <input
                type="number"
                value={textInset}
                onChange={(e) => setTextInset(e.target.value)}
                onBlur={() => handleTextInsetChange(textInset)}
                disabled={isApplying}
                min="0"
                max="100"
                className="w-8 py-0.5 bg-transparent text-[10px] text-white text-right focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">pt</span>
            </div>
          </div>

          {/* Border Style + Color + Width */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 w-12">Border</span>
            <select
              value={borderStyle}
              onChange={(e) => handleBorderStyleChange(e.target.value)}
              disabled={isApplying}
              className="flex-1 px-1 py-0.5 bg-gray-800 rounded text-[10px] text-white focus:outline-none border border-transparent hover:border-gray-600"
            >
              {BORDER_STYLES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {borderStyle !== 'none' && (
            <div className="flex items-center justify-between pl-12">
              <div className="flex items-center gap-2">
                {/* Border Color */}
                <CompactColorPicker
                  value={borderColor}
                  onChange={handleBorderColorChange}
                  disabled={isApplying}
                />
                {/* Border Width */}
                <div className="flex items-center gap-0.5 bg-gray-800 rounded px-1 border border-transparent hover:border-gray-600">
                  <input
                    type="number"
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(e.target.value)}
                    onBlur={() => handleBorderWidthChange(borderWidth)}
                    disabled={isApplying}
                    min="1"
                    max="10"
                    className="w-6 py-0.5 bg-transparent text-[10px] text-white text-center focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-500">pt</span>
                </div>
              </div>
            </div>
          )}

          {/* Rounded Corners */}
          {borderStyle !== 'none' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Rounded</span>
              <button
                onClick={() => handleRoundedCornersChange(!roundedCorners)}
                disabled={isApplying}
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  roundedCorners ? "bg-blue-600 border-blue-600" : "border-gray-500 bg-gray-800"
                )}
              >
                {roundedCorners && <span className="text-white text-[8px]">✓</span>}
              </button>
            </div>
          )}

          {/* Box Background */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Fill</span>
            <CompactColorPicker
              value={boxBackground}
              onChange={handleBoxBackgroundChange}
              disabled={isApplying}
              allowNoFill={true}
            />
          </div>

          {/* CSS Classes */}
          <div className="space-y-1 pt-2 border-t border-gray-700 mt-2">
            <label className="text-[10px] text-gray-400">CSS Classes</label>
            <CSSClassesInput
              value={cssClasses}
              onChange={handleCssClassesChange}
              disabled={isApplying}
              placeholder="Add class name..."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
