'use client'

import { useState } from 'react'
import { TextLabsPaddingConfig } from '@/types/textlabs'

type PaddingMode = 'uniform' | 'axis' | 'individual'

interface PaddingControlProps {
  paddingConfig: TextLabsPaddingConfig
  onChange: (config: TextLabsPaddingConfig) => void
  onAdvancedModified: () => void
}

export function PaddingControl({ paddingConfig, onChange, onAdvancedModified }: PaddingControlProps) {
  const [mode, setMode] = useState<PaddingMode>('uniform')

  const handleUniformChange = (value: number) => {
    onChange({ top: value, right: value, bottom: value, left: value })
    onAdvancedModified()
  }

  const handleAxisChange = (axis: 'horizontal' | 'vertical', value: number) => {
    if (axis === 'horizontal') {
      onChange({ ...paddingConfig, left: value, right: value })
    } else {
      onChange({ ...paddingConfig, top: value, bottom: value })
    }
    onAdvancedModified()
  }

  const handleIndividualChange = (side: keyof TextLabsPaddingConfig, value: number) => {
    onChange({ ...paddingConfig, [side]: value })
    onAdvancedModified()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">Padding</label>
        <div className="flex gap-1">
          {[
            { value: 'uniform' as const, label: 'Uniform' },
            { value: 'axis' as const, label: 'H / V' },
            { value: 'individual' as const, label: 'Individual' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === opt.value
                  ? 'bg-purple-600 text-white border border-purple-600'
                  : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'uniform' && (
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400">All Sides</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={60}
              value={paddingConfig.top}
              onChange={(e) => handleUniformChange(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </div>
      )}

      {mode === 'axis' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400">Horizontal (L+R)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={60}
                value={paddingConfig.left}
                onChange={(e) => handleAxisChange('horizontal', Number(e.target.value))}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
              <span className="text-[10px] text-gray-400">px</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400">Vertical (T+B)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={60}
                value={paddingConfig.top}
                onChange={(e) => handleAxisChange('vertical', Number(e.target.value))}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
              <span className="text-[10px] text-gray-400">px</span>
            </div>
          </div>
        </div>
      )}

      {mode === 'individual' && (
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map(side => (
            <div key={side} className="space-y-1">
              <label className="text-[10px] text-gray-400 capitalize">{side}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={paddingConfig[side]}
                  onChange={(e) => handleIndividualChange(side, Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
                <span className="text-[10px] text-gray-400">px</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
