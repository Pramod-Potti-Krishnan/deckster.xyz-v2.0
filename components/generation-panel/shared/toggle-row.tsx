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
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(field, option.value)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              value === option.value
                ? 'bg-purple-600 text-white border border-purple-600'
                : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
