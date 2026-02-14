'use client'

import { useState } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { TextLabsPaddingConfig } from '@/types/textlabs'

interface PaddingControlProps {
  paddingConfig: TextLabsPaddingConfig
  onChange: (config: TextLabsPaddingConfig) => void
  onAdvancedModified: () => void
}

export function PaddingControl({ paddingConfig, onChange, onAdvancedModified }: PaddingControlProps) {
  const [linked, setLinked] = useState(true)

  const handleChange = (side: keyof TextLabsPaddingConfig, value: number) => {
    if (linked) {
      onChange({ top: value, right: value, bottom: value, left: value })
    } else {
      onChange({ ...paddingConfig, [side]: value })
    }
    onAdvancedModified()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-300">Padding</label>
        <button
          onClick={() => setLinked(!linked)}
          className={`p-1 rounded transition-colors ${
            linked
              ? 'text-purple-400 hover:text-purple-300'
              : 'text-gray-500 hover:text-gray-400'
          }`}
          title={linked ? 'Unlink sides' : 'Link all sides'}
        >
          {linked ? <Link2 className="h-3.5 w-3.5" /> : <Unlink2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {linked ? (
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">All Sides</label>
          <input
            type="range"
            min={0}
            max={60}
            value={paddingConfig.top}
            onChange={(e) => handleChange('top', Number(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="text-[10px] text-gray-500 text-right">{paddingConfig.top}px</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map(side => (
            <div key={side} className="space-y-1">
              <label className="text-[10px] text-gray-500 capitalize">{side}</label>
              <input
                type="range"
                min={0}
                max={60}
                value={paddingConfig[side]}
                onChange={(e) => handleChange(side, Number(e.target.value))}
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
