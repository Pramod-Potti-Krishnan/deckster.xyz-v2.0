'use client'

import { X, Type, TrendingUp, Table, BarChart3, ImageIcon, Tag, Pentagon, LayoutGrid, GitBranch, RefreshCw } from 'lucide-react'
import { TextLabsComponentType, COMPONENT_TYPE_INFO } from '@/types/textlabs'
import { Switch } from '@/components/ui/switch'

const COMPONENT_ICONS: Record<TextLabsComponentType, React.ComponentType<{ className?: string }>> = {
  TEXT_BOX: Type,
  METRICS: TrendingUp,
  TABLE: Table,
  CHART: BarChart3,
  IMAGE: ImageIcon,
  ICON_LABEL: Tag,
  SHAPE: Pentagon,
  INFOGRAPHIC: LayoutGrid,
  DIAGRAM: GitBranch,
}

interface GenerationPanelHeaderProps {
  elementType: TextLabsComponentType
  onClose: () => void
  onElementTypeChange?: (type: TextLabsComponentType) => void
  mode: 'generate' | 'edit'
  regenerateEnabled: boolean
  onRegenerateToggle: (enabled: boolean) => void
}

export function GenerationPanelHeader({ elementType, onClose, mode, regenerateEnabled, onRegenerateToggle }: GenerationPanelHeaderProps) {
  const Icon = COMPONENT_ICONS[elementType] || Type
  const info = COMPONENT_TYPE_INFO[elementType] || { label: elementType, description: '' }

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-900">{info.label}</h3>
          <p className="text-[10px] text-gray-500">
            {mode === 'edit' ? 'Edit element settings' : info.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'edit' && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="h-3 w-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">Regenerate</span>
            <Switch
              checked={regenerateEnabled}
              onCheckedChange={onRegenerateToggle}
              className="scale-75"
            />
          </label>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Close panel"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
