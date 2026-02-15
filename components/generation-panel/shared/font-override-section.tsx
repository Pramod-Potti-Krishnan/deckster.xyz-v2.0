'use client'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px']
const FONT_FAMILIES = ['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro']

const FONT_COLOR_PRESETS = [
  { value: null, label: 'Auto', hex: null },
  { value: '#805AA0', label: 'Purple', hex: '#805AA0' },
  { value: '#2980B9', label: 'Blue', hex: '#2980B9' },
  { value: '#C0392B', label: 'Red', hex: '#C0392B' },
  { value: '#27AE60', label: 'Green', hex: '#27AE60' },
  { value: '#D39E1E', label: 'Yellow', hex: '#D39E1E' },
  { value: '#0097A7', label: 'Cyan', hex: '#0097A7' },
  { value: '#E65100', label: 'Orange', hex: '#E65100' },
  { value: '#00796B', label: 'Teal', hex: '#00796B' },
  { value: '#C2185B', label: 'Pink', hex: '#C2185B' },
  { value: '#3949AB', label: 'Indigo', hex: '#3949AB' },
  { value: '#374151', label: 'Dark', hex: '#374151' },
] as const

interface FontOverrideSectionProps {
  /** Display label, e.g. "Value Font", "Header Font" */
  label: string
  /** Field name prefix, e.g. "value", "label", "desc", "header", "cell" */
  prefix: string
  /** Current config state object */
  config: Record<string, unknown>
  /** Callback when a field changes */
  onChange: (field: string, value: unknown) => void
  /** Whether to show allcaps toggle (METRICS/TABLE) or underline toggle (TEXT_BOX) */
  thirdToggle?: 'allcaps' | 'underline'
  /** Optional color presets to override the default palette */
  colorPresets?: typeof FONT_COLOR_PRESETS
}

export function FontOverrideSection({
  label,
  prefix,
  config,
  onChange,
  thirdToggle = 'allcaps',
  colorPresets,
}: FontOverrideSectionProps) {
  const sizeField = `${prefix}_font_size`
  const familyField = `${prefix}_font_family`
  const colorField = `${prefix}_font_color`
  const boldField = `${prefix}_bold`
  const italicField = `${prefix}_italic`
  const thirdField = `${prefix}_${thirdToggle}`

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400">Size</label>
          <select
            value={(config[sizeField] as string) || ''}
            onChange={(e) => onChange(sizeField, e.target.value || null)}
            className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
          >
            <option value="">Auto</option>
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400">Family</label>
          <select
            value={(config[familyField] as string) || ''}
            onChange={(e) => onChange(familyField, e.target.value || null)}
            className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
          >
            <option value="">Auto</option>
            {FONT_FAMILIES.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-gray-400">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {(colorPresets ?? FONT_COLOR_PRESETS).map(preset => (
            <button
              key={preset.label}
              onClick={() => onChange(colorField, preset.value)}
              style={preset.hex ? { backgroundColor: preset.hex } : undefined}
              className={`h-6 w-6 rounded-full border transition-all ${
                (config[colorField] || null) === preset.value
                  ? 'ring-2 ring-purple-500 ring-offset-1'
                  : 'hover:scale-110'
              } ${!preset.hex ? 'bg-gradient-to-br from-purple-400 via-blue-400 to-green-400 border-gray-300' : 'border-gray-200'}`}
              title={preset.label}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        {[
          { field: boldField, label: 'B', style: 'font-bold' },
          { field: italicField, label: 'I', style: 'italic' },
          {
            field: thirdField,
            label: thirdToggle === 'allcaps' ? 'AA' : 'U',
            style: thirdToggle === 'allcaps' ? 'text-[10px] tracking-wider' : 'underline',
          },
        ].map(({ field, label: btnLabel, style }) => (
          <button
            key={field}
            onClick={() => onChange(field, config[field] ? null : true)}
            className={`w-7 h-7 rounded text-xs ${style} transition-colors ${
              config[field]
                ? 'bg-purple-600 text-white border border-purple-600'
                : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {btnLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
