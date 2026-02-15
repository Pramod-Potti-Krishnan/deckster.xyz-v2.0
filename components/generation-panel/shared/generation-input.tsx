'use client'

import { useRef } from 'react'
import { SlidersHorizontal, Sparkles, Loader2, ChevronDown, AlertCircle, RotateCcw, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MandatoryConfig } from '../types'

interface GenerationInputProps {
  prompt: string
  onPromptChange: (value: string) => void
  mandatoryConfig: MandatoryConfig | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onSubmit: () => void
  isGenerating: boolean
  error: string | null
}

export function GenerationInput({
  prompt,
  onPromptChange,
  mandatoryConfig,
  showAdvanced,
  onToggleAdvanced,
  onSubmit,
  isGenerating,
  error,
}: GenerationInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const placeholder = mandatoryConfig?.promptPlaceholder || 'Describe what you want to generate...'

  return (
    <div className="px-3 pt-3 pb-2 space-y-2">
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-600 break-words">{error}</p>
            <button
              onClick={onSubmit}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Chat-style input container */}
      <div className="relative bg-gray-50 rounded-xl border border-gray-200 focus-within:border-gray-300 focus-within:shadow-sm transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={placeholder}
          disabled={isGenerating}
          className="w-full resize-y border-0 bg-transparent focus:ring-0 focus:outline-none px-3 pt-3 pb-12 min-h-[60px] max-h-[200px] text-xs placeholder:text-gray-400 overflow-y-auto text-gray-900 disabled:opacity-50"
          rows={2}
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-b-xl">
          {/* Left: Mandatory chip + Advanced toggle */}
          <div className="flex items-center gap-1">
            {/* Mandatory config chip */}
            {mandatoryConfig && (
              <MandatoryChip config={mandatoryConfig} />
            )}

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={onToggleAdvanced}
              className={`p-1.5 rounded-lg transition-colors ${
                showAdvanced
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:bg-gray-200'
              }`}
              title={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Right: Send button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isGenerating}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
              isGenerating
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 text-white'
            }`}
            title="Generate (⌘↵)"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function MandatoryChip({ config }: { config: MandatoryConfig }) {
  const hasGroups = config.optionGroups && config.optionGroups.length > 0
  const hasOptions = config.options && config.options.length > 0

  if (!hasGroups && !hasOptions) {
    // No options — just show a static chip
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs text-gray-600">
        <span className="truncate max-w-[120px]">{config.displayLabel}</span>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 transition-colors"
        >
          <ChevronDown className="h-3 w-3 text-gray-400" />
          <span className="truncate max-w-[120px]">{config.displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1" sideOffset={4}>
        {hasGroups ? (
          // Grouped options (chart types, image styles)
          <div className="space-y-1">
            {config.optionGroups!.map((group) => (
              <div key={group.group}>
                <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {group.group}
                </div>
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => config.onChange(option.value)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      config.displayLabel === option.label
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {config.displayLabel === option.label && (
                      <Check className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className={config.displayLabel === option.label ? '' : 'pl-5'}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Flat options (content source, mode, shape)
          <div className="space-y-0.5">
            {config.options!.map((option) => (
              <button
                key={option.value}
                onClick={() => config.onChange(option.value)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  config.displayLabel === option.label
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {config.displayLabel === option.label && (
                  <Check className="h-3 w-3 flex-shrink-0" />
                )}
                <span className={config.displayLabel === option.label ? '' : 'pl-5'}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
