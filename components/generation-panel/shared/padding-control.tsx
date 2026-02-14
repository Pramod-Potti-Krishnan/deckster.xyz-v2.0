'use client'

import { useState } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
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
        <label className="text-xs font-medium text-gray-300">Padding</label>
        <div className="flex gap-0.5">
          {([
            { value: 'uniform' as const, icon: <Link2 className="h-3 w-3" />, title: 'Uniform' },
            { value: 'axis' as const, icon: <span className="text-[9px] font-medium">HV</span>, title: 'Axis (H+V)' },
            { value: 'individual' as const, icon: <Unlink2 className="h-3 w-3" />, title: 'Individual' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`p-1 rounded transition-colors ${
                mode === opt.value
                  ? 'text-purple-400 bg-purple-600/20'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
              title={opt.title}
            >
              {opt.icon}
            </button>
          ))}
        </div>
      </div>

      {mode === 'uniform' && (
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">All Sides</label>
          <input
            type="range"
            min={0}
            max={60}
            value={paddingConfig.top}
            onChange={(e) => handleUniformChange(Number(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="text-[10px] text-gray-500 text-right">{paddingConfig.top}px</div>
        </div>
      )}

      {mode === 'axis' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Horizontal (L+R)</label>
            <input
              type="range"
              min={0}
              max={60}
              value={paddingConfig.left}
              onChange={(e) => handleAxisChange('horizontal', Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="text-[10px] text-gray-500 text-right">{paddingConfig.left}px</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Vertical (T+B)</label>
            <input
              type="range"
              min={0}
              max={60}
              value={paddingConfig.top}
              onChange={(e) => handleAxisChange('vertical', Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="text-[10px] text-gray-500 text-right">{paddingConfig.top}px</div>
          </div>
        </div>
      )}

      {mode === 'individual' && (
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map(side => (
            <div key={side} className="space-y-1">
              <label className="text-[10px] text-gray-500 capitalize">{side}</label>
              <input
                type="range"
                min={0}
                max={60}
                value={paddingConfig[side]}
                onChange={(e) => handleIndividualChange(side, Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="text-[10px] text-gray-500 text-right">{paddingConfig[side]}px</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
