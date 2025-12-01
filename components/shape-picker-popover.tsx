"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Square, Circle, ArrowRight, Minus, Triangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InsertShapeParams {
  type: 'rectangle' | 'circle' | 'arrow' | 'line' | 'triangle'
  fill?: string
  stroke?: string
  strokeWidth?: number
}

interface ShapePickerPopoverProps {
  onInsertShape: (params: InsertShapeParams) => Promise<void>
  disabled?: boolean
}

const SHAPES = [
  { type: 'rectangle' as const, icon: Square, label: 'Rectangle' },
  { type: 'circle' as const, icon: Circle, label: 'Circle' },
  { type: 'arrow' as const, icon: ArrowRight, label: 'Arrow' },
  { type: 'line' as const, icon: Minus, label: 'Line' },
  { type: 'triangle' as const, icon: Triangle, label: 'Triangle' },
]

const FILL_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#ffffff', 'transparent'
]

const STROKE_COLORS = [
  '#1e40af', '#047857', '#b45309', '#b91c1c', '#6d28d9',
  '#be185d', '#0e7490', '#4d7c0f', '#374151', '#000000'
]

export function ShapePickerPopover({ onInsertShape, disabled = false }: ShapePickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedFill, setSelectedFill] = useState('#3b82f6')
  const [selectedStroke, setSelectedStroke] = useState('#1e40af')
  const [isInserting, setIsInserting] = useState(false)

  const handleInsertShape = async (type: InsertShapeParams['type']) => {
    setIsInserting(true)
    try {
      await onInsertShape({
        type,
        fill: selectedFill,
        stroke: selectedStroke,
        strokeWidth: 2
      })
      setOpen(false)
    } finally {
      setIsInserting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Insert shape"
        >
          <Square className="h-5 w-5 text-gray-700" />
          <span className="text-[10px] text-gray-500">Shape</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Insert Shape</h4>

          {/* Shape Selection */}
          <div className="grid grid-cols-5 gap-2">
            {SHAPES.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={() => handleInsertShape(type)}
                disabled={isInserting}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </div>

          {/* Fill Color */}
          <div>
            <span className="text-xs text-gray-600 mb-1 block">Fill Color</span>
            <div className="flex flex-wrap gap-1">
              {FILL_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    selectedFill === color ? "border-blue-500 scale-110" : "border-gray-300",
                    color === 'transparent' && "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI4IiB2aWV3Qm94PSIwIDAgOCA4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]"
                  )}
                  style={{ backgroundColor: color === 'transparent' ? undefined : color }}
                  onClick={() => setSelectedFill(color)}
                  title={color === 'transparent' ? 'No fill' : color}
                />
              ))}
            </div>
          </div>

          {/* Stroke Color */}
          <div>
            <span className="text-xs text-gray-600 mb-1 block">Stroke Color</span>
            <div className="flex flex-wrap gap-1">
              {STROKE_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    selectedStroke === color ? "border-blue-500 scale-110" : "border-gray-300"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedStroke(color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Click a shape to insert it on the current slide
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
