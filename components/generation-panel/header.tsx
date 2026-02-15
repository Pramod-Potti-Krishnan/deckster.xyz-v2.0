'use client'

import { Type, TrendingUp, Table, BarChart3, ImageIcon, Tag, Pentagon, LayoutGrid, GitBranch } from 'lucide-react'
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
  onElementTypeChange?: (type: TextLabsComponentType) => void
}

export function GenerationPanelHeader({ elementType }: GenerationPanelHeaderProps) {
  const Icon = COMPONENT_ICONS[elementType] || Type
  const info = COMPONENT_TYPE_INFO[elementType] || { label: elementType, description: '' }

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-900">{info.label}</h3>
          <p className="text-[10px] text-gray-500">{info.description}</p>
        </div>
      </div>
    </div>
  )
}
