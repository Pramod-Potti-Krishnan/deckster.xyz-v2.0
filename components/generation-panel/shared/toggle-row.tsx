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
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(field, option.value)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              value === option.value
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
