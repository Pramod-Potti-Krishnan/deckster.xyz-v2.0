"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Check, Loader2, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CompactColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'

// Data models matching backend API
interface PresentationThemeConfig {
  theme_id: string
  color_overrides?: Record<string, string> | null
}

interface ThemePreview {
  id: string
  name: string
  description: string
  colors: {
    primary: string
    accent: string
    background: string
    text_primary: string
  }
}

// Predefined theme previews with colors
const THEME_PREVIEWS: Record<string, ThemePreview> = {
  'corporate-blue': {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme for business presentations',
    colors: {
      primary: '#1e40af',
      accent: '#f59e0b',
      background: '#ffffff',
      text_primary: '#1f2937'
    }
  },
  'minimal-gray': {
    id: 'minimal-gray',
    name: 'Minimal Gray',
    description: 'Clean, minimalist gray theme',
    colors: {
      primary: '#374151',
      accent: '#6366f1',
      background: '#f9fafb',
      text_primary: '#111827'
    }
  },
  'vibrant-orange': {
    id: 'vibrant-orange',
    name: 'Vibrant Orange',
    description: 'Energetic orange theme for creative presentations',
    colors: {
      primary: '#ea580c',
      accent: '#0891b2',
      background: '#fffbeb',
      text_primary: '#1c1917'
    }
  },
  'dark-mode': {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Dark theme for low-light environments',
    colors: {
      primary: '#60a5fa',
      accent: '#f472b6',
      background: '#1f2937',
      text_primary: '#f9fafb'
    }
  }
}

const THEME_IDS = ['corporate-blue', 'minimal-gray', 'vibrant-orange', 'dark-mode'] as const

interface ThemePanelProps {
  isOpen: boolean
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
  presentationId?: string | null
}

/**
 * ThemePanel Component
 *
 * Slide-out panel for managing presentation themes with live preview.
 */
export function ThemePanel({
  isOpen,
  onClose,
  iframeRef,
  viewerOrigin,
  presentationId,
}: ThemePanelProps) {
  const { toast } = useToast()

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState<string>('corporate-blue')
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({})

  // Original state for cancel restoration
  const [originalTheme, setOriginalTheme] = useState<PresentationThemeConfig | null>(null)

  // Track changes
  const [hasChanges, setHasChanges] = useState(false)

  /**
   * Send command to iframe via postMessage
   */
  const sendCommand = useCallback(async (
    action: string,
    params?: Record<string, any>
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!iframeRef.current) {
        reject(new Error('Iframe not ready'))
        return
      }

      const handler = (event: MessageEvent) => {
        if (event.origin !== viewerOrigin) return

        if (event.data.action === action) {
          window.removeEventListener('message', handler)

          if (event.data.success) {
            resolve(event.data)
          } else {
            reject(new Error(event.data.error || 'Command failed'))
          }
        }
      }

      window.addEventListener('message', handler)

      setTimeout(() => {
        window.removeEventListener('message', handler)
        reject(new Error('Command timeout'))
      }, 10000)

      iframeRef.current.contentWindow?.postMessage({ action, params }, viewerOrigin)
    })
  }, [iframeRef, viewerOrigin])

  /**
   * Load current theme when panel opens
   */
  const loadCurrentTheme = useCallback(async () => {
    if (!isOpen) return

    setIsLoading(true)
    try {
      const result = await sendCommand('getTheme')
      const config: PresentationThemeConfig = result.themeConfig || { theme_id: 'corporate-blue' }

      setSelectedTheme(config.theme_id || 'corporate-blue')
      setColorOverrides(config.color_overrides || {})
      setOriginalTheme(config)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to load theme:', error)
      // Default to corporate-blue if no theme set
      setSelectedTheme('corporate-blue')
      setColorOverrides({})
      setOriginalTheme({ theme_id: 'corporate-blue' })
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, sendCommand])

  /**
   * Load theme when panel opens
   */
  useEffect(() => {
    if (isOpen) {
      loadCurrentTheme()
    }
  }, [isOpen, loadCurrentTheme])

  /**
   * Preview theme in iframe
   */
  const previewTheme = useCallback(async (themeId: string, overrides?: Record<string, string>) => {
    try {
      await sendCommand('previewTheme', {
        themeId,
        colorOverrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined
      })
    } catch (error) {
      console.error('Failed to preview theme:', error)
    }
  }, [sendCommand])

  /**
   * Handle theme selection
   */
  const handleSelectTheme = async (themeId: string) => {
    setSelectedTheme(themeId)
    setHasChanges(true)
    // Clear overrides when switching themes
    setColorOverrides({})
    await previewTheme(themeId)
  }

  /**
   * Handle color override change
   */
  const handleColorChange = async (key: string, value: string) => {
    const newOverrides = { ...colorOverrides, [key]: value }
    setColorOverrides(newOverrides)
    setHasChanges(true)
    await previewTheme(selectedTheme, newOverrides)
  }

  /**
   * Reset color overrides
   */
  const handleResetColors = async () => {
    setColorOverrides({})
    setHasChanges(true)
    await previewTheme(selectedTheme)
  }

  /**
   * Handle cancel - restore original theme
   */
  const handleCancel = async () => {
    if (originalTheme && hasChanges) {
      await previewTheme(
        originalTheme.theme_id,
        originalTheme.color_overrides || undefined
      )
    }
    onClose()
  }

  /**
   * Save theme
   */
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await sendCommand('setTheme', {
        themeId: selectedTheme,
        colorOverrides: Object.keys(colorOverrides).length > 0 ? colorOverrides : undefined
      })

      setHasChanges(false)
      toast({
        title: 'Theme applied',
        description: `Presentation theme set to ${THEME_PREVIEWS[selectedTheme]?.name || selectedTheme}`
      })
      onClose()
    } catch (error) {
      console.error('Failed to save theme:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save theme',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Get current colors (theme base + overrides)
   */
  const getCurrentColors = () => {
    const baseColors = THEME_PREVIEWS[selectedTheme]?.colors || THEME_PREVIEWS['corporate-blue'].colors
    return {
      primary: colorOverrides.primary || baseColors.primary,
      accent: colorOverrides.accent || baseColors.accent
    }
  }

  if (!isOpen) return null

  const currentColors = getCurrentColors()

  return (
    <div className="fixed inset-y-0 left-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Presentation Theme</h2>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
          title="Close panel"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Theme Selection */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Select Theme
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {THEME_IDS.map((themeId) => {
                  const theme = THEME_PREVIEWS[themeId]
                  const isSelected = selectedTheme === themeId

                  return (
                    <button
                      key={themeId}
                      onClick={() => handleSelectTheme(themeId)}
                      className={cn(
                        "relative p-3 rounded-lg border-2 transition-all text-left",
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      )}
                    >
                      {/* Color swatches */}
                      <div
                        className="h-12 rounded-md mb-2 flex items-center justify-center gap-2"
                        style={{ background: theme.colors.background }}
                      >
                        <div
                          className="w-8 h-8 rounded shadow-sm"
                          style={{ background: theme.colors.primary }}
                        />
                        <div
                          className="w-8 h-8 rounded shadow-sm"
                          style={{ background: theme.colors.accent }}
                        />
                      </div>

                      {/* Theme name */}
                      <div className="text-sm font-medium text-gray-900">
                        {theme.name}
                      </div>

                      {/* Check mark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-blue-500" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Color Customization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Customize Colors
                </h3>
                {Object.keys(colorOverrides).length > 0 && (
                  <button
                    onClick={handleResetColors}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Override the base theme colors to match your brand.
              </p>

              <div className="space-y-3">
                {/* Primary Color */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-700">Primary</Label>
                  <CompactColorPicker
                    value={currentColors.primary}
                    onChange={(color) => handleColorChange('primary', color)}
                  />
                </div>

                {/* Accent Color */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-700">Accent</Label>
                  <CompactColorPicker
                    value={currentColors.accent}
                    onChange={(color) => handleColorChange('accent', color)}
                  />
                </div>
              </div>
            </div>

            {/* Theme Description */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Current theme:</div>
              <div className="text-sm font-medium text-gray-800">
                {THEME_PREVIEWS[selectedTheme]?.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {THEME_PREVIEWS[selectedTheme]?.description}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
