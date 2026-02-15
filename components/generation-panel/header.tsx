'use client'

import { X, Type, TrendingUp, Table, BarChart3, ImageIcon, Tag, Pentagon, LayoutGrid, GitBranch } from 'lucide-react'
import { TextLabsComponentType, COMPONENT_TYPE_INFO } from '@/types/textlabs'

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
}

export function GenerationPanelHeader({ elementType, onClose }: GenerationPanelHeaderProps) {
  const Icon = COMPONENT_ICONS[elementType] || Type
  const info = COMPONENT_TYPE_INFO[elementType] || { label: elementType, description: '' }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
          <Icon className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{info.label}</h3>
          <p className="text-[10px] text-gray-500">{info.description}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        title="Close panel"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  )
}
