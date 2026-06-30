"use client"

import { Image as ImageIcon, Palette, Save, TextCursorInput, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  TemplateAtomContract,
  TemplateBlueprint,
  TemplateBlueprintElement,
  TemplateBlueprintFixedness,
  TemplateBlueprintScope,
  TemplateBlueprintScopeLevel,
  TemplateBlueprintSlide,
  TemplateSnapshot,
} from '@/hooks/use-templates'
import {
  asRecord,
  getBlueprintSlide,
  getTemplateBlueprint,
  getTemplateModeElements,
  type TemplateModeElement,
  type TemplateModeOverride,
  type TemplateOverrides,
} from '@/lib/template-mode'

interface TemplateParamsPanelProps {
  isOpen: boolean
  width: number
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  overrides: TemplateOverrides
  selectedElementId?: string | null
  loading?: boolean
  blueprintEditorV2Enabled?: boolean
  blueprintDirty?: boolean
  blueprintSaving?: boolean
  onClose: () => void
  onOverrideChange: (slideIndex: number, overrideKey: string, patch: TemplateModeOverride) => void
  onBlueprintChange?: (blueprint: TemplateBlueprint) => void
  onSaveBlueprint?: () => void | Promise<void>
}

const SCOPE_OPTIONS: Array<{ value: TemplateBlueprintScopeLevel; label: string }> = [
  { value: 'period', label: 'Same subject, new period' },
  { value: 'sibling', label: 'Related subject' },
  { value: 'category', label: 'Category level' },
  { value: 'structure', label: 'Pure structure' },
]

const OPTIONAL_SCOPE_OPTIONS = [
  { value: 'inherit', label: 'Inherit' },
  ...SCOPE_OPTIONS,
]

const FIXEDNESS_OPTIONS: Array<{ value: TemplateBlueprintFixedness; label: string }> = [
  { value: 'variable', label: 'Variable' },
  { value: 'constant', label: 'Constant' },
  { value: 'locked_media', label: 'Locked media' },
]

const ATOM_KIND_OPTIONS: Array<{ value: TemplateAtomContract['kind']; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'metric', label: 'Metric' },
  { value: 'chart', label: 'Chart' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'infographic', label: 'Infographic' },
  { value: 'image', label: 'Image' },
  { value: 'table', label: 'Table' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'unknown', label: 'Unknown' },
]

const VISUAL_STRATEGY_OPTIONS = [
  { value: 'hero_priority', label: 'Hero priority' },
  { value: 'recede', label: 'Recede' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'soft_support', label: 'Soft support' },
  { value: 'quiet_support', label: 'Quiet support' },
  { value: 'emphasis', label: 'Emphasis' },
  { value: 'decision_emphasis', label: 'Decision emphasis' },
]

const COLOR_SLOT_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'accent-1', label: 'Accent 1' },
  { value: 'accent-2', label: 'Accent 2' },
  { value: 'neutral', label: 'Neutral' },
]

function nestedValue(record: Record<string, unknown> | null, key: string): unknown {
  return record?.[key]
}

function textOrEmpty(value: string | null | undefined): string {
  return value ?? ''
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function listToLines(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join('\n') : ''
}

function getOverride(overrides: TemplateOverrides, slideIndex: number, overrideKey: string): TemplateModeOverride {
  return asRecord(overrides[String(slideIndex)]?.[overrideKey]) ?? {}
}

function elementIcon(element: TemplateModeElement | null) {
  const atomType = element?.atomType.toUpperCase() ?? ''
  if (atomType.includes('IMAGE')) return <ImageIcon className="h-4 w-4 text-slate-500" />
  return <TextCursorInput className="h-4 w-4 text-slate-500" />
}

function TextField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-slate-800 shadow-sm",
          "focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950"
        )}
      />
    </label>
  )
}

function TextInputField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm",
          "focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950"
        )}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
}: {
  label: string
  value?: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function updateBlueprint(
  blueprint: TemplateBlueprint,
  patch: Partial<TemplateBlueprint>,
): TemplateBlueprint {
  return { ...blueprint, ...patch }
}

function updateSlide(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  patch: Partial<TemplateBlueprintSlide>,
): TemplateBlueprint {
  return {
    ...blueprint,
    slides: blueprint.slides.map((slide) => (
      Number(slide.slide_index) === slideIndex ? { ...slide, ...patch } : slide
    )),
  }
}

function updateElement(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  elementKey: string,
  patch: Partial<TemplateBlueprintElement>,
): TemplateBlueprint {
  return {
    ...blueprint,
    slides: blueprint.slides.map((slide) => {
      if (Number(slide.slide_index) !== slideIndex) return slide
      return {
        ...slide,
        elements: slide.elements.map((element) => (
          element.element_key === elementKey ? { ...element, ...patch } : element
        )),
      }
    }),
  }
}

function patchElementContract(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  element: TemplateBlueprintElement,
  patch: Partial<TemplateAtomContract>,
): TemplateBlueprint {
  const current = element.atom_contract ?? { kind: 'unknown' as const }
  return updateElement(blueprint, slideIndex, element.element_key, {
    atom_contract: {
      ...current,
      ...patch,
    },
  })
}

function patchElementVisualConstants(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  element: TemplateBlueprintElement,
  patch: Record<string, unknown>,
): TemplateBlueprint {
  const constants = asRecord(element.visual_constants) ?? {}
  return updateElement(blueprint, slideIndex, element.element_key, {
    visual_constants: {
      ...constants,
      ...patch,
    },
  })
}

function scopeValue(scope: TemplateBlueprintScope | null | undefined, inherited = 'inherit'): string {
  return scope?.level ?? inherited
}

function optionalScopeFromValue(value: string): TemplateBlueprintScope | null {
  return value === 'inherit' ? null : { level: value as TemplateBlueprintScopeLevel }
}

function ElementControls({
  blueprint,
  slideIndex,
  element,
  blueprintElement,
  override,
  onPatch,
  onBlueprintChange,
}: {
  blueprint: TemplateBlueprint
  slideIndex: number
  element: TemplateModeElement
  blueprintElement: TemplateBlueprintElement
  override: TemplateModeOverride
  onPatch: (patch: TemplateModeOverride) => void
  onBlueprintChange: (blueprint: TemplateBlueprint) => void
}) {
  const atomType = element.atomType.toUpperCase()
  const constants = asRecord(blueprintElement.visual_constants) ?? {}
  const styleHints = asRecord(override.style_hints)
    ?? asRecord(constants.style_hints)
    ?? element.styleHints
  const imageHints = asRecord(element.renderSpec.image_hints)
  const imageMode = String(override.image_mode ?? imageHints?.image_mode ?? (
    blueprintElement.fixedness === 'locked_media' ? 'locked' : 'regenerate'
  ))
  const contract = blueprintElement.atom_contract ?? { kind: 'unknown' as const }

  const patchBlueprintElement = (patch: Partial<TemplateBlueprintElement>) => {
    onBlueprintChange(updateElement(blueprint, slideIndex, blueprintElement.element_key, patch))
  }

  const patchStyle = (patch: Record<string, unknown>) => {
    const nextStyleHints = { ...(styleHints ?? {}), ...patch }
    onBlueprintChange(patchElementVisualConstants(blueprint, slideIndex, blueprintElement, {
      style_hints: nextStyleHints,
      ...(patch.color_slot ? { color_slot: patch.color_slot } : {}),
    }))
    onPatch({ style_hints: patch })
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start gap-2">
        {elementIcon(element)}
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            Element details
          </h4>
          <p className="truncate text-xs text-slate-500">
            {element.role} - {element.atomType}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SelectField
          label="Element scope"
          value={scopeValue(blueprintElement.abstraction_scope)}
          placeholder="Element scope"
          options={OPTIONAL_SCOPE_OPTIONS}
          onValueChange={(value) => patchBlueprintElement({ abstraction_scope: optionalScopeFromValue(value) })}
        />
        <TextField
          label="Purpose"
          value={textOrEmpty(blueprintElement.purpose)}
          rows={3}
          onChange={(value) => patchBlueprintElement({ purpose: value })}
        />
        <SelectField
          label="Atom kind"
          value={contract.kind}
          placeholder="Atom kind"
          options={ATOM_KIND_OPTIONS}
          onValueChange={(value) => onBlueprintChange(patchElementContract(
            blueprint,
            slideIndex,
            blueprintElement,
            { kind: value as TemplateAtomContract['kind'] },
          ))}
        />
        <TextField
          label="Abstraction instruction"
          value={textOrEmpty(contract.abstraction_instruction)}
          rows={3}
          onChange={(value) => onBlueprintChange(patchElementContract(
            blueprint,
            slideIndex,
            blueprintElement,
            { abstraction_instruction: value },
          ))}
        />
        <TextField
          label="Required data"
          value={listToLines(contract.required_data)}
          rows={3}
          onChange={(value) => onBlueprintChange(patchElementContract(
            blueprint,
            slideIndex,
            blueprintElement,
            { required_data: linesToList(value) },
          ))}
        />
        <TextField
          label="Required input"
          value={textOrEmpty(blueprintElement.required_input)}
          rows={2}
          onChange={(value) => patchBlueprintElement({ required_input: value })}
        />
        <TextField
          label="Population rule"
          value={textOrEmpty(blueprintElement.population_rule)}
          rows={2}
          onChange={(value) => patchBlueprintElement({ population_rule: value })}
        />
        <SelectField
          label="Fixedness"
          value={blueprintElement.fixedness}
          placeholder="Fixedness"
          options={FIXEDNESS_OPTIONS}
          onValueChange={(value) => {
            const fixedness = value as TemplateBlueprintFixedness
            patchBlueprintElement({ fixedness })
            if (atomType.includes('IMAGE')) {
              onPatch({ image_mode: fixedness === 'locked_media' ? 'locked' : 'regenerate' })
            }
          }}
        />

        {atomType.includes('IMAGE') && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Image
            </span>
            <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-800">
              {(['locked', 'regenerate'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    patchBlueprintElement({ fixedness: mode === 'locked' ? 'locked_media' : 'variable' })
                    onPatch({ image_mode: mode })
                  }}
                  className={cn(
                    "px-2 py-2 font-medium transition",
                    imageMode === mode
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  )}
                >
                  {mode === 'locked' ? 'Keep locked' : 'Regenerate'}
                </button>
              ))}
            </div>
          </div>
        )}

        <SelectField
          label="Role treatment"
          value={String(nestedValue(styleHints, 'visual_strategy') ?? 'quiet_support')}
          placeholder="Role treatment"
          options={VISUAL_STRATEGY_OPTIONS}
          onValueChange={(value) => patchStyle({ visual_strategy: value })}
        />
        <SelectField
          label="Color slot"
          value={String(nestedValue(styleHints, 'color_slot') ?? constants.color_slot ?? 'neutral')}
          placeholder="Color slot"
          options={COLOR_SLOT_OPTIONS}
          onValueChange={(value) => patchStyle({ color_slot: value })}
        />
      </div>
    </section>
  )
}

export function TemplateParamsPanel({
  isOpen,
  width,
  snapshot,
  currentSlideIndex,
  overrides,
  selectedElementId,
  loading,
  blueprintEditorV2Enabled = false,
  blueprintDirty,
  blueprintSaving,
  onClose,
  onOverrideChange,
  onBlueprintChange,
  onSaveBlueprint,
}: TemplateParamsPanelProps) {
  const blueprint = getTemplateBlueprint(snapshot)
  const slide = getBlueprintSlide(snapshot, currentSlideIndex)
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)
  const selectedElement = selectedElementId
    ? elements.find((element) => element.overrideKey === selectedElementId) ?? null
    : null
  const selectedBlueprintElement = selectedElement?.blueprintElement ?? null

  const patchBlueprint = (patch: Partial<TemplateBlueprint>) => {
    if (!blueprint || !onBlueprintChange) return
    onBlueprintChange(updateBlueprint(blueprint, patch))
  }

  const patchSlide = (patch: Partial<TemplateBlueprintSlide>) => {
    if (!blueprint || !onBlueprintChange) return
    onBlueprintChange(updateSlide(blueprint, currentSlideIndex, patch))
  }

  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-[70] ease-out",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      style={{ width, pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      <div className="absolute inset-y-0 left-0 flex max-h-screen flex-col overflow-hidden border-r border-violet-200 bg-white text-slate-900 shadow-xl dark:border-violet-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-violet-50 px-4 py-3 dark:border-slate-800 dark:bg-violet-950/40">
          <div className="flex min-w-0 items-center gap-2">
            <Palette className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">Template details</h3>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Slide {currentSlideIndex + 1}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {blueprintEditorV2Enabled && (
              <Button
                variant={blueprintDirty ? 'default' : 'outline'}
                size="sm"
                onClick={() => void onSaveBlueprint?.()}
                disabled={!blueprint || !blueprintDirty || blueprintSaving}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {blueprintSaving ? 'Saving' : 'Save template changes'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 max-h-[calc(100vh-5rem)] space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Loading template snapshot...
            </div>
          ) : !snapshot ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Select an available template to edit its reusable parameters.
            </div>
          ) : blueprintEditorV2Enabled && (!blueprint || !slide) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              This template is loading its semantic blueprint.
            </div>
          ) : blueprintEditorV2Enabled && blueprint && slide ? (
            <>
              <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deck details</h4>
                  <p className="text-xs text-slate-500">{blueprint.generation_method}</p>
                </div>
                <div className="space-y-3">
                  <SelectField
                    label="Deck scope"
                    value={scopeValue(blueprint.abstraction_scope, 'period')}
                    placeholder="Deck scope"
                    options={SCOPE_OPTIONS}
                    onValueChange={(value) => patchBlueprint({ abstraction_scope: { level: value as TemplateBlueprintScopeLevel } })}
                  />
                  <TextInputField
                    label="Scope label"
                    value={textOrEmpty(blueprint.abstraction_scope?.label)}
                    onChange={(value) => patchBlueprint({
                      abstraction_scope: {
                        level: blueprint.abstraction_scope?.level ?? 'period',
                        label: value || null,
                      },
                    })}
                  />
                  <TextField
                    label="Deck purpose"
                    value={textOrEmpty(blueprint.deck_purpose)}
                    rows={2}
                    onChange={(value) => patchBlueprint({ deck_purpose: value })}
                  />
                  <TextField
                    label="Deck reuse instruction"
                    value={textOrEmpty(blueprint.deck_reuse_instruction)}
                    rows={3}
                    onChange={(value) => patchBlueprint({ deck_reuse_instruction: value })}
                  />
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Slide details</h4>
                  <p className="text-xs text-slate-500">{slide.narrative_role ?? slide.slide_title ?? 'Reusable slide role'}</p>
                </div>
                <div className="space-y-3">
                  <SelectField
                    label="Slide scope"
                    value={scopeValue(slide.abstraction_scope)}
                    placeholder="Slide scope"
                    options={OPTIONAL_SCOPE_OPTIONS}
                    onValueChange={(value) => patchSlide({ abstraction_scope: optionalScopeFromValue(value) })}
                  />
                  <TextField
                    label="Purpose"
                    value={textOrEmpty(slide.purpose)}
                    rows={3}
                    onChange={(value) => patchSlide({ purpose: value })}
                  />
                  <TextField
                    label="Title intent"
                    value={textOrEmpty(slide.title_intent)}
                    rows={2}
                    onChange={(value) => patchSlide({ title_intent: value })}
                  />
                  <TextField
                    label="Subtitle intent"
                    value={textOrEmpty(slide.subtitle_intent)}
                    rows={2}
                    onChange={(value) => patchSlide({ subtitle_intent: value })}
                  />
                  <TextField
                    label="Reuse instruction"
                    value={textOrEmpty(slide.reuse_instruction)}
                    rows={3}
                    onChange={(value) => patchSlide({ reuse_instruction: value })}
                  />
                  <TextField
                    label="Required inputs"
                    value={listToLines(slide.required_inputs)}
                    rows={3}
                    onChange={(value) => patchSlide({ required_inputs: linesToList(value) })}
                  />
                  <SelectField
                    label="Population policy"
                    value={slide.population_policy}
                    placeholder="Population policy"
                    options={[
                      { value: 'flexible', label: 'Flexible' },
                      { value: 'strict', label: 'Strict' },
                    ]}
                    onValueChange={(value) => patchSlide({ population_policy: value as TemplateBlueprintSlide['population_policy'] })}
                  />
                </div>
              </section>

              {selectedElement && selectedBlueprintElement ? (
                <ElementControls
                  blueprint={blueprint}
                  slideIndex={currentSlideIndex}
                  element={selectedElement}
                  blueprintElement={selectedBlueprintElement}
                  override={getOverride(overrides, currentSlideIndex, selectedElement.overrideKey)}
                  onPatch={(patch) => onOverrideChange(currentSlideIndex, selectedElement.overrideKey, patch)}
                  onBlueprintChange={(next) => onBlueprintChange?.(next)}
                />
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  Select a hotspot on the slide to edit element details.
                </div>
              )}
            </>
          ) : selectedElement ? (
            <ElementControls
              blueprint={{
                version: 1,
                generation_method: 'deterministic_fallback',
                slides: [{
                  slide_index: currentSlideIndex,
                  purpose: '',
                  population_policy: 'flexible',
                  elements: [selectedElement.blueprintElement ?? {
                    element_key: selectedElement.overrideKey,
                    purpose: selectedElement.contentIntent ?? selectedElement.role,
                    fixedness: (selectedElement.fixedness as TemplateBlueprintFixedness | null) ?? 'variable',
                  }],
                }],
              }}
              slideIndex={currentSlideIndex}
              element={selectedElement}
              blueprintElement={selectedElement.blueprintElement ?? {
                element_key: selectedElement.overrideKey,
                purpose: selectedElement.contentIntent ?? selectedElement.role,
                fixedness: (selectedElement.fixedness as TemplateBlueprintFixedness | null) ?? 'variable',
              }}
              override={getOverride(overrides, currentSlideIndex, selectedElement.overrideKey)}
              onPatch={(patch) => onOverrideChange(currentSlideIndex, selectedElement.overrideKey, patch)}
              onBlueprintChange={() => undefined}
            />
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Select an element box on the deck to edit image and style parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
