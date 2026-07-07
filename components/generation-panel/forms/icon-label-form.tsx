'use client'

import { useState, useCallback, useEffect } from 'react'
import { IconLabelFormData, IconLabelConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.ICON_LABEL

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
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function IconLabelForm({ onSubmit, registerSubmit, isGenerating, presentationId, prompt, showAdvanced, registerMandatoryConfig }: IconLabelFormProps) {
  const [count, setCount] = useState(1)
  const [mode, setMode] = useState<'icon' | 'label'>('icon')
  const [size, setSize] = useState<IconLabelConfig['size']>('medium')
  const [style, setStyle] = useState<IconLabelConfig['style']>('circle')
  const [font, setFont] = useState<IconLabelConfig['font']>('poppins')
  const [color, setColor] = useState<string | null>(null)
  const [targetBackground, setTargetBackground] = useState('light')
  const [excludeIconsInput, setExcludeIconsInput] = useState('')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  // Register mandatory config — Mode
  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Mode',
      displayLabel: mode === 'icon' ? 'Icon' : 'Label',
      options: [
        { value: 'icon', label: 'Icon' },
        { value: 'label', label: 'Label' },
      ],
      onChange: (v) => { setMode(v as 'icon' | 'label'); setAdvancedModified(true) },
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
        size,
        style,
        font,
        color,
        target_background: targetBackground,
        exclude_icons: excludeIconsInput.split(',').map(item => item.trim()).filter(Boolean),
      },
    }
    onSubmit(formData)
  }, [prompt, count, mode, size, style, font, color, targetBackground, excludeIconsInput, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      <ThemeSourceSelector
        presentationId={presentationId}
        value={themeSource}
        onChange={updateThemeSource}
      />

      {/* Count */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Count</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
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
          setAdvancedModified(true)
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
              setAdvancedModified(true)
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
              setAdvancedModified(true)
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
              setAdvancedModified(true)
            }}
            className="h-6 w-6 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">{color || 'Auto'}</span>
          {color && (
            <button
              onClick={() => { setColor(null); setAdvancedModified(true) }}
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
          setAdvancedModified(true)
        }}
      />

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Exclude Icons</label>
        <input
          type="text"
          value={excludeIconsInput}
          onChange={(e) => {
            setExcludeIconsInput(e.target.value)
            setAdvancedModified(true)
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
      </>)}
    </div>
  )
}

IconLabelForm.displayName = 'IconLabelForm'
