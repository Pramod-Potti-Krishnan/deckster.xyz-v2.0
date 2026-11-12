'use client'

import { useRef, useEffect } from 'react'
import { SlidersHorizontal, ArrowUp, Loader2, ChevronDown, AlertCircle, RotateCcw, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MandatoryConfig } from '../types'
import { elementPromptLengthState } from '@/lib/element-prompt-limit'
import type { ElementGenerationSubmitIntent } from '@/lib/element-generation-retry'
import type { TextLabsRetryStrategy } from '@/lib/textlabs-client'
import './studio-generation-options.css'
import './studio-generation-feedback.css'

const STUDIO_GENERATION_FEEDBACK = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface GenerationInputProps {
  prompt: string
  onPromptChange: (value: string) => void
  mandatoryConfig: MandatoryConfig | MandatoryConfig[] | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onSubmit: (intent: ElementGenerationSubmitIntent) => void
  isGenerating: boolean
  error: string | null
  retryStrategy?: TextLabsRetryStrategy | null
  placeholder?: string
  /**
   * J2-F7: keep the Generate button where it is while the prompt changes. The box otherwise
   * re-measures its textarea on every edit, so the button moves between its resting position
   * (measured while the closed panel has no width: 160px), the first keystroke (118px) and the
   * grown prompt (back to 160px). With this on the textarea has the fixed height the box already
   * reaches when full and scrolls inside it. Default off: unchanged.
   */
  stableSubmit?: boolean
  /**
   * J3-EMPTY-PROMPT-GUARD (NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD): set by the panel while a required prompt is empty. Generate (and the
   * error box's retry) is then disabled, aria-disabled, and carries this text as its hint. Default off / not set: unchanged.
   */
  emptyPromptHint?: string | null
  /**
   * PASS2B J3-05 (NEXT_PUBLIC_STUDIO_GENERATING_STATUS): the panel sets it with the flag on: the status sentence while an element generates
   * ("Generating chart… usually 10–30 s"), an empty string otherwise. It fills an aria-live="polite" line under the box. Default off / not set
   * (undefined): nothing is rendered and the input is unchanged.
   */
  generatingStatus?: string
  /**
   * PASS2B J3-02 (NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS): the panel sets it (a key per new activation) only with the flag on, in generate mode while open.
   * When it changes the box takes focus once the picking menu is gone, through `scheduleFocus` (lib/studio-prompt-autofocus.ts, handed in by the panel
   * so this file imports nothing new). Default off / not set (undefined): unchanged.
   */
  autoFocusKey?: string
  scheduleFocus?: (getBox: () => HTMLTextAreaElement | null) => () => void
}

const STABLE_SUBMIT_TEXTAREA_STYLE = { height: 160 } as const

/** PASS2B J3-04: the id of the visually hidden hint a blocked Generate button is described by (static, like the prompt-limit id below). */
const EMPTY_PROMPT_HINT_ID = 'generation-empty-prompt-hint'

/** PASS2B J3-09: the id of the visible line that says why the prompt box is not taking text (static, like the ids around it). */
const PROMPT_DISABLED_HINT_ID = 'generation-prompt-disabled-hint'

export function GenerationInput({
  prompt,
  onPromptChange,
  mandatoryConfig,
  showAdvanced,
  onToggleAdvanced,
  onSubmit,
  isGenerating,
  error,
  retryStrategy,
  placeholder: placeholderOverride,
  stableSubmit,
  emptyPromptHint,
  generatingStatus,
  autoFocusKey,
  scheduleFocus,
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
  // PASS2B J3-09 (NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT): a form that does not read the prompt right now (a preset Shape) says so here; the box
  // then takes no text (read-only, aria-disabled; the typed text stays) and the line below it says why. Forms set it only with the flag on.
  const promptDisabledHint = mandatoryConfigs.find(config => config.promptDisabledHint)?.promptDisabledHint ?? null
  const promptLengthState = elementPromptLengthState(prompt, promptMaxLength)
  const promptOverLimit = promptLengthState.overLimit
  const promptOverflow = promptLengthState.overflow
  const promptGuardHint = emptyPromptHint ? emptyPromptHint : null
  const promptGuardBlocked = promptGuardHint !== null
  const submitDisabled = isGenerating || promptOverLimit || promptGuardBlocked
  const primarySubmitIntent: ElementGenerationSubmitIntent =
    retryStrategy === 'resume_same_attempt' ? 'retry' : 'generate'
  const handleSubmit = () => {
    if (!submitDisabled) onSubmit(primarySubmitIntent)
  }
  const handleRetry = () => {
    if (!submitDisabled) onSubmit('retry')
  }
  const retryLabel = retryStrategy === 'resume_same_attempt'
    ? 'Check generation result'
    : retryStrategy === 'start_fresh_attempt'
      ? 'Try fresh generation'
      : 'Try again'

  // Auto-expand textarea as user types
  useEffect(() => {
    if (stableSubmit) return
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [prompt, stableSubmit])

  // PASS2B J3-02: focus the box for a new activation, after the menu that picked the element has closed (flag off: autoFocusKey is never set).
  useEffect(() => {
    if (autoFocusKey === undefined || !scheduleFocus) return
    return scheduleFocus(() => textareaRef.current)
  }, [autoFocusKey])

  const placeholder = promptDisabledHint !== null ? '' : placeholderOverride
    || mandatoryConfigs.find(config => config.promptPlaceholder)?.promptPlaceholder
    || 'Describe what you want to generate...'

  return (
    <div className="px-3 pt-3 pb-2 space-y-2">
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200"
          role={STUDIO_GENERATION_FEEDBACK ? 'alert' : undefined}
          data-studio-generation-feedback={STUDIO_GENERATION_FEEDBACK ? 'true' : undefined}>
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-600 break-words"
              data-studio-generation-feedback-text={STUDIO_GENERATION_FEEDBACK ? 'true' : undefined}
              role={STUDIO_GENERATION_FEEDBACK ? 'region' : undefined}
              tabIndex={STUDIO_GENERATION_FEEDBACK ? 0 : undefined}
              aria-label={STUDIO_GENERATION_FEEDBACK ? 'Generation error details' : undefined}>{error}</p>
            {retryStrategy !== 'do_not_retry' ? (
              <button
                type="button"
                onClick={handleRetry}
                disabled={submitDisabled}
                data-studio-generation-feedback-guidance={STUDIO_GENERATION_FEEDBACK ? 'true' : undefined}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                {retryLabel}
              </button>
            ) : (
              <p className="mt-1.5 text-[10px] text-red-500" data-studio-generation-feedback-guidance={STUDIO_GENERATION_FEEDBACK ? 'true' : undefined}>
                Update the prompt or settings before generating again.
              </p>
            )}
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
            aria-label={STUDIO_GENERATION_FEEDBACK ? 'Generation prompt' : undefined}
            aria-invalid={promptOverLimit}
            aria-describedby={promptDisabledHint !== null
              ? (promptMaxLength ? `generation-prompt-limit ${PROMPT_DISABLED_HINT_ID}` : PROMPT_DISABLED_HINT_ID)
              : promptMaxLength ? 'generation-prompt-limit' : undefined}
            style={stableSubmit ? STABLE_SUBMIT_TEXTAREA_STYLE : undefined}
            className={`w-full resize-y border-0 bg-transparent focus:ring-0 focus:outline-none px-3 pt-3 pb-12 min-h-[60px] max-h-[160px] text-xs placeholder:text-gray-400 dark:text-slate-500 overflow-y-auto text-gray-900 dark:text-slate-100 disabled:opacity-50${promptDisabledHint !== null ? ' cursor-not-allowed opacity-50' : ''}`}
            rows={2}
            {...(promptDisabledHint !== null ? { readOnly: true, 'aria-disabled': true } : {})}
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
              aria-label={STUDIO_GENERATION_FEEDBACK ? showAdvanced ? 'Hide advanced options' : 'Show advanced options' : undefined}
              aria-expanded={STUDIO_GENERATION_FEEDBACK ? showAdvanced : undefined}
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
              aria-disabled={promptGuardBlocked ? true : undefined}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                submitDisabled
                  ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
              title={
                promptOverLimit
                  ? 'Shorten the prompt before generating'
                  : promptGuardHint !== null
                    ? promptGuardHint
                    : retryStrategy === 'resume_same_attempt'
                      ? 'Check generation result (⌘↵)'
                      : 'Generate (⌘↵)'
              }
              aria-label={STUDIO_GENERATION_FEEDBACK || promptGuardBlocked
                ? promptOverLimit
                  ? 'Shorten the prompt before generating'
                  : retryStrategy === 'resume_same_attempt'
                    ? 'Check generation result (⌘↵)'
                    : 'Generate (⌘↵)'
                : undefined}
              // PASS2B J3-04 (#398 aria follow-up, same flag: promptGuardBlocked is only ever true with it on): a blocked button keeps its name
              // "Generate (⌘↵)" in every shell (the aria-label above; outside the Studio shell the hint title WAS its name) and is described by
              // the hint (the visually hidden span below). Not blocked / flag off: no attribute added.
              aria-describedby={promptGuardBlocked ? EMPTY_PROMPT_HINT_ID : undefined}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
            {promptGuardBlocked && <span id={EMPTY_PROMPT_HINT_ID} className="sr-only">{promptGuardHint}</span>}
          </div>
        </div>
      </div>
      {promptDisabledHint !== null && (
        <p id={PROMPT_DISABLED_HINT_ID} className="px-1 text-[10px] leading-4 text-gray-500 dark:text-slate-400">{promptDisabledHint}</p>
      )}
      {generatingStatus !== undefined && (
        // The line is always in the tree while the flag is on, so the polite live region exists before its text arrives and is announced; idle it
        // is empty and takes no room (the parent's space-y margin is zeroed).
        <p
          role="status"
          aria-live="polite"
          data-studio-generating-status={generatingStatus ? 'true' : undefined}
          style={generatingStatus ? undefined : { marginTop: 0 }}
          className="px-1 text-[10px] leading-4 text-gray-500 dark:text-slate-400"
        >{generatingStatus}</p>
      )}
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
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
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

  if (config.nativeSelect && hasOptions && !hasGroups) {
    return (
      <div className="relative flex-shrink-0">
        <select
          aria-label={config.fieldLabel}
          value={config.selectedValue || config.options![0]?.value || ''}
          onChange={event => config.onChange(event.target.value)}
          className="h-7 max-w-[160px] appearance-none rounded-lg border-0 bg-gray-100 py-1 pl-2 pr-6 text-xs text-gray-700 outline-none transition-colors hover:bg-gray-200 focus:ring-2 focus:ring-primary/30 dark:bg-slate-700 dark:text-slate-200"
        >
          {config.options!.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-slate-500"
        />
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
      <PopoverContent data-studio-generation-options={studio ? 'true' : undefined} aria-label={studio ? `${config.fieldLabel} options` : undefined} align="start" className="w-52 p-1" sideOffset={4}>
        {studio && <p data-studio-generation-options-part="heading">{config.fieldLabel}</p>}
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
                    data-studio-generation-selected={studio ? String(isSelected(option.value, option.label)) : undefined}
                    aria-pressed={studio ? isSelected(option.value, option.label) : undefined}
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
                data-studio-generation-selected={studio ? String(isSelected(option.value, option.label)) : undefined}
                aria-pressed={studio ? isSelected(option.value, option.label) : undefined}
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
