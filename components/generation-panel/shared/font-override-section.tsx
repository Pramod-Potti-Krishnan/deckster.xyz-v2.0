'use client'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px']
const FONT_FAMILIES = ['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro']

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
}

export function FontOverrideSection({
  label,
  prefix,
  config,
  onChange,
  thirdToggle = 'allcaps',
}: FontOverrideSectionProps) {
  const sizeField = `${prefix}_font_size`
  const familyField = `${prefix}_font_family`
  const colorField = `${prefix}_font_color`
  const boldField = `${prefix}_bold`
  const italicField = `${prefix}_italic`
  const thirdField = `${prefix}_${thirdToggle}`

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">Size</label>
          <select
            value={(config[sizeField] as string) || ''}
            onChange={(e) => onChange(sizeField, e.target.value || null)}
            className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
          >
            <option value="">Auto</option>
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">Family</label>
          <select
            value={(config[familyField] as string) || ''}
            onChange={(e) => onChange(familyField, e.target.value || null)}
            className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
          >
            <option value="">Auto</option>
            {FONT_FAMILIES.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500">Color</label>
        <input
          type="color"
          value={(config[colorField] as string) || '#333333'}
          onChange={(e) => onChange(colorField, e.target.value)}
          className="h-6 w-6 rounded border border-gray-600 cursor-pointer"
        />
        {!!config[colorField] && (
          <button
            onClick={() => onChange(colorField, null)}
            className="text-[10px] text-gray-500 hover:text-gray-300"
          >
            Reset
          </button>
        )}
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
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            {btnLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
