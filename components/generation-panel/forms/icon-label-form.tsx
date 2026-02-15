'use client'

import { useState, useCallback, useEffect } from 'react'
import { IconLabelFormData, IconLabelConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.ICON_LABEL

// Backend-aligned icon styles
const ICON_STYLES: { value: IconLabelConfig['style']; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'minimal', label: 'Minimal' },
]

const LABEL_FONTS: { value: IconLabelConfig['font']; label: string }[] = [
  { value: 'poppins', label: 'Poppins' },
  { value: 'inter', label: 'Inter' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'roboto_mono', label: 'Roboto Mono' },
]

function getDefaultColor(mode: 'icon' | 'label', style: IconLabelConfig['style']): string {
  if (mode === 'label') return '#1F2937'
  if (style === 'circle' || style === 'square' || style === 'rounded') return '#3B82F6'
  return '#1F2937'
}

interface IconLabelFormProps {
  onSubmit: (formData: IconLabelFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function IconLabelForm({ onSubmit, registerSubmit, isGenerating }: IconLabelFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [mode, setMode] = useState<'icon' | 'label'>('icon')
  const [size, setSize] = useState<IconLabelConfig['size']>('medium')
  const [style, setStyle] = useState<IconLabelConfig['style']>('circle')
  const [font, setFont] = useState<IconLabelConfig['font']>('poppins')
  const [color, setColor] = useState<string | null>(null)
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  const handleSubmit = useCallback(() => {
    const defaultPrompt = mode === 'icon' ? 'shopping cart icon' : 'Label I'

    const formData: IconLabelFormData = {
      componentType: 'ICON_LABEL',
      prompt: prompt || defaultPrompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      iconLabelConfig: {
        mode,
        size,
        style,
        font,
        color,
      },
    }
    onSubmit(formData)
  }, [prompt, count, mode, size, style, font, color, advancedModified, zIndex, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder={mode === 'icon'
          ? 'e.g., shopping cart icon, checkmark, lightning bolt'
          : "e.g., Label 'IV', 'A+', 'Step 1'"
        }
        disabled={isGenerating}
      />

      {/* Mode */}
      <ToggleRow
        label="Mode"
        field="mode"
        value={mode}
        options={[
          { value: 'icon', label: 'Icon' },
          { value: 'label', label: 'Label' },
        ]}
        onChange={(_, v) => {
          setMode(v as 'icon' | 'label')
          setAdvancedModified(true)
        }}
      />

      {/* Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Count</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Style</label>
          <select
            value={style}
            onChange={(e) => {
              setStyle(e.target.value as IconLabelConfig['style'])
              setAdvancedModified(true)
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {ICON_STYLES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Font (label mode only) */}
      {mode === 'label' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Font</label>
          <select
            value={font}
            onChange={(e) => {
              setFont(e.target.value as IconLabelConfig['font'])
              setAdvancedModified(true)
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {LABEL_FONTS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={color || getDefaultColor(mode, style)}
            onChange={(e) => {
              setColor(e.target.value)
              setAdvancedModified(true)
            }}
            className="h-7 w-7 rounded border border-gray-300 cursor-pointer"
          />
          <span className="text-[10px] text-gray-400">{color || 'Auto'}</span>
          {color && (
            <button
              onClick={() => { setColor(null); setAdvancedModified(true) }}
              className="text-[10px] text-gray-400 hover:text-gray-700"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Z-Index */}
      <ZIndexInput
        value={zIndex}
        onChange={setZIndex}
        onAdvancedModified={() => setAdvancedModified(true)}
      />
    </div>
  )
}

IconLabelForm.displayName = 'IconLabelForm'
