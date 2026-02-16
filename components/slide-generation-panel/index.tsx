'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GenerationInput } from '@/components/generation-panel/shared/generation-input'
import { CollapsibleSection } from '@/components/generation-panel/shared/collapsible-section'
import { MandatoryConfig, MandatoryFieldOptionGroup } from '@/components/generation-panel/types'
import {
  SlideLayoutType,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_CATEGORIES,
} from '@/types/elements'

interface SlideGenerationPanelProps {
  isOpen: boolean
  onClose: () => void
  currentSlide: number
  currentLayout?: SlideLayoutType
}

// Build grouped options from existing layout data
const slideTypeGroups: MandatoryFieldOptionGroup[] = SLIDE_LAYOUT_CATEGORIES.map(cat => ({
  group: cat.label,
  options: SLIDE_LAYOUTS
    .filter(l => l.category === cat.category)
    .map(l => ({ value: l.layout, label: l.label })),
}))

function getLayoutLabel(layout: SlideLayoutType): string {
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.label ?? layout
}

function getLayoutDescription(layout: SlideLayoutType): string {
  return SLIDE_LAYOUTS.find(l => l.layout === layout)?.description ?? ''
}

export function SlideGenerationPanel({
  isOpen,
  onClose,
  currentSlide,
  currentLayout,
}: SlideGenerationPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedLayout, setSelectedLayout] = useState<SlideLayoutType>('C1-text')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    layout: true,
    content: false,
    background: false,
    typography: false,
    elements: false,
    animation: false,
  })

  // Sync selectedLayout with currentLayout prop when slide changes
  useEffect(() => {
    if (currentLayout) setSelectedLayout(currentLayout)
  }, [currentLayout])

  // Build mandatory config for the layout chip
  const mandatoryConfig: MandatoryConfig = {
    fieldLabel: 'Slide Layout',
    displayLabel: getLayoutLabel(selectedLayout),
    optionGroups: slideTypeGroups,
    onChange: (value: string) => setSelectedLayout(value as SlideLayoutType),
    promptPlaceholder: 'Describe the slide you want to generate or edit...',
  }

  const handleGenerate = useCallback(() => {
    console.log('Slide generation requested:', { prompt, layout: selectedLayout, showAdvanced })
  }, [prompt, selectedLayout, showAdvanced])

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) {
        e.preventDefault()
        handleGenerate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose, handleGenerate])

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none">
      <div
        className={cn(
          "flex-1 bg-white flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0 max-w-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Layout className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-900">Slide</h3>
              <p className="text-[10px] text-gray-500">Generate or edit slide content</p>
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

        {/* Slide context bar */}
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">
            Editing <span className="font-semibold">Slide {currentSlide}</span>
          </p>
        </div>

        {/* Generation input */}
        <GenerationInput
          prompt={prompt}
          onPromptChange={setPrompt}
          mandatoryConfig={mandatoryConfig}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced(prev => !prev)}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          error={null}
        />

        {/* Advanced sections */}
        <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 ${!showAdvanced ? 'hidden' : ''}`}>
          {/* Layout */}
          <CollapsibleSection
            title="Layout"
            isOpen={openSections.layout}
            onToggle={() => toggleSection('layout')}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">{getLayoutLabel(selectedLayout)}</span>
                <span className="text-[10px] text-gray-400">{selectedLayout}</span>
              </div>
              <p className="text-[10px] text-gray-500">{getLayoutDescription(selectedLayout)}</p>
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <p className="text-[10px] text-gray-400">Layout preview coming soon</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Content */}
          <CollapsibleSection
            title="Content"
            isOpen={openSections.content}
            onToggle={() => toggleSection('content')}
          >
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Title</label>
                <div className="mt-1 h-8 rounded-md bg-gray-100 border border-gray-200 px-2 flex items-center">
                  <span className="text-xs text-gray-300">Title text</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Subtitle</label>
                <div className="mt-1 h-8 rounded-md bg-gray-100 border border-gray-200 px-2 flex items-center">
                  <span className="text-xs text-gray-300">Subtitle text</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Body</label>
                <div className="mt-1 h-16 rounded-md bg-gray-100 border border-gray-200 px-2 pt-2">
                  <span className="text-xs text-gray-300">Body content</span>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Background */}
          <CollapsibleSection
            title="Background"
            isOpen={openSections.background}
            onToggle={() => toggleSection('background')}
          >
            <div className="bg-gray-50 rounded-md p-3 text-center">
              <p className="text-[10px] text-gray-400">Color, gradient, and background image options — Coming soon</p>
            </div>
          </CollapsibleSection>

          {/* Typography */}
          <CollapsibleSection
            title="Typography"
            isOpen={openSections.typography}
            onToggle={() => toggleSection('typography')}
          >
            <div className="bg-gray-50 rounded-md p-3 text-center">
              <p className="text-[10px] text-gray-400">Heading font, body font, size scale — Coming soon</p>
            </div>
          </CollapsibleSection>

          {/* Visual Elements */}
          <CollapsibleSection
            title="Visual Elements"
            isOpen={openSections.elements}
            onToggle={() => toggleSection('elements')}
          >
            <div className="bg-gray-50 rounded-md p-3 text-center">
              <p className="text-[10px] text-gray-400">Image, chart, and diagram configuration — Coming soon</p>
            </div>
          </CollapsibleSection>

          {/* Animation */}
          <CollapsibleSection
            title="Animation"
            isOpen={openSections.animation}
            onToggle={() => toggleSection('animation')}
          >
            <div className="bg-gray-50 rounded-md p-3 text-center">
              <p className="text-[10px] text-gray-400">Slide transitions and timing — Coming soon</p>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
