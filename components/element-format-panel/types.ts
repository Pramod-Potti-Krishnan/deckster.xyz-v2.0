// Panel-specific types for ElementFormatPanel

import { ElementType, ElementProperties, BaseElementProperties } from '@/types/elements'

export type PanelTabType = 'ai' | 'arrange'

// Props for the main ElementFormatPanel
export interface ElementFormatPanelProps {
  isOpen: boolean
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onClose: () => void
  elementId: string | null
  elementType: ElementType | null
  properties: ElementProperties | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  onDelete?: () => void
  presentationId?: string | null
  slideIndex?: number
}

// Props for the shared ArrangeTab
export interface ArrangeTabProps {
  properties: BaseElementProperties | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
}

// Base props for all AI tabs
export interface BaseAITabProps {
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
  presentationId?: string | null
  slideIndex?: number
}

// Props for shared PromptInput component
export interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
}

// Props for shared TypeSelector component
export interface TypeSelectorProps<T extends string> {
  label: string
  options: { type: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  columns?: number
}

// Alignment options for ArrangeTab
export type HorizontalAlignment = 'left' | 'center' | 'right'
export type VerticalAlignment = 'top' | 'middle' | 'bottom'

// Align dropdown options
export const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
] as const

// Distribute dropdown options
export const DISTRIBUTE_OPTIONS = [
  { value: 'horizontal', label: 'Horizontally' },
  { value: 'vertical', label: 'Vertically' },
] as const
