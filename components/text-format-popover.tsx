"use client"

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Palette
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormatTextParams {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: string
  fontFamily?: string
  color?: string
  backgroundColor?: string
  alignment?: 'left' | 'center' | 'right' | 'justify'
}

interface TextFormatPopoverProps {
  onFormat: (params: FormatTextParams) => Promise<boolean>
  disabled?: boolean
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
const FONT_FAMILIES = ['Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana']
const COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
]

export function TextFormatPopover({ onFormat, disabled = false }: TextFormatPopoverProps) {
  const [open, setOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleFormat = async (params: FormatTextParams) => {
    setIsApplying(true)
    try {
      await onFormat(params)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Text formatting"
        >
          <Type className="h-5 w-5 text-gray-700" />
          <span className="text-[10px] text-gray-500">Text</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="center">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Text Formatting</h4>

          {/* Basic Formatting */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ bold: true })}
              disabled={isApplying}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ italic: true })}
              disabled={isApplying}
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ underline: true })}
              disabled={isApplying}
              title="Underline (Ctrl+U)"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ strikethrough: true })}
              disabled={isApplying}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
          </div>

          {/* Font Size & Family */}
          <div className="flex items-center gap-2">
            <Select onValueChange={(value) => handleFormat({ fontSize: value })}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={(value) => handleFormat({ fontFamily: value })}>
              <SelectTrigger className="flex-1 h-8">
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ alignment: 'left' })}
              disabled={isApplying}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ alignment: 'center' })}
              disabled={isApplying}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ alignment: 'right' })}
              disabled={isApplying}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handleFormat({ alignment: 'justify' })}
              disabled={isApplying}
              title="Justify"
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          {/* Text Color */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-600">Text Color</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform",
                    isApplying && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => handleFormat({ color })}
                  disabled={isApplying}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Highlight Color */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-600">Highlight</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                className={cn(
                  "w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform bg-white",
                  isApplying && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handleFormat({ backgroundColor: 'transparent' })}
                disabled={isApplying}
                title="No highlight"
              >
                <span className="text-xs text-gray-400">x</span>
              </button>
              {['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform",
                    isApplying && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => handleFormat({ backgroundColor: color })}
                  disabled={isApplying}
                  title={color}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Select text in the slide first, then apply formatting
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
