'use client'

import { useState, useCallback, useEffect } from 'react'
import { IconLabelFormData, IconLabelConfig, TextLabsPaddingConfig, TextLabsPositionConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { ElementContext, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'
import { PaddingControl } from '../shared/padding-control'
import { CollapsibleSection } from '../shared/collapsible-section'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.ICON_LABEL
type IconOverrideField = 'size' | 'style' | 'font' | 'color' | 'background' | 'exclusions' | 'position' | 'padding'

// Backend-aligned icon styles
const ICON_STYLES: { value: IconLabelConfig['style']; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'circle-outline', label: 'Circle Outline' },
  { value: 'square-outline', label: 'Square Outline' },
]

const LABEL_FONTS: { value: IconLabelConfig['font']; label: string }[] = [
  { value: 'poppins', label: 'Poppins' },
  { value: 'inter', label: 'Inter' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'roboto_mono', label: 'Roboto Mono' },
]

function getDefaultColor(mode: 'icon' | 'label', style: IconLabelConfig['style']): string {
  if (mode === 'label') return '#1F2937'
  if (style === 'circle' || style === 'square') return '#3B82F6'
  return '#1F2937'
}

interface IconLabelFormProps {
  onSubmit: (formData: IconLabelFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function IconLabelForm({ onSubmit, registerSubmit, isGenerating, presentationId, elementContext, prompt, showAdvanced, registerMandatoryConfig }: IconLabelFormProps) {
  const [count, setCount] = useState(1)
  const [mode, setMode] = useState<'icon' | 'label'>('icon')
  const [size, setSize] = useState<IconLabelConfig['size']>('medium')
  const [style, setStyle] = useState<IconLabelConfig['style']>('circle')
  const [font, setFont] = useState<IconLabelConfig['font']>('poppins')
  const [color, setColor] = useState<string | null>(null)
  const [targetBackground, setTargetBackground] = useState('light')
  const [excludeIconsInput, setExcludeIconsInput] = useState('')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [explicitFields, setExplicitFields] = useState<Set<IconOverrideField>>(() => new Set())
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  useEffect(() => {
    if (!elementContext) return
    setPositionConfig({
      start_col: elementContext.startCol,
      start_row: elementContext.startRow,
      position_width: elementContext.width,
      position_height: elementContext.height,
      auto_position: false,
    })
  }, [elementContext])

  const markExplicit = useCallback((field: IconOverrideField) => {
    setExplicitFields(previous => new Set(previous).add(field))
    setAdvancedModified(true)
  }, [])

  const resetToAuto = useCallback(() => {
    setCount(1)
    setSize('medium')
    setStyle('circle')
    setFont('poppins')
    setColor(null)
    setTargetBackground('light')
    setExcludeIconsInput('')
    setPositionConfig({
      start_col: elementContext?.startCol ?? 2,
      start_row: elementContext?.startRow ?? 4,
      position_width: elementContext?.width ?? DEFAULTS.width,
      position_height: elementContext?.height ?? DEFAULTS.height,
      auto_position: false,
    })
    setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
    setZIndex(DEFAULTS.zIndex)
    updateThemeSource({ mode: presentationId ? 'deck' : 'none', overrides: null })
    setExplicitFields(new Set())
    setAdvancedModified(false)
  }, [elementContext, presentationId, updateThemeSource])

  // Register mandatory config — Mode
  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Mode',
      displayLabel: mode === 'icon' ? 'Icon' : 'Label',
      options: [
        { value: 'icon', label: 'Icon' },
        { value: 'label', label: 'Label' },
      ],
      onChange: (v) => { setMode(v as 'icon' | 'label') },
      promptPlaceholder: mode === 'icon' ? 'e.g., shopping cart icon, checkmark' : "e.g., Label 'IV', 'A+', 'Step 1'",
    })
  }, [mode, registerMandatoryConfig])

  const handleSubmit = useCallback(() => {
    const defaultPrompt = mode === 'icon' ? 'shopping cart icon' : 'Label I'

    const formData: IconLabelFormData = {
      componentType: 'ICON_LABEL',
      prompt: prompt || defaultPrompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      iconLabelConfig: {
        mode,
        ...(explicitFields.has('size') ? { size } : {}),
        ...(explicitFields.has('style') ? { style } : {}),
        ...(explicitFields.has('font') ? { font } : {}),
        ...(explicitFields.has('color') ? { color } : {}),
        ...(explicitFields.has('background') ? { target_background: targetBackground } : {}),
        ...(explicitFields.has('exclusions') ? {
          exclude_icons: excludeIconsInput.split(',').map(item => item.trim()).filter(Boolean),
        } : {}),
      },
      positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, mode, size, style, font, color, targetBackground, excludeIconsInput, explicitFields, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, positionConfig, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Automatic details</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Only changed fields override Illustrator defaults.</div>
        </div>
        <button type="button" onClick={resetToAuto} disabled={explicitFields.size === 0 && !advancedModified}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">
          Reset to Auto
        </button>
      </div>
      <ThemeSourceSelector
        presentationId={presentationId}
        value={themeSource}
        onChange={selection => {
          updateThemeSource(selection)
          setAdvancedModified(true)
        }}
      />

      {/* Count */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Count</label>
        <select
          value={count}
          onChange={(e) => { setCount(Number(e.target.value)); setAdvancedModified(true) }}
          className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Size */}
      <ToggleRow
        label="Size"
        field="size"
        value={size}
        options={[
          { value: 'xs', label: 'XS' },
          { value: 'small', label: 'S' },
          { value: 'medium', label: 'M' },
          { value: 'large', label: 'L' },
        ]}
        onChange={(_, v) => {
          setSize(v as IconLabelConfig['size'])
          markExplicit('size')
        }}
      />

      {/* Style (icon mode only) */}
      {mode === 'icon' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Style</label>
          <select
            value={style}
            onChange={(e) => {
              setStyle(e.target.value as IconLabelConfig['style'])
              markExplicit('style')
            }}
            className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {ICON_STYLES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Font (label mode only) */}
      {mode === 'label' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Font</label>
          <select
            value={font}
            onChange={(e) => {
              setFont(e.target.value as IconLabelConfig['font'])
              markExplicit('font')
            }}
            className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {LABEL_FONTS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={color || getDefaultColor(mode, style)}
            onChange={(e) => {
              setColor(e.target.value)
              markExplicit('color')
            }}
            className="h-6 w-6 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">{color || 'Auto'}</span>
          {color && (
            <button
              onClick={() => {
                setColor(null)
                setExplicitFields(previous => {
                  const next = new Set(previous)
                  next.delete('color')
                  return next
                })
              }}
              className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <ToggleRow
        label="Background"
        field="target_background"
        value={targetBackground}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(_, v) => {
          setTargetBackground(v)
          markExplicit('background')
        }}
      />

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Exclude Icons</label>
        <input
          type="text"
          value={excludeIconsInput}
          onChange={(e) => {
            setExcludeIconsInput(e.target.value)
            markExplicit('exclusions')
          }}
          placeholder="e.g., star, circle-dot"
          className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Z-Index */}
      <ZIndexInput
        value={zIndex}
        onChange={setZIndex}
        onAdvancedModified={() => setAdvancedModified(true)}
      />

      <CollapsibleSection title="Position & Size" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['Col', 'start_col', 1, 32],
            ['Row', 'start_row', 1, 18],
            ['Width', 'position_width', 1, 32],
            ['Height', 'position_height', 1, 18],
          ] as const).map(([label, field, min, max]) => (
            <label key={field} className="space-y-1">
              <span className="text-[10px] text-gray-500 dark:text-slate-400">{label}</span>
              <input type="number" min={min} max={max} value={positionConfig[field]}
                onChange={event => {
                  setPositionConfig(previous => ({ ...previous, [field]: Number(event.target.value) }))
                  markExplicit('position')
                }}
                className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800" />
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
        <PaddingControl
          paddingConfig={paddingConfig}
          onChange={setPaddingConfig}
          onAdvancedModified={() => markExplicit('padding')}
        />
      </CollapsibleSection>
      </>)}
    </div>
  )
}

IconLabelForm.displayName = 'IconLabelForm'
