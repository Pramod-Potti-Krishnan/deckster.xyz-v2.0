'use client'

interface ZIndexInputProps {
  value: number
  onChange: (value: number) => void
  onAdvancedModified: () => void
}

export function ZIndexInput({ value, onChange, onAdvancedModified }: ZIndexInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">Z-Index</label>
      <input
        type="number"
        value={value}
        min={1}
        max={200}
        onChange={(e) => {
          onChange(Number(e.target.value))
          onAdvancedModified()
        }}
        className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
    </div>
  )
}
