'use client'

import { TextLabsPositionConfig, POSITION_PRESETS, TEXT_LABS_ELEMENT_DEFAULTS, TextLabsComponentType, GRID_CELL_SIZE } from '@/types/textlabs'

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
    <div className="space-y-3">
      {/* Auto/Manual Toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-300">Positioning</label>
        <div className="flex gap-1">
          {[
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manual' },
          ].map(option => (
            <button
              key={option.value}
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
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                (positionConfig.auto_position ? 'auto' : 'manual') === option.value
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calculated Size Display */}
      <div className="text-[10px] text-gray-500">
        Size: {positionConfig.position_width} x {positionConfig.position_height} grid ({pixelW} x {pixelH} px)
      </div>

      {!positionConfig.auto_position && (
        <>
          {/* Position Presets Grid */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500">Presets</label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(POSITION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    positionConfig.start_col === preset.start_col &&
                    positionConfig.start_row === preset.start_row &&
                    positionConfig.position_width === preset.width &&
                    positionConfig.position_height === preset.height
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Grid Inputs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Col', field: 'start_col' as const, min: 1, max: 32 },
              { label: 'Row', field: 'start_row' as const, min: 1, max: 18 },
              { label: 'Width', field: 'position_width' as const, min: 1, max: 32 },
              { label: 'Height', field: 'position_height' as const, min: 1, max: 18 },
            ].map(({ label, field, min, max }) => (
              <div key={field} className="space-y-1">
                <label className="text-[10px] text-gray-500">{label}</label>
                <input
                  type="number"
                  value={positionConfig[field]}
                  min={min}
                  max={max}
                  onChange={(e) => {
                    onChange({ ...positionConfig, [field]: Number(e.target.value) })
                    onAdvancedModified()
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
