"use client"

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AITabProps {
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
  presentationId?: string | null
  slideIndex?: number
}

type ContentStyle = 'professional' | 'casual' | 'creative'

const STYLE_OPTIONS: { value: ContentStyle; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Formal, business-appropriate tone' },
  { value: 'casual', label: 'Casual', description: 'Friendly, conversational tone' },
  { value: 'creative', label: 'Creative', description: 'Engaging, imaginative style' }
]

const MAX_LENGTH_OPTIONS = [
  { label: 'Brief', value: 50 },
  { label: 'Medium', value: 150 },
  { label: 'Detailed', value: 300 }
]

const QUICK_PROMPTS = [
  'Write a compelling headline',
  'Create a bullet list of key points',
  'Write an executive summary',
  'Generate a call-to-action',
  'Create a product description'
]

export function AITab({ onSendCommand, isApplying, elementId, presentationId, slideIndex }: AITabProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<ContentStyle>('professional')
  const [maxLength, setMaxLength] = useState(150)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateTextBoxContent', {
        prompt: prompt.trim(),
        style,
        maxLength,
        elementId,
        presentationId,
        slideIndex
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt)
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 text-blue-400">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI Content Generator</span>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">What would you like to write?</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the content you want to generate..."
          disabled={isGenerating}
          className="w-full h-24 px-3 py-2 bg-gray-800 rounded-lg text-sm placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quick Prompts */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Quick prompts</label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((quickPrompt) => (
            <button
              key={quickPrompt}
              onClick={() => handleQuickPrompt(quickPrompt)}
              disabled={isGenerating}
              className="px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors"
            >
              {quickPrompt}
            </button>
          ))}
        </div>
      </div>

      {/* Style Selection */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Writing Style</label>
        <div className="space-y-1">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStyle(option.value)}
              disabled={isGenerating}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                style === option.value
                  ? "bg-blue-600/20 border border-blue-500"
                  : "bg-gray-800 hover:bg-gray-700"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center",
                  style === option.value ? "border-blue-500" : "border-gray-500"
                )}
              >
                {style === option.value && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-gray-400">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Length Selection */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Content Length</label>
        <div className="flex bg-gray-800 rounded-lg p-1">
          {MAX_LENGTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setMaxLength(option.value)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-2 text-xs rounded transition-colors",
                maxLength === option.value ? "bg-gray-600" : "hover:bg-gray-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-600/20 border border-red-500 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
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
            Generate Content
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        AI-generated content will replace existing text in the text box
      </p>
    </div>
  )
}
