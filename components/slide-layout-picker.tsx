"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ChevronDown, Type, Layout, Columns, Image, Quote, Presentation } from 'lucide-react'

export type SlideLayoutId = 'L01' | 'L02' | 'L03' | 'L25' | 'L27' | 'L29'

export interface SlideLayout {
  id: SlideLayoutId
  name: string
  description: string
  icon: React.ReactNode
}

// Layout definitions with friendly names
export const SLIDE_LAYOUTS: SlideLayout[] = [
  {
    id: 'L01',
    name: 'Title Slide',
    description: 'Centered title for opening or section breaks',
    icon: <Type className="h-4 w-4" />
  },
  {
    id: 'L02',
    name: 'Section Header',
    description: 'Bold header for section dividers',
    icon: <Presentation className="h-4 w-4" />
  },
  {
    id: 'L03',
    name: 'Content',
    description: 'Standard content slide with title and body',
    icon: <Layout className="h-4 w-4" />
  },
  {
    id: 'L25',
    name: 'Two Column',
    description: 'Side-by-side content areas',
    icon: <Columns className="h-4 w-4" />
  },
  {
    id: 'L27',
    name: 'Image Focus',
    description: 'Large image with supporting text',
    icon: <Image className="h-4 w-4" />
  },
  {
    id: 'L29',
    name: 'Hero',
    description: 'Full-bleed visual impact slide',
    icon: <Quote className="h-4 w-4" />
  }
]

interface SlideLayoutPickerProps {
  onAddSlide: (layoutId: SlideLayoutId) => Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * SlideLayoutPicker Component
 *
 * Dropdown button for adding new slides with layout selection.
 * Displays friendly layout names with icons.
 */
export function SlideLayoutPicker({
  onAddSlide,
  disabled = false,
  className = ''
}: SlideLayoutPickerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [open, setOpen] = useState(false)

  const handleSelectLayout = async (layout: SlideLayout) => {
    setIsAdding(true)
    setOpen(false)
    try {
      await onAddSlide(layout.id)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || isAdding}
          className={`h-8 ${className}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          {isAdding ? 'Adding...' : 'Add'}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Select Layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SLIDE_LAYOUTS.map((layout) => (
          <DropdownMenuItem
            key={layout.id}
            onClick={() => handleSelectLayout(layout)}
            className="flex items-start gap-3 py-2 cursor-pointer"
          >
            <div className="flex-shrink-0 mt-0.5 text-gray-500">
              {layout.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{layout.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {layout.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
