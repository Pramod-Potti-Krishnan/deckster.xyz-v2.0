'use client'

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
    <div className="flex items-center justify-between gap-2">
      <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">{label}</label>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
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
