"use client"

import { useState, useMemo } from 'react'
import { GitBranch, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import {
  DiagramType,
  DiagramStyle,
  DiagramDirection,
  DIAGRAM_TYPES,
  DIAGRAM_STYLES,
} from '@/types/elements'
import {
  PanelSection,
  Divider,
} from '@/components/ui/panel'

// Direction options (for Mermaid diagrams)
const DIRECTION_OPTIONS: { value: DiagramDirection; label: string; title: string }[] = [
  { value: 'TB', label: 'TB', title: 'Top to Bottom' },
  { value: 'BT', label: 'BT', title: 'Bottom to Top' },
  { value: 'LR', label: 'LR', title: 'Left to Right' },
  { value: 'RL', label: 'RL', title: 'Right to Left' },
]

// Diagrams that support direction setting
const DIRECTIONAL_DIAGRAMS: DiagramType[] = ['flowchart', 'sequence', 'state', 'erDiagram']

// Quick color presets
const COLOR_PRESETS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// Group diagram types by their group property
function groupDiagramTypes() {
  const groups: Record<string, typeof DIAGRAM_TYPES> = {}
  for (const diagram of DIAGRAM_TYPES) {
    if (!groups[diagram.group]) {
      groups[diagram.group] = []
    }
    groups[diagram.group].push(diagram)
  }
  return groups
}

export function DiagramAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [diagramType, setDiagramType] = useState<DiagramType | null>(null)
  const [diagramStyle, setDiagramStyle] = useState<DiagramStyle>('professional')
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [direction, setDirection] = useState<DiagramDirection>('TB')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Cycle', 'Process']))

  // Group diagram types
  const groupedDiagrams = useMemo(() => groupDiagramTypes(), [])

  // Check if direction selector should be shown
  const showDirectionSelector = diagramType && DIRECTIONAL_DIAGRAMS.includes(diagramType)

  // Get selected diagram info
  const selectedDiagram = useMemo(
    () => DIAGRAM_TYPES.find(d => d.type === diagramType),
    [diagramType]
  )

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(group)) {
        newSet.delete(group)
      } else {
        newSet.add(group)
      }
      return newSet
    })
  }

  // Handle diagram type selection
  const handleDiagramTypeChange = async (type: DiagramType, comingSoon?: boolean) => {
    if (comingSoon) return // Don't select coming soon diagrams

    setDiagramType(type)
    try {
      await onSendCommand('setDiagramType', {
        elementId,
        type,
      })
    } catch (err) {
      // Silently handle - UI update is enough
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
        style: diagramStyle,
        primaryColor,
        direction: showDirectionSelector ? direction : undefined,
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
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-pink-400" />
        <span className="text-[11px] font-medium text-gray-300">Diagram Generator</span>
      </div>

      {/* Diagram Type Selector - Grouped */}
      <PanelSection title="Type">
        <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
          {Object.entries(groupedDiagrams).map(([group, diagrams]) => (
            <div key={group} className="border border-gray-700/50 rounded-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-800 text-[10px] font-medium text-gray-300 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {group}
                  {group === 'Coming Soon' && (
                    <span className="px-1.5 py-0.5 bg-yellow-600/20 text-yellow-400 rounded text-[9px]">
                      Soon
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    expandedGroups.has(group) ? "rotate-180" : ""
                  )}
                />
              </button>
              {/* Group Content */}
              {expandedGroups.has(group) && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-900/50">
                  {diagrams.map(({ type, label, comingSoon }) => (
                    <button
                      key={type}
                      onClick={() => handleDiagramTypeChange(type, comingSoon)}
                      disabled={isGenerating || isApplying || comingSoon}
                      className={cn(
                        "px-2 py-1.5 rounded-md text-[10px] font-medium transition-all text-left truncate",
                        comingSoon
                          ? "bg-gray-800/30 text-gray-500 cursor-not-allowed"
                          : diagramType === type
                          ? "bg-pink-600 text-white shadow-sm"
                          : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                      )}
                      title={comingSoon ? `${label} - Coming Soon` : label}
                    >
                      {label}
                      {comingSoon && (
                        <span className="ml-1 text-[8px] text-yellow-400">●</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PanelSection>

      {/* Selected type indicator */}
      {selectedDiagram && (
        <div className={cn(
          "px-3 py-2 rounded-lg text-[10px]",
          selectedDiagram.comingSoon
            ? "bg-yellow-600/10 border border-yellow-600/20 text-yellow-300"
            : "bg-pink-600/10 border border-pink-600/20 text-pink-300"
        )}>
          Selected: <span className="font-medium">{selectedDiagram.label}</span>
          {selectedDiagram.comingSoon && " (Coming Soon)"}
        </div>
      )}

      {/* Style Selector */}
      <PanelSection title="Style">
        <div className="grid grid-cols-4 gap-1">
          {DIAGRAM_STYLES.map(({ style, label }) => (
            <button
              key={style}
              onClick={() => setDiagramStyle(style)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded-md text-[10px] font-medium transition-all",
                diagramStyle === style
                  ? "bg-pink-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Primary Color Picker */}
      <PanelSection title="Primary Color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={isGenerating || isApplying}
            className="w-9 h-7 rounded-md border border-gray-700/50 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={isGenerating || isApplying}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-lg",
              "bg-gray-800/60 border border-gray-700/50",
              "text-[11px] text-gray-200 font-mono",
              "focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20",
              "transition-all duration-150"
            )}
            placeholder="#3b82f6"
          />
          {/* Quick color presets */}
          <div className="flex gap-1">
            {COLOR_PRESETS.map(color => (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "w-5 h-5 rounded-md border-2 transition-all",
                  primaryColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      </PanelSection>

      {/* Direction (for directional diagrams) */}
      {showDirectionSelector && (
        <PanelSection title="Direction">
          <div className="flex bg-gray-800/50 rounded-lg p-[3px]">
            {DIRECTION_OPTIONS.map(({ value, label, title }) => (
              <button
                key={value}
                onClick={() => setDirection(value)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all",
                  direction === value
                    ? "bg-pink-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                )}
                title={title}
              >
                {label}
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      <Divider label="generate with AI" />

      {/* AI Prompt */}
      <div className="space-y-2">
        <span className="text-[10px] text-gray-500">Describe your diagram</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            diagramType === 'flowchart' || diagramType === 'process_flow_3' || diagramType === 'process_flow_5'
              ? "E.g., User login flow with password reset option..."
              : diagramType === 'sequence'
              ? "E.g., API request between client, server, and database..."
              : diagramType === 'gantt'
              ? "E.g., Project phases: Design, Development, Testing..."
              : diagramType === 'swot'
              ? "E.g., SWOT analysis for a new product launch..."
              : diagramType?.includes('venn')
              ? "E.g., Overlap between marketing, sales, and product teams..."
              : diagramType?.includes('pyramid')
              ? "E.g., Maslow's hierarchy of needs..."
              : diagramType?.includes('funnel')
              ? "E.g., Sales funnel: Awareness → Interest → Decision → Action..."
              : diagramType?.includes('cycle')
              ? "E.g., Product development lifecycle..."
              : "Describe what you want to visualize..."
          }
          disabled={isGenerating}
          rows={4}
          className={cn(
            "w-full px-3 py-2 rounded-lg resize-none",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            "focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20",
            "transition-all duration-150"
          )}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className={cn(
          "px-3 py-2 rounded-lg",
          "bg-red-500/10 border border-red-500/20",
          "text-[10px] text-red-400"
        )}>
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !diagramType || !prompt.trim() || selectedDiagram?.comingSoon}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-10 rounded-lg",
          "text-[11px] font-medium transition-all duration-150",
          isGenerating || isApplying || !diagramType || !prompt.trim() || selectedDiagram?.comingSoon
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/20"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Diagram
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        AI generates diagrams from your description
      </p>
    </div>
  )
}
