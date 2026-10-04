'use client'

import './studio-generation-choices.css'

const STUDIO_GENERATION_CHOICES = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface ToggleOption {
  value: string
  label: string
}

interface ToggleRowProps {
  label: string
  field: string
  value: string
  options: ToggleOption[]
  onChange: (field: string, value: string) => void
}

export function ToggleRow({ label, field, value, options, onChange }: ToggleRowProps) {
  return (
    <div data-studio-generation-choices={STUDIO_GENERATION_CHOICES ? 'true' : undefined} className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">{label}</span>
      <div className="flex gap-1" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={STUDIO_GENERATION_CHOICES ? `${label}: ${option.label}` : undefined}
            aria-pressed={value === option.value}
            onClick={() => onChange(field, option.value)}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              value === option.value
                ? 'bg-primary text-white border border-primary'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
