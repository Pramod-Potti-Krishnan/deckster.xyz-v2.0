'use client'
import './studio-generation-geometry.css'

const STUDIO_GEOMETRY = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface ZIndexInputProps {
  value: number
  onChange: (value: number) => void
  onAdvancedModified: () => void
}

export function ZIndexInput({ value, onChange, onAdvancedModified }: ZIndexInputProps) {
  return (
    <div data-studio-v4-shell={STUDIO_GEOMETRY ? 'true' : undefined} data-studio-generation-geometry={STUDIO_GEOMETRY ? 'z-index' : undefined} className="flex items-center justify-between gap-2">
      <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">Z-Index</label>
      <input
        aria-label={STUDIO_GEOMETRY ? 'Z-Index' : undefined}
        type="number"
        value={value}
        min={1}
        max={200}
        onChange={(e) => {
          onChange(Number(e.target.value))
          onAdvancedModified()
        }}
        className="w-20 px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
