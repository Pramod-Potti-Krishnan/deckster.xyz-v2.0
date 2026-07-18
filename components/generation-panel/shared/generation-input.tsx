'use client'

import { useRef, useEffect } from 'react'
import { SlidersHorizontal, ArrowUp, Loader2, ChevronDown, AlertCircle, RotateCcw, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MandatoryConfig } from '../types'
import { elementPromptLengthState } from '@/lib/element-prompt-limit'
import type { ElementGenerationSubmitIntent } from '@/lib/element-generation-retry'

interface GenerationInputProps {
  prompt: string
  onPromptChange: (value: string) => void
  mandatoryConfig: MandatoryConfig | MandatoryConfig[] | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onSubmit: (intent: ElementGenerationSubmitIntent) => void
  isGenerating: boolean
  error: string | null
  placeholder?: string
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
  placeholder: placeholderOverride,
}: GenerationInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mandatoryConfigs = Array.isArray(mandatoryConfig)
    ? mandatoryConfig
    : mandatoryConfig
      ? [mandatoryConfig]
      : []
  const promptLimitConfig = mandatoryConfigs.find(config => (
    typeof config.promptMaxLength === 'number' && config.promptMaxLength > 0
  ))
  const promptMaxLength = promptLimitConfig?.promptMaxLength
  const promptLengthState = elementPromptLengthState(prompt, promptMaxLength)
  const promptOverLimit = promptLengthState.overLimit
  const promptOverflow = promptLengthState.overflow
  const submitDisabled = isGenerating || promptOverLimit
  const handleSubmit = () => {
    if (!submitDisabled) onSubmit('generate')
  }
  const handleRetry = () => {
    if (!submitDisabled) onSubmit('retry')
  }

  // Auto-expand textarea as user types
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [prompt])

  const placeholder = placeholderOverride
    || mandatoryConfigs.find(config => config.promptPlaceholder)?.promptPlaceholder
    || 'Describe what you want to generate...'

  return (
    <div className="px-3 pt-3 pb-2 space-y-2">
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-600 break-words">{error}</p>
            <button
              onClick={handleRetry}
              disabled={submitDisabled}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Chat-style input container */}
      <div className="relative bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:border-gray-300 dark:border-slate-600 focus-within:shadow-sm transition-all">
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={placeholder}
            disabled={isGenerating}
            aria-invalid={promptOverLimit}
            aria-describedby={promptMaxLength ? 'generation-prompt-limit' : undefined}
            className="w-full resize-y border-0 bg-transparent focus:ring-0 focus:outline-none px-3 pt-3 pb-12 min-h-[60px] max-h-[160px] text-xs placeholder:text-gray-400 dark:text-slate-500 overflow-y-auto text-gray-900 dark:text-slate-100 disabled:opacity-50"
            rows={2}
          />
          {/* Resize grip indicator */}
          <div className="absolute bottom-12 right-1.5 pointer-events-none text-gray-300">
            <svg width="8" height="8" viewBox="0 0 8 8">
              <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth="1" />
              <line x1="7" y1="4" x2="4" y2="7" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-b-xl">
          {/* Left: Mandatory chip + Advanced toggle */}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-1">
            {/* Mandatory config chip (or custom render) */}
            {mandatoryConfigs.map((config, index) => (
              config.customRender ? (
                <div key={`${config.fieldLabel}:${index}`}>{config.customRender}</div>
              ) : (
                <MandatoryChip key={`${config.fieldLabel}:${index}`} config={config} />
              )
            ))}

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={onToggleAdvanced}
              className={`p-1.5 rounded-lg transition-colors ${
                showAdvanced
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
              }`}
              title={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Right: Send button with decorative stars */}
          <div className="relative flex-shrink-0">
            {/* Decorative stars */}
            <svg className="absolute -top-1 -right-1 w-2 h-2 text-purple-300 pointer-events-none" viewBox="0 0 8 8">
              <path d="M4 0L4.5 3.5L8 4L4.5 4.5L4 8L3.5 4.5L0 4L3.5 3.5Z" fill="currentColor" />
            </svg>
            <svg className="absolute -bottom-0.5 -left-1.5 w-1.5 h-1.5 text-purple-200 pointer-events-none" viewBox="0 0 8 8">
              <path d="M4 0L4.5 3.5L8 4L4.5 4.5L4 8L3.5 4.5L0 4L3.5 3.5Z" fill="currentColor" />
            </svg>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                submitDisabled
                  ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
              title={promptOverLimit ? 'Shorten the prompt before generating' : 'Generate (⌘↵)'}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      {promptMaxLength && (
        <div
          id="generation-prompt-limit"
          className={`flex items-start justify-between gap-2 px-1 text-[10px] ${
            promptOverLimit
              ? 'font-medium text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-slate-400'
          }`}
          aria-live="polite"
        >
          <span>
            {promptOverLimit
              ? `${promptLimitConfig?.promptLimitLabel ?? 'Prompt'} is ${promptOverflow.toLocaleString()} character${promptOverflow === 1 ? '' : 's'} too long.`
              : `${promptLimitConfig?.promptLimitLabel ?? 'Prompt'} limit`}
          </span>
          <span className="whitespace-nowrap">
            {promptLengthState.length.toLocaleString()} / {promptMaxLength.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

function MandatoryChip({ config }: { config: MandatoryConfig }) {
  const hasGroups = config.optionGroups && config.optionGroups.length > 0
  const hasOptions = config.options && config.options.length > 0
  const allOptions = hasGroups
    ? config.optionGroups!.flatMap(group => group.options)
    : config.options || []
  const selectedOption = allOptions.find(option => (
    config.selectedValue
      ? option.value === config.selectedValue
      : option.label === config.displayLabel
  ))
  const isSelected = (value: string, label: string) => (
    config.selectedValue ? config.selectedValue === value : config.displayLabel === label
  )

  if (!hasGroups && !hasOptions) {
    // No options — just show a static chip
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-xs text-gray-600 dark:text-slate-300">
        <span className="truncate max-w-[120px]">{config.displayLabel}</span>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={config.fieldLabel}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700 text-xs text-gray-700 dark:text-slate-200 transition-colors"
        >
          <ChevronDown className="h-3 w-3 text-gray-400 dark:text-slate-500" />
          {selectedOption?.color && (
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className="truncate max-w-[120px]">{config.displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1" sideOffset={4}>
        {hasGroups ? (
          // Grouped options (chart types, image styles)
          <div className="space-y-1">
            {config.optionGroups!.map((group) => (
              <div key={group.group}>
                <div className="px-2 py-1 text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.group}
                </div>
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => config.onChange(option.value)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      isSelected(option.value, option.label)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700'
                    }`}
                  >
                    <span className="h-3 w-3 flex-shrink-0">
                      {isSelected(option.value, option.label) && <Check className="h-3 w-3" />}
                    </span>
                    {option.color && (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span>{option.label}</span>
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
                  isSelected(option.value, option.label)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700'
                }`}
              >
                <span className="h-3 w-3 flex-shrink-0">
                  {isSelected(option.value, option.label) && <Check className="h-3 w-3" />}
                </span>
                {option.color && (
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
