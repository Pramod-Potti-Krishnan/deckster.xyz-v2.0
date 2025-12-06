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
  ChevronDown
} from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { CompactColorPicker } from '@/components/ui/color-picker'
import { CSSClassesInput } from '@/components/ui/css-classes-input'
import { cn } from '@/lib/utils'
import { TEXT_TRANSFORMS, TextTransform } from '@/types/elements'
import {
  PanelSection,
  ControlRow,
  ButtonGroup,
  Toggle,
  PanelInput,
  PanelSelect,
  Divider,
  IconButton,
} from '@/components/ui/panel'

interface StyleTabProps {
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
}

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue' },
]

const FONT_WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
]

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '64', '72', '96', '115', '120']

const LINE_HEIGHTS = [
  { value: '0.8', label: '0.8' },
  { value: '1', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
]

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Line' },
]

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
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false)

  // Spacing state
  const [lineHeight, setLineHeight] = useState('1.15')
  const [beforeParagraph, setBeforeParagraph] = useState('0')
  const [afterParagraph, setAfterParagraph] = useState('0')

  // Box styling state
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

  // Handlers
  const handleFormatCommand = async (command: string) => {
    await onSendCommand('applyTextFormatCommand', { elementId, command })
  }

  const handleFontChange = async (font: string) => {
    setFontFamily(font)
    await onSendCommand('setTextBoxFont', { elementId, fontFamily: font })
  }

  const handleWeightChange = async (weight: string) => {
    setFontWeight(weight)
    await onSendCommand('setTextBoxFontWeight', { elementId, fontWeight: weight })
  }

  const handleSizeChange = async (size: string) => {
    const numSize = parseInt(size, 10)
    if (isNaN(numSize) || numSize < 1) return
    const clampedSize = Math.min(Math.max(numSize, 1), 200)
    setFontSize(String(clampedSize))
    setIsSizeDropdownOpen(false)
    await onSendCommand('setTextBoxFontSize', { elementId, fontSize: `${clampedSize}pt` })
  }

  const handleColorChange = async (color: string) => {
    setTextColor(color)
    await onSendCommand('setTextBoxColor', { elementId, color })
  }

  const handleHighlightChange = async (color: string) => {
    setHighlightColor(color)
    await onSendCommand('setTextHighlightColor', { elementId, color })
  }

  const handleAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxAlignment', { elementId, alignment })
  }

  const handleVerticalAlignment = async (alignment: string) => {
    await onSendCommand('setTextBoxVerticalAlignment', { elementId, verticalAlignment: alignment })
  }

  const handleLineHeight = async (value: string) => {
    setLineHeight(value)
    await onSendCommand('setTextBoxLineHeight', { elementId, lineHeight: value })
  }

  const handleParagraphSpacing = async (before: string, after: string) => {
    setBeforeParagraph(before)
    setAfterParagraph(after)
    await onSendCommand('setTextBoxParagraphSpacing', {
      elementId,
      marginTop: `${before}pt`,
      marginBottom: `${after}pt`
    })
  }

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

  const handleTextTransformChange = async (value: TextTransform) => {
    setTextTransform(value)
    await onSendCommand('setTextBoxTextTransform', { elementId, textTransform: value })
  }

  const handleCssClassesChange = async (classes: string[]) => {
    setCssClasses(classes)
    await onSendCommand('setElementClasses', { elementId, classes })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Font Section */}
      <PanelSection title="Font">
        {/* Font Family + Weight Row */}
        <div className="flex gap-2">
          <div className="flex-[3]">
            <PanelSelect
              options={FONT_FAMILIES}
              value={fontFamily}
              onChange={handleFontChange}
              disabled={isApplying}
            />
          </div>
          <div className="flex-[2]">
            <PanelSelect
              options={FONT_WEIGHTS}
              value={fontWeight}
              onChange={handleWeightChange}
              disabled={isApplying}
            />
          </div>
        </div>

        {/* Size + Style Row */}
        <div className="flex gap-2">
          {/* Font Size with dropdown */}
          <div className="relative w-20">
            <div className="flex items-center h-7 bg-gray-800/60 rounded-md border border-transparent hover:border-gray-700 transition-colors">
              <input
                ref={fontSizeInputRef}
                type="text"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => fontSize && handleSizeChange(fontSize)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSizeChange(fontSize)
                    fontSizeInputRef.current?.blur()
                  }
                }}
                disabled={isApplying}
                className="w-full px-2 py-1 bg-transparent text-[11px] text-white focus:outline-none text-center"
              />
              <span className="text-[10px] text-gray-500 pr-1">pt</span>
              <button
                onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
                disabled={isApplying}
                className="px-1 py-1 hover:bg-gray-700 rounded-r-md transition-colors border-l border-gray-700"
              >
                <ChevronDown className="h-2.5 w-2.5 text-gray-400" />
              </button>
            </div>
            {isSizeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-md shadow-xl z-20 max-h-32 overflow-y-auto border border-gray-700">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    className={cn(
                      "w-full px-2 py-1 text-left text-[11px] hover:bg-gray-700 transition-colors",
                      size === fontSize && "bg-gray-700 text-blue-400"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Style Buttons (B/I/U/S) */}
          <div className="flex flex-1 bg-gray-800/60 rounded-md h-7">
            <IconButton
              icon={<Bold className="h-3.5 w-3.5" />}
              onClick={() => handleFormatCommand('bold')}
              disabled={isApplying}
              title="Bold"
            />
            <IconButton
              icon={<Italic className="h-3.5 w-3.5" />}
              onClick={() => handleFormatCommand('italic')}
              disabled={isApplying}
              title="Italic"
            />
            <IconButton
              icon={<Underline className="h-3.5 w-3.5" />}
              onClick={() => handleFormatCommand('underline')}
              disabled={isApplying}
              title="Underline"
            />
            <IconButton
              icon={<Strikethrough className="h-3.5 w-3.5" />}
              onClick={() => handleFormatCommand('strikethrough')}
              disabled={isApplying}
              title="Strikethrough"
            />
          </div>
        </div>

        {/* Colors Row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <ControlRow label="Text" labelWidth="sm">
              <CompactColorPicker
                value={textColor}
                onChange={handleColorChange}
                disabled={isApplying}
              />
            </ControlRow>
          </div>
          <div className="flex-1">
            <ControlRow label="Highlight" labelWidth="sm">
              <CompactColorPicker
                value={highlightColor}
                onChange={handleHighlightChange}
                disabled={isApplying}
                allowNoFill={true}
              />
            </ControlRow>
          </div>
        </div>
      </PanelSection>

      <Divider />

      {/* Alignment Section */}
      <PanelSection title="Alignment">
        <div className="flex gap-2">
          {/* Horizontal Alignment */}
          <div className="flex flex-[3] bg-gray-800/60 rounded-md h-7">
            <IconButton
              icon={<AlignLeft className="h-3.5 w-3.5" />}
              onClick={() => handleAlignment('left')}
              disabled={isApplying}
              title="Align Left"
            />
            <IconButton
              icon={<AlignCenter className="h-3.5 w-3.5" />}
              onClick={() => handleAlignment('center')}
              disabled={isApplying}
              title="Align Center"
            />
            <IconButton
              icon={<AlignRight className="h-3.5 w-3.5" />}
              onClick={() => handleAlignment('right')}
              disabled={isApplying}
              title="Align Right"
            />
            <IconButton
              icon={<AlignJustify className="h-3.5 w-3.5" />}
              onClick={() => handleAlignment('justify')}
              disabled={isApplying}
              title="Justify"
            />
          </div>

          {/* Vertical Alignment */}
          <div className="flex flex-[2] bg-gray-800/60 rounded-md h-7">
            <IconButton
              icon={<AlignVerticalJustifyStart className="h-3.5 w-3.5" />}
              onClick={() => handleVerticalAlignment('top')}
              disabled={isApplying}
              title="Align Top"
            />
            <IconButton
              icon={<AlignVerticalJustifyCenter className="h-3.5 w-3.5" />}
              onClick={() => handleVerticalAlignment('middle')}
              disabled={isApplying}
              title="Align Middle"
            />
            <IconButton
              icon={<AlignVerticalJustifyEnd className="h-3.5 w-3.5" />}
              onClick={() => handleVerticalAlignment('bottom')}
              disabled={isApplying}
              title="Align Bottom"
            />
          </div>
        </div>

        {/* Transform */}
        <ControlRow label="Transform" labelWidth="md">
          <PanelSelect
            options={TEXT_TRANSFORMS.map(t => ({ value: t.transform, label: t.label }))}
            value={textTransform}
            onChange={handleTextTransformChange}
            disabled={isApplying}
          />
        </ControlRow>
      </PanelSection>

      <Divider />

      {/* Spacing Section (Collapsible) */}
      <PanelSection title="Spacing" collapsible defaultOpen={false}>
        <ControlRow label="Line height" labelWidth="lg">
          <PanelSelect
            options={LINE_HEIGHTS}
            value={lineHeight}
            onChange={handleLineHeight}
            disabled={isApplying}
            className="w-20"
          />
        </ControlRow>

        <ControlRow label="Before" labelWidth="lg">
          <PanelInput
            type="number"
            value={beforeParagraph}
            onChange={setBeforeParagraph}
            onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
            suffix="pt"
            min={0}
            max={100}
            className="w-20"
          />
        </ControlRow>

        <ControlRow label="After" labelWidth="lg">
          <PanelInput
            type="number"
            value={afterParagraph}
            onChange={setAfterParagraph}
            onBlur={() => handleParagraphSpacing(beforeParagraph, afterParagraph)}
            suffix="pt"
            min={0}
            max={100}
            className="w-20"
          />
        </ControlRow>
      </PanelSection>

      {/* Lists Section (Collapsible) */}
      <PanelSection title="Lists" collapsible defaultOpen={false}>
        <div className="flex gap-2">
          <button
            onClick={() => handleFormatCommand('insertUnorderedList')}
            disabled={isApplying}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-8",
              "bg-gray-800/60 rounded-md",
              "text-[11px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50"
            )}
          >
            <List className="h-3.5 w-3.5" />
            Bullets
          </button>
          <button
            onClick={() => handleFormatCommand('insertOrderedList')}
            disabled={isApplying}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-8",
              "bg-gray-800/60 rounded-md",
              "text-[11px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50"
            )}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Numbered
          </button>
        </div>
      </PanelSection>

      {/* Box Style Section (Collapsible) */}
      <PanelSection title="Box Style" collapsible defaultOpen={false}>
        <ControlRow label="Padding" labelWidth="md">
          <PanelInput
            type="number"
            value={textInset}
            onChange={setTextInset}
            onBlur={() => handleTextInsetChange(textInset)}
            suffix="pt"
            min={0}
            max={100}
            className="w-20"
          />
        </ControlRow>

        <ControlRow label="Border" labelWidth="md">
          <PanelSelect
            options={BORDER_STYLES}
            value={borderStyle}
            onChange={handleBorderStyleChange}
            disabled={isApplying}
          />
        </ControlRow>

        {borderStyle !== 'none' && (
          <>
            <div className="flex gap-2 pl-[80px]">
              <CompactColorPicker
                value={borderColor}
                onChange={handleBorderColorChange}
                disabled={isApplying}
              />
              <PanelInput
                type="number"
                value={borderWidth}
                onChange={setBorderWidth}
                onBlur={() => handleBorderWidthChange(borderWidth)}
                suffix="pt"
                min={1}
                max={10}
                className="w-16"
              />
            </div>

            <ControlRow label="Rounded" labelWidth="md">
              <Toggle
                checked={roundedCorners}
                onChange={handleRoundedCornersChange}
                disabled={isApplying}
              />
            </ControlRow>
          </>
        )}

        <ControlRow label="Fill" labelWidth="md">
          <CompactColorPicker
            value={boxBackground}
            onChange={handleBoxBackgroundChange}
            disabled={isApplying}
            allowNoFill={true}
          />
        </ControlRow>

        <Divider />

        <div className="space-y-2">
          <span className="text-[10px] text-gray-500">CSS Classes</span>
          <CSSClassesInput
            value={cssClasses}
            onChange={handleCssClassesChange}
            disabled={isApplying}
            placeholder="Add class..."
          />
        </div>
      </PanelSection>
    </div>
  )
}
