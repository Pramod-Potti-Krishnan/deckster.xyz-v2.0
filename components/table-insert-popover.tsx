"use client"

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableInsertPopoverProps {
  onInsertTable: (rows: number, cols: number) => Promise<void>
  disabled?: boolean
}

const MAX_ROWS = 8
const MAX_COLS = 8

export function TableInsertPopover({ onInsertTable, disabled = false }: TableInsertPopoverProps) {
  const [open, setOpen] = useState(false)
  const [hoveredRows, setHoveredRows] = useState(0)
  const [hoveredCols, setHoveredCols] = useState(0)
  const [isInserting, setIsInserting] = useState(false)

  const handleInsertTable = async () => {
    if (hoveredRows === 0 || hoveredCols === 0) return

    setIsInserting(true)
    try {
      await onInsertTable(hoveredRows, hoveredCols)
      setOpen(false)
      setHoveredRows(0)
      setHoveredCols(0)
    } finally {
      setIsInserting(false)
    }
  }

  const handleCellHover = (row: number, col: number) => {
    setHoveredRows(row)
    setHoveredCols(col)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Insert table"
        >
          <Table2 className="h-5 w-5 text-gray-700" />
          <span className="text-[10px] text-gray-500">Table</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="center">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Insert Table</h4>

          {/* Grid Selector */}
          <div
            className="inline-grid gap-1"
            style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)` }}
            onMouseLeave={() => {
              setHoveredRows(0)
              setHoveredCols(0)
            }}
          >
            {Array.from({ length: MAX_ROWS }).map((_, rowIndex) =>
              Array.from({ length: MAX_COLS }).map((_, colIndex) => {
                const row = rowIndex + 1
                const col = colIndex + 1
                const isHighlighted = row <= hoveredRows && col <= hoveredCols

                return (
                  <div
                    key={`${row}-${col}`}
                    className={cn(
                      "w-5 h-5 border rounded-sm cursor-pointer transition-colors",
                      isHighlighted
                        ? "bg-blue-500 border-blue-600"
                        : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                    )}
                    onMouseEnter={() => handleCellHover(row, col)}
                    onClick={handleInsertTable}
                  />
                )
              })
            )}
          </div>

          {/* Size Display */}
          <div className="text-center text-sm text-gray-600">
            {hoveredRows > 0 && hoveredCols > 0 ? (
              <span className="font-medium">
                {hoveredRows} x {hoveredCols} table
              </span>
            ) : (
              <span>Hover to select size</span>
            )}
          </div>

          {isInserting && (
            <div className="text-center text-xs text-blue-600">
              Inserting table...
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Generate HTML table with empty cells
 */
export function generateTableHTML(rows: number, cols: number): string {
  const headerCells = Array.from({ length: cols }, (_, i) =>
    `<th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Header ${i + 1}</th>`
  ).join('')

  const bodyRows = Array.from({ length: rows - 1 }, (_, rowIndex) => {
    const cells = Array.from({ length: cols }, (_, colIndex) =>
      `<td style="border: 1px solid #d1d5db; padding: 8px 12px;">Cell ${rowIndex + 1}-${colIndex + 1}</td>`
    ).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  return `
    <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `.trim()
}
