'use client'

import { TextLabsPositionConfig, POSITION_PRESETS, TEXT_LABS_ELEMENT_DEFAULTS, TextLabsComponentType, GRID_CELL_SIZE } from '@/types/textlabs'
import './studio-generation-geometry.css'

const STUDIO_GEOMETRY = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface PositionPresetsProps {
  positionConfig: TextLabsPositionConfig
  onChange: (config: TextLabsPositionConfig) => void
  elementType: TextLabsComponentType
  onAdvancedModified: () => void
}

export function PositionPresets({
  positionConfig,
  onChange,
  elementType,
  onAdvancedModified,
}: PositionPresetsProps) {
  const defaults = TEXT_LABS_ELEMENT_DEFAULTS[elementType]

  const applyPreset = (presetKey: string) => {
    const preset = POSITION_PRESETS[presetKey]
    if (!preset) return
    onChange({
      start_col: preset.start_col,
      start_row: preset.start_row,
      position_width: preset.width,
      position_height: preset.height,
      auto_position: false,
    })
    onAdvancedModified()
  }

  // Calculated pixel size
  const pixelW = positionConfig.position_width * GRID_CELL_SIZE
  const pixelH = positionConfig.position_height * GRID_CELL_SIZE

  return (
    <div data-studio-v4-shell={STUDIO_GEOMETRY ? 'true' : undefined} data-studio-generation-geometry={STUDIO_GEOMETRY ? 'position' : undefined} className="space-y-2">
      {/* Auto/Manual Toggle — inline layout */}
      <div data-studio-geometry-heading={STUDIO_GEOMETRY ? 'true' : undefined} className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">Positioning</label>
        <div data-studio-geometry-group={STUDIO_GEOMETRY ? 'position-mode' : undefined} role={STUDIO_GEOMETRY ? 'group' : undefined} aria-label={STUDIO_GEOMETRY ? 'Positioning' : undefined} className="flex gap-1">
          {[
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manual' },
          ].map(option => (
            <button
              key={option.value}
              aria-pressed={STUDIO_GEOMETRY ? (positionConfig.auto_position ? 'auto' : 'manual') === option.value : undefined}
              onClick={() => {
                const isAuto = option.value === 'auto'
                onChange({
                  ...positionConfig,
                  auto_position: isAuto,
                  ...(isAuto ? {
                    start_col: 2,
                    start_row: 4,
                    position_width: defaults.width,
                    position_height: defaults.height,
                  } : {}),
                })
                onAdvancedModified()
              }}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                (positionConfig.auto_position ? 'auto' : 'manual') === option.value
                  ? 'bg-primary text-white border border-primary'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calculated Size Display */}
      <div data-studio-geometry-summary={STUDIO_GEOMETRY ? 'true' : undefined} className="text-[10px] text-gray-400 dark:text-slate-500">
        Size: {positionConfig.position_width} x {positionConfig.position_height} grid ({pixelW} x {pixelH} px)
      </div>

      {!positionConfig.auto_position && (
        <>
          {/* Position Presets Grid */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 dark:text-slate-500">Presets</label>
            <div data-studio-geometry-group={STUDIO_GEOMETRY ? 'presets' : undefined} role={STUDIO_GEOMETRY ? 'group' : undefined} aria-label={STUDIO_GEOMETRY ? 'Position presets' : undefined} className="grid grid-cols-3 gap-1">
              {Object.entries(POSITION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  aria-pressed={STUDIO_GEOMETRY ? positionConfig.start_col === preset.start_col && positionConfig.start_row === preset.start_row && positionConfig.position_width === preset.width && positionConfig.position_height === preset.height : undefined}
                  onClick={() => applyPreset(key)}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    positionConfig.start_col === preset.start_col &&
                    positionConfig.start_row === preset.start_row &&
                    positionConfig.position_width === preset.width &&
                    positionConfig.position_height === preset.height
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Col/Row Inputs (hidden when auto) */}
          <div data-studio-geometry-pair={STUDIO_GEOMETRY ? 'true' : undefined} className="grid grid-cols-2 gap-2">
            {[
              { label: 'Col', field: 'start_col' as const, min: 1, max: 32 },
              { label: 'Row', field: 'start_row' as const, min: 1, max: 18 },
            ].map(({ label, field, min, max }) => (
              <div key={field} className="space-y-1">
                <label className="text-[10px] text-gray-400 dark:text-slate-500">{label}</label>
                <input
                  aria-label={STUDIO_GEOMETRY ? `${label} (grid)` : undefined}
                  type="number"
                  value={positionConfig[field]}
                  min={min}
                  max={max}
                  step={0.2}
                  onChange={(e) => {
                    onChange({ ...positionConfig, [field]: Number(e.target.value) })
                    onAdvancedModified()
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Width/Height Inputs (always visible) */}
      <div data-studio-geometry-pair={STUDIO_GEOMETRY ? 'true' : undefined} className="grid grid-cols-2 gap-2">
        {[
          { label: 'Width', field: 'position_width' as const, min: 0.2, max: 32 },
          { label: 'Height', field: 'position_height' as const, min: 0.2, max: 18 },
        ].map(({ label, field, min, max }) => (
          <div key={field} className="space-y-1">
            <label className="text-[10px] text-gray-400 dark:text-slate-500">{label}</label>
            <input
              aria-label={STUDIO_GEOMETRY ? `${label} (grid)` : undefined}
              type="number"
              value={positionConfig[field]}
              min={min}
              max={max}
              step={0.2}
              onChange={(e) => {
                onChange({ ...positionConfig, [field]: Number(e.target.value) })
                onAdvancedModified()
              }}
              className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
