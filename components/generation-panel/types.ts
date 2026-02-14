import { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'

export interface GenerationPanelProps {
  isOpen: boolean
  elementType: TextLabsComponentType
  onClose: () => void
  onGenerate: (formData: TextLabsFormData) => Promise<void>
  onElementTypeChange: (type: TextLabsComponentType) => void
  isGenerating: boolean
  error: string | null
  slideIndex: number
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
