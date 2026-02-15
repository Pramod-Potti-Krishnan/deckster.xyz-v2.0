'use client'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function PromptInput({
  value,
  onChange,
  placeholder = 'Describe what you want to generate...',
  disabled = false,
}: PromptInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">Prompt</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none disabled:opacity-50"
      />
    </div>
  )
}
