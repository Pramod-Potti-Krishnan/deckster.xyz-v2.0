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
  const Icon = COMPONENT_ICONS[elementType]
  const info = COMPONENT_TYPE_INFO[elementType]

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20">
          <Icon className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-100">{info.label}</h3>
          <p className="text-[10px] text-gray-400">{info.description}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-md hover:bg-gray-700 transition-colors"
        title="Close panel"
      >
        <X className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  )
}
