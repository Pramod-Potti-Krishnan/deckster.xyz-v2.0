"use client"

import { useState } from 'react'
import { GitBranch, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { DIAGRAM_TYPES, DiagramType, DiagramDirection, DiagramTheme } from '@/types/elements'

// Direction options
const DIRECTION_OPTIONS: { value: DiagramDirection; label: string }[] = [
  { value: 'TB', label: 'TB' },
  { value: 'BT', label: 'BT' },
  { value: 'LR', label: 'LR' },
  { value: 'RL', label: 'RL' },
]

// Theme options
const THEME_OPTIONS: { value: DiagramTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'forest', label: 'Forest' },
  { value: 'dark', label: 'Dark' },
  { value: 'neutral', label: 'Neutral' },
]

// Descriptions for each diagram type
const DIAGRAM_DESCRIPTIONS: Record<DiagramType, string> = {
  flowchart: 'Process flows & decisions',
  sequence: 'Interaction sequences',
  class: 'UML class diagrams',
  state: 'State machine diagrams',
  er: 'Entity-relationship diagrams',
  gantt: 'Project timelines',
  mindmap: 'Hierarchical ideas',
  timeline: 'Historical events',
  userjourney: 'User experience flow',
  gitgraph: 'Git branch visualization',
  pie: 'Simple pie charts',
}

export function DiagramAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [diagramType, setDiagramType] = useState<DiagramType | null>(null)
  const [direction, setDirection] = useState<DiagramDirection>('TB')
  const [theme, setTheme] = useState<DiagramTheme>('default')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Change theme
  const handleThemeChange = async (newTheme: DiagramTheme) => {
    setTheme(newTheme)
    try {
      await onSendCommand('setDiagramTheme', {
        elementId,
        theme: newTheme,
      })
    } catch (err) {
      // Silently handle
    }
  }

  // Generate diagram with AI
  const handleGenerate = async () => {
    if (!diagramType) {
      setError('Please select a diagram type')
      return
    }

    if (!prompt.trim()) {
      setError('Please describe your diagram')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateDiagram', {
        prompt: prompt.trim(),
        type: diagramType,
        direction,
        theme,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate diagram')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-pink-400">
        <GitBranch className="h-4 w-4" />
        <span className="text-sm font-medium">Diagram (Mermaid)</span>
      </div>

      {/* Diagram Type Selector - 10 types */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          {DIAGRAM_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setDiagramType(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "px-2 py-1.5 rounded-md text-xs font-medium transition-colors text-left",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                diagramType === type
                  ? "bg-pink-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={DIAGRAM_DESCRIPTIONS[type]}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected type description */}
      {diagramType && (
        <div className="px-2 py-1.5 bg-pink-600/10 border border-pink-600/30 rounded text-xs text-pink-300">
          {DIAGRAM_DESCRIPTIONS[diagramType]}
        </div>
      )}

      {/* Direction (for flowcharts, sequence, etc.) */}
      {diagramType && ['flowchart', 'sequence', 'class', 'state', 'er'].includes(diagramType) && (
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Direction</label>
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {DIRECTION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDirection(value)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                  direction === value
                    ? "bg-pink-600 text-white"
                    : "text-gray-400 hover:text-white"
                )}
                title={value === 'TB' ? 'Top to Bottom' : value === 'BT' ? 'Bottom to Top' : value === 'LR' ? 'Left to Right' : 'Right to Left'}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Theme */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Theme</label>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {THEME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              disabled={isGenerating || isApplying}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                theme === value
                  ? "bg-pink-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe your diagram</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder={diagramType === 'flowchart'
            ? "E.g., User login flow with password reset option..."
            : diagramType === 'sequence'
            ? "E.g., API request between client, server, and database..."
            : diagramType === 'class'
            ? "E.g., User and Order classes with relationships..."
            : diagramType === 'gantt'
            ? "E.g., Project phases: Design, Development, Testing..."
            : "Describe what you want to visualize..."}
          disabled={isGenerating}
          rows={4}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-2 py-1.5 bg-red-600/20 border border-red-500 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !diagramType || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || !diagramType || !prompt.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-pink-600 hover:bg-pink-700 text-white"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Diagram
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        AI generates Mermaid diagrams from your description
      </p>
    </div>
  )
}
