"use client"

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
}: StepperProps) {
  const handleDecrement = () => {
    const newValue = value - step
    if (newValue >= min) {
      onChange(newValue)
    }
  }

  const handleIncrement = () => {
    const newValue = value + step
    if (newValue <= max) {
      onChange(newValue)
    }
  }

  return (
    <div className={cn("flex items-center bg-gray-800/60 rounded-md h-7", className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn(
          "flex items-center justify-center w-7 h-full rounded-l-md",
          "text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        )}
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-10 text-center text-[11px] font-medium text-white">
        {value}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn(
          "flex items-center justify-center w-7 h-full rounded-r-md",
          "text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        )}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}
