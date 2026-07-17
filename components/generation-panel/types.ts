import React from 'react'
import {
  ElementResearchCapabilities,
  ElementResearchMode,
  TextLabsComponentType,
  TextLabsFormData,
  TextSemanticRole,
  TextSlotKind,
} from '@/types/textlabs'

export interface ElementContext {
  elementId?: string
  startCol: number
  startRow: number
  width: number
  height: number
}

export interface GenerationPanelProps {
  isOpen: boolean
  activationId: number
  draftKey?: string | null
  draft?: GenerationPanelDraft | null
  onDraftChange?: (draft: Partial<GenerationPanelDraft>) => void
  elementType: TextLabsComponentType
  onClose: () => void
  onGenerate: (formData: TextLabsFormData) => Promise<void>
  onElementTypeChange: (type: TextLabsComponentType) => void
  isGenerating: boolean
  error: string | null
  slideIndex: number
  presentationId?: string | null
  elementContext?: ElementContext | null
  mode: 'generate' | 'edit' | 'refine'
  getTemplateSlotCatalog?: (slideIndex: number) => Promise<unknown>
  existingTextTarget?: {
    elementId?: string | null
    semanticRole?: TextSemanticRole | null
    slotName?: string | null
    slotKind?: TextSlotKind | null
    accessoryType?: string | null
    generationConfig?: Record<string, unknown> | null
  } | null
  existingInfographicTarget?: {
    elementId: string
    rendererType?: string | null
    mode?: string | null
    metadata?: Record<string, unknown> | null
    content?: unknown
  } | null
  researchMode: ElementResearchMode
  researchWeb: boolean
  researchUploadedDocs: boolean
  researchKnowledgeGraph: boolean
  researchCapabilities: ElementResearchCapabilities
  onResearchModeChange: (mode: ElementResearchMode) => void
  onResearchWebChange: (enabled: boolean) => void
  onResearchUploadedDocsChange: (enabled: boolean) => void
  onResearchKnowledgeGraphChange: (enabled: boolean) => void
}

export interface GenerationPanelDraft {
  prompt?: string
  showAdvanced?: boolean
  formData?: TextLabsFormData | null
  researchMode?: ElementResearchMode
  researchWeb?: boolean
  researchUploadedDocs?: boolean
  researchKnowledgeGraph?: boolean
}

export interface ElementFormProps {
  onSubmit: (formData: TextLabsFormData) => void
  isGenerating: boolean
  slideIndex: number
}

export interface FormRef {
  getFormData: () => TextLabsFormData
  reset: () => void
}

// Mandatory config types for GenerationInput chip
export interface MandatoryFieldOption {
  value: string
  label: string
  color?: string
}

export interface MandatoryFieldOptionGroup {
  group: string
  options: MandatoryFieldOption[]
}

export interface MandatoryConfig {
  fieldLabel: string
  displayLabel: string
  selectedValue?: string
  options?: MandatoryFieldOption[]
  optionGroups?: MandatoryFieldOptionGroup[]
  onChange: (value: string) => void
  promptPlaceholder?: string
  customRender?: React.ReactNode
}
