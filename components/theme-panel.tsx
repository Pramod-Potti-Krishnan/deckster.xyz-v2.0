"use client"

import { useState, useEffect, useCallback } from 'react'
import { X, Check, Loader2, RotateCcw, ChevronDown, ChevronRight, Palette, Wand2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CompactColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

interface PresentationThemeConfig {
  theme_id: string
  color_overrides?: Record<string, string> | null
}

// Full 14-color theme interface matching backend API
interface FullThemeColors {
  // Brand Colors
  primary: string
  primary_light: string
  primary_dark: string
  accent: string
  // Background Colors
  background: string
  background_alt: string
  hero_background: string
  // Text Colors
  text_primary: string
  text_secondary: string
  text_body: string
  hero_text_primary: string
  hero_text_secondary: string
  footer_text: string
  // Border
  border: string
}

interface ThemePreview {
  id: string
  name: string
  description: string
  colors: FullThemeColors
}

type ThemeMode = 'preset' | 'custom'

// ============================================================================
// Color Configuration
// ============================================================================

// Organize colors into logical groups for the UI
const COLOR_GROUPS = {
  brand: {
    label: 'Brand Colors',
    keys: ['primary', 'primary_light', 'primary_dark', 'accent'] as const
  },
  background: {
    label: 'Background Colors',
    keys: ['background', 'background_alt', 'hero_background'] as const
  },
  text: {
    label: 'Text Colors',
    keys: ['text_primary', 'text_secondary', 'text_body', 'hero_text_primary', 'hero_text_secondary', 'footer_text'] as const
  },
  border: {
    label: 'Border',
    keys: ['border'] as const
  }
} as const

// Human-friendly labels for each color property
const COLOR_LABELS: Record<keyof FullThemeColors, string> = {
  primary: 'Primary',
  primary_light: 'Primary Light',
  primary_dark: 'Primary Dark',
  accent: 'Accent',
  background: 'Main Background',
  background_alt: 'Alternate Background',
  hero_background: 'Hero Background',
  text_primary: 'Primary Text',
  text_secondary: 'Secondary Text',
  text_body: 'Body Text',
  hero_text_primary: 'Hero Title',
  hero_text_secondary: 'Hero Subtitle',
  footer_text: 'Footer Text',
  border: 'Border Color'
}

// Full theme definitions with all 14 colors
const THEME_PREVIEWS: Record<string, ThemePreview> = {
  'corporate-blue': {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme for business presentations',
    colors: {
      primary: '#1e40af',
      primary_light: '#3b82f6',
      primary_dark: '#1e3a8a',
      accent: '#f59e0b',
      background: '#ffffff',
      background_alt: '#f8fafc',
      hero_background: '#1e40af',
      text_primary: '#1f2937',
      text_secondary: '#6b7280',
      text_body: '#374151',
      hero_text_primary: '#ffffff',
      hero_text_secondary: '#e0e7ff',
      footer_text: '#9ca3af',
      border: '#e5e7eb'
    }
  },
  'minimal-gray': {
    id: 'minimal-gray',
    name: 'Minimal Gray',
    description: 'Clean, minimalist gray theme',
    colors: {
      primary: '#374151',
      primary_light: '#6b7280',
      primary_dark: '#1f2937',
      accent: '#6366f1',
      background: '#f9fafb',
      background_alt: '#f3f4f6',
      hero_background: '#374151',
      text_primary: '#111827',
      text_secondary: '#6b7280',
      text_body: '#4b5563',
      hero_text_primary: '#ffffff',
      hero_text_secondary: '#d1d5db',
      footer_text: '#9ca3af',
      border: '#e5e7eb'
    }
  },
  'vibrant-orange': {
    id: 'vibrant-orange',
    name: 'Vibrant Orange',
    description: 'Energetic orange theme for creative presentations',
    colors: {
      primary: '#ea580c',
      primary_light: '#fb923c',
      primary_dark: '#c2410c',
      accent: '#0891b2',
      background: '#fffbeb',
      background_alt: '#fef3c7',
      hero_background: '#ea580c',
      text_primary: '#1c1917',
      text_secondary: '#78716c',
      text_body: '#44403c',
      hero_text_primary: '#ffffff',
      hero_text_secondary: '#fed7aa',
      footer_text: '#a8a29e',
      border: '#e7e5e4'
    }
  },
  'dark-mode': {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Dark theme for low-light environments',
    colors: {
      primary: '#60a5fa',
      primary_light: '#93c5fd',
      primary_dark: '#3b82f6',
      accent: '#f472b6',
      background: '#1f2937',
      background_alt: '#374151',
      hero_background: '#111827',
      text_primary: '#f9fafb',
      text_secondary: '#d1d5db',
      text_body: '#e5e7eb',
      hero_text_primary: '#ffffff',
      hero_text_secondary: '#93c5fd',
      footer_text: '#9ca3af',
      border: '#4b5563'
    }
  }
}

const THEME_IDS = ['corporate-blue', 'minimal-gray', 'vibrant-orange', 'dark-mode'] as const

// ============================================================================
// Collapsible Color Section Component
// ============================================================================

interface ColorSectionProps {
  title: string
  colorKeys: readonly string[]
  colors: Record<string, string>
  baseColors: FullThemeColors
  onColorChange: (key: string, value: string) => void
  onResetSection: () => void
  hasOverrides: boolean
  defaultExpanded?: boolean
}

function ColorSection({
  title,
  colorKeys,
  colors,
  baseColors,
  onColorChange,
  onResetSection,
  hasOverrides,
  defaultExpanded = false
}: ColorSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {hasOverrides && (
            <span className="w-2 h-2 rounded-full bg-blue-500" title="Has customizations" />
          )}
        </div>
        {hasOverrides && isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onResetSection()
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded hover:bg-gray-200"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {colorKeys.map((key) => {
            const colorKey = key as keyof FullThemeColors
            const currentValue = colors[key] || baseColors[colorKey]
            const isOverridden = colors[key] !== undefined

            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600">
                    {COLOR_LABELS[colorKey]}
                  </Label>
                  {isOverridden && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">
                    {currentValue}
                  </span>
                  <CompactColorPicker
                    value={currentValue}
                    onChange={(color) => onColorChange(key, color)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Theme Panel Component
// ============================================================================

interface ThemePanelProps {
  isOpen: boolean
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
  presentationId?: string | null
}

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

  // Mode toggle
  const [themeMode, setThemeMode] = useState<ThemeMode>('preset')

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
          console.log(`[ThemePanel] Received response for ${action}:`, event.data)

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

      console.log(`[ThemePanel] Sending postMessage:`, { action, params })
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

      // If there are significant color overrides, default to custom mode
      const overrideCount = Object.keys(config.color_overrides || {}).length
      if (overrideCount > 2) {
        setThemeMode('custom')
      }
    } catch (error) {
      console.error('Failed to load theme:', error)
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
    console.log('[ThemePanel] previewTheme called:', { themeId, overrides })
    try {
      const result = await sendCommand('previewTheme', {
        themeId,
        colorOverrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined
      })
      console.log('[ThemePanel] previewTheme success:', result)
    } catch (error) {
      console.error('[ThemePanel] previewTheme failed:', error)
      toast({
        title: 'Preview failed',
        description: error instanceof Error ? error.message : 'Could not preview theme',
        variant: 'destructive'
      })
    }
  }, [sendCommand, toast])

  /**
   * Handle theme selection (preset mode)
   */
  const handleSelectTheme = async (themeId: string) => {
    setSelectedTheme(themeId)
    setHasChanges(true)
    // Clear overrides when switching base themes
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
   * Reset specific color group
   */
  const handleResetSection = async (keys: readonly string[]) => {
    const newOverrides = { ...colorOverrides }
    keys.forEach(key => {
      delete newOverrides[key]
    })
    setColorOverrides(newOverrides)
    setHasChanges(true)
    await previewTheme(selectedTheme, Object.keys(newOverrides).length > 0 ? newOverrides : undefined)
  }

  /**
   * Reset all color overrides
   */
  const handleResetAll = async () => {
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
   * Get current colors (theme base merged with overrides)
   */
  const getCurrentColors = (): Record<string, string> => {
    const baseColors = THEME_PREVIEWS[selectedTheme]?.colors || THEME_PREVIEWS['corporate-blue'].colors
    return { ...baseColors, ...colorOverrides }
  }

  /**
   * Check if a color group has overrides
   */
  const hasGroupOverrides = (keys: readonly string[]): boolean => {
    return keys.some(key => colorOverrides[key] !== undefined)
  }

  if (!isOpen) return null

  const baseColors = THEME_PREVIEWS[selectedTheme]?.colors || THEME_PREVIEWS['corporate-blue'].colors
  const currentColors = getCurrentColors()
  const totalOverrides = Object.keys(colorOverrides).length

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

      {/* Mode Toggle */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setThemeMode('preset')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              themeMode === 'preset'
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Palette className="h-4 w-4" />
            Preset Themes
          </button>
          <button
            onClick={() => setThemeMode('custom')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              themeMode === 'custom'
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Wand2 className="h-4 w-4" />
            Build Custom
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : themeMode === 'preset' ? (
          /* ============ PRESET THEMES MODE ============ */
          <>
            {/* Theme Selection Grid */}
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

            {/* Quick Color Customization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Quick Customize
                </h3>
                {totalOverrides > 0 && (
                  <button
                    onClick={handleResetAll}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset All
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Quickly adjust the main colors. Switch to "Build Custom" for full control.
              </p>

              <div className="space-y-3">
                {/* Primary Color */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-700">Primary</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">
                      {currentColors.primary}
                    </span>
                    <CompactColorPicker
                      value={currentColors.primary}
                      onChange={(color) => handleColorChange('primary', color)}
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-700">Accent</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">
                      {currentColors.accent}
                    </span>
                    <CompactColorPicker
                      value={currentColors.accent}
                      onChange={(color) => handleColorChange('accent', color)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Description */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Current theme:</div>
              <div className="text-sm font-medium text-gray-800">
                {THEME_PREVIEWS[selectedTheme]?.name}
                {totalOverrides > 0 && (
                  <span className="text-xs text-blue-600 ml-2">
                    ({totalOverrides} customization{totalOverrides !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {THEME_PREVIEWS[selectedTheme]?.description}
              </div>
            </div>
          </>
        ) : (
          /* ============ BUILD CUSTOM MODE ============ */
          <>
            {/* Base Theme Selector */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Base Theme
              </h3>
              <p className="text-xs text-gray-500">
                Start from a preset theme and customize all colors below.
              </p>
              <select
                value={selectedTheme}
                onChange={(e) => handleSelectTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {THEME_IDS.map((themeId) => (
                  <option key={themeId} value={themeId}>
                    {THEME_PREVIEWS[themeId].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset All Button */}
            {totalOverrides > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleResetAll}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset All Colors ({totalOverrides})
                </button>
              </div>
            )}

            {/* Color Sections */}
            <div className="space-y-3">
              {/* Brand Colors */}
              <ColorSection
                title={COLOR_GROUPS.brand.label}
                colorKeys={COLOR_GROUPS.brand.keys}
                colors={colorOverrides}
                baseColors={baseColors}
                onColorChange={handleColorChange}
                onResetSection={() => handleResetSection(COLOR_GROUPS.brand.keys)}
                hasOverrides={hasGroupOverrides(COLOR_GROUPS.brand.keys)}
                defaultExpanded={true}
              />

              {/* Background Colors */}
              <ColorSection
                title={COLOR_GROUPS.background.label}
                colorKeys={COLOR_GROUPS.background.keys}
                colors={colorOverrides}
                baseColors={baseColors}
                onColorChange={handleColorChange}
                onResetSection={() => handleResetSection(COLOR_GROUPS.background.keys)}
                hasOverrides={hasGroupOverrides(COLOR_GROUPS.background.keys)}
              />

              {/* Text Colors */}
              <ColorSection
                title={COLOR_GROUPS.text.label}
                colorKeys={COLOR_GROUPS.text.keys}
                colors={colorOverrides}
                baseColors={baseColors}
                onColorChange={handleColorChange}
                onResetSection={() => handleResetSection(COLOR_GROUPS.text.keys)}
                hasOverrides={hasGroupOverrides(COLOR_GROUPS.text.keys)}
              />

              {/* Border */}
              <ColorSection
                title={COLOR_GROUPS.border.label}
                colorKeys={COLOR_GROUPS.border.keys}
                colors={colorOverrides}
                baseColors={baseColors}
                onColorChange={handleColorChange}
                onResetSection={() => handleResetSection(COLOR_GROUPS.border.keys)}
                hasOverrides={hasGroupOverrides(COLOR_GROUPS.border.keys)}
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Building from:</div>
              <div className="text-sm font-medium text-gray-800">
                {THEME_PREVIEWS[selectedTheme]?.name}
              </div>
              {totalOverrides > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  {totalOverrides} color{totalOverrides !== 1 ? 's' : ''} customized
                </div>
              )}
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
