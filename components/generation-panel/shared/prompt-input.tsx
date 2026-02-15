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
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-gray-600">Prompt</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none disabled:opacity-50"
      />
    </div>
  )
}
