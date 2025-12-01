"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { BarChart3, LineChart, PieChart, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InsertChartParams {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea'
  data?: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string
    }>
  }
  options?: Record<string, unknown>
}

interface ChartPickerPopoverProps {
  onInsertChart: (params: InsertChartParams) => Promise<void>
  disabled?: boolean
}

const CHART_TYPES = [
  { type: 'bar' as const, icon: BarChart3, label: 'Bar Chart' },
  { type: 'line' as const, icon: LineChart, label: 'Line Chart' },
  { type: 'pie' as const, icon: PieChart, label: 'Pie Chart' },
  { type: 'doughnut' as const, icon: Activity, label: 'Doughnut Chart' },
]

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function getDefaultChartData(type: InsertChartParams['type']) {
  const baseData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{
      label: 'Data Series',
      data: [12, 19, 15, 25],
      backgroundColor: type === 'line' ? 'rgba(59, 130, 246, 0.1)' : DEFAULT_COLORS,
      borderColor: type === 'line' ? '#3b82f6' : undefined,
    }]
  }
  return baseData
}

export function ChartPickerPopover({ onInsertChart, disabled = false }: ChartPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [isInserting, setIsInserting] = useState(false)

  const handleInsertChart = async (type: InsertChartParams['type']) => {
    setIsInserting(true)
    try {
      await onInsertChart({
        type,
        data: getDefaultChartData(type),
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
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
          title="Insert chart"
        >
          <BarChart3 className="h-5 w-5 text-gray-700" />
          <span className="text-[10px] text-gray-500">Chart</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Insert Chart</h4>

          {/* Chart Type Selection */}
          <div className="grid grid-cols-2 gap-2">
            {CHART_TYPES.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                className={cn(
                  "h-16 flex flex-col items-center justify-center gap-1",
                  isInserting && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handleInsertChart(type)}
                disabled={isInserting}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>

          {/* Preview Colors */}
          <div>
            <span className="text-xs text-gray-600 mb-1 block">Chart Colors</span>
            <div className="flex gap-1">
              {DEFAULT_COLORS.map((color) => (
                <div
                  key={color}
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Click a chart type to insert with sample data. You can edit the data later.
          </p>

          {isInserting && (
            <div className="text-center text-xs text-blue-600">
              Inserting chart...
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Generate Chart.js configuration for insertion
 */
export function generateChartConfig(params: InsertChartParams): Record<string, unknown> {
  return {
    type: params.type,
    data: params.data || getDefaultChartData(params.type),
    options: params.options || {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  }
}
