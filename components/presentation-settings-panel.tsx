"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Upload, Wand2, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Data models matching backend API
interface FooterConfig {
  template: string
  values: {
    title?: string
    date?: string
    author?: string
  }
  style?: {
    color?: string
    fontSize?: string
    fontFamily?: string
  } | null
}

interface LogoConfig {
  image_url: string | null
  alt_text?: string
}

interface DerivativeElements {
  footer?: FooterConfig | null
  logo?: LogoConfig | null
}

interface PresentationSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
  currentSlide: number
  totalSlides: number
  presentationId?: string | null
}

// Common footer templates for quick selection
const FOOTER_TEMPLATES = [
  { label: 'Page only', template: 'Page {page}' },
  { label: 'Page X of Y', template: 'Page {page} of {total}' },
  { label: 'Title + Page', template: '{title} | Page {page}' },
  { label: 'Professional', template: '{title} | {date} | Page {page}' },
]

/**
 * PresentationSettingsPanel Component
 *
 * Slide-out panel for managing derivative elements (footer and logo)
 * that appear consistently across all slides.
 */
export function PresentationSettingsPanel({
  isOpen,
  onClose,
  iframeRef,
  viewerOrigin,
  currentSlide,
  totalSlides,
  presentationId,
}: PresentationSettingsPanelProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false)

  // Footer state
  const [footerTemplate, setFooterTemplate] = useState('')
  const [footerTitle, setFooterTitle] = useState('')
  const [footerDate, setFooterDate] = useState('')
  const [footerAuthor, setFooterAuthor] = useState('')
  const [previewText, setPreviewText] = useState('')

  // Logo state
  const [logoUrl, setLogoUrl] = useState('')
  const [logoAltText, setLogoAltText] = useState('')
  const [logoFileName, setLogoFileName] = useState('')
  const [logoPrompt, setLogoPrompt] = useState('')
  const [showLogoPrompt, setShowLogoPrompt] = useState(false)

  // Track if there are unsaved changes
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
      }, 10000) // 10 second timeout for API calls

      iframeRef.current.contentWindow?.postMessage({ action, params }, viewerOrigin)
    })
  }, [iframeRef, viewerOrigin])

  /**
   * Load current derivative elements when panel opens
   */
  const loadDerivativeElements = useCallback(async () => {
    if (!isOpen) return

    setIsLoading(true)
    try {
      const result = await sendCommand('getDerivativeElements')
      const elements: DerivativeElements | null = result.derivativeElements

      if (elements) {
        // Load footer config
        if (elements.footer) {
          setFooterTemplate(elements.footer.template || '')
          setFooterTitle(elements.footer.values?.title || '')
          setFooterDate(elements.footer.values?.date || '')
          setFooterAuthor(elements.footer.values?.author || '')
        } else {
          setFooterTemplate('')
          setFooterTitle('')
          setFooterDate('')
          setFooterAuthor('')
        }

        // Load logo config
        if (elements.logo) {
          setLogoUrl(elements.logo.image_url || '')
          setLogoAltText(elements.logo.alt_text || '')
          // Extract filename from URL
          if (elements.logo.image_url) {
            const urlParts = elements.logo.image_url.split('/')
            setLogoFileName(urlParts[urlParts.length - 1] || 'logo.png')
          } else {
            setLogoFileName('')
          }
        } else {
          setLogoUrl('')
          setLogoAltText('')
          setLogoFileName('')
        }
      }

      setHasChanges(false)
    } catch (error) {
      console.error('Failed to load derivative elements:', error)
      // Don't show error toast - elements may just not be configured yet
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, sendCommand])

  /**
   * Load elements when panel opens
   */
  useEffect(() => {
    if (isOpen) {
      loadDerivativeElements()
    }
  }, [isOpen, loadDerivativeElements])

  /**
   * Preview footer as user types (debounced)
   */
  const updatePreview = useCallback(async () => {
    if (!footerTemplate) {
      setPreviewText('')
      return
    }

    try {
      const result = await sendCommand('previewFooter', {
        footer: {
          template: footerTemplate,
          values: {
            title: footerTitle,
            date: footerDate,
            author: footerAuthor,
          }
        },
        slideIndex: currentSlide - 1 // Convert to 0-based
      })

      setPreviewText(result.previewText || '')
    } catch (error) {
      // Fallback: do simple local preview
      let preview = footerTemplate
      preview = preview.replace('{title}', footerTitle || '[Title]')
      preview = preview.replace('{page}', String(currentSlide))
      preview = preview.replace('{total}', String(totalSlides))
      preview = preview.replace('{date}', footerDate || '[Date]')
      preview = preview.replace('{author}', footerAuthor || '[Author]')
      setPreviewText(preview)
    }
  }, [footerTemplate, footerTitle, footerDate, footerAuthor, currentSlide, totalSlides, sendCommand])

  /**
   * Debounced preview update
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview()
    }, 300)
    return () => clearTimeout(timer)
  }, [updatePreview])

  /**
   * Mark as changed when any input changes
   */
  const handleInputChange = useCallback(() => {
    setHasChanges(true)
  }, [])

  /**
   * Handle file upload for logo
   */
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, SVG)',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // Upload to Supabase storage via our API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')
      if (presentationId) {
        formData.append('presentationId', presentationId)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setLogoUrl(data.url)
      setLogoFileName(file.name)
      setHasChanges(true)

      toast({
        title: 'Logo uploaded',
        description: 'Your logo has been uploaded successfully'
      })
    } catch (error) {
      console.error('Logo upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Generate logo using AI (Elementor API)
   */
  const handleGenerateLogo = async () => {
    if (!logoPrompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Please describe the logo you want to generate',
        variant: 'destructive'
      })
      return
    }

    setIsGeneratingLogo(true)
    try {
      const response = await fetch('/api/elementor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Logo design: ${logoPrompt}. Professional, clean, minimal, suitable for presentation footer.`,
          width: 200,
          height: 100,
          presentationId
        })
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const data = await response.json()
      setLogoUrl(data.url)
      setLogoFileName('ai-generated-logo.png')
      setShowLogoPrompt(false)
      setLogoPrompt('')
      setHasChanges(true)

      toast({
        title: 'Logo generated',
        description: 'Your AI logo has been generated successfully'
      })
    } catch (error) {
      console.error('Logo generation failed:', error)
      toast({
        title: 'Generation failed',
        description: 'Failed to generate logo. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsGeneratingLogo(false)
    }
  }

  /**
   * Remove logo
   */
  const handleRemoveLogo = () => {
    setLogoUrl('')
    setLogoFileName('')
    setLogoAltText('')
    setHasChanges(true)
  }

  /**
   * Save all changes
   */
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const footer: FooterConfig | null = footerTemplate
        ? {
            template: footerTemplate,
            values: {
              title: footerTitle || undefined,
              date: footerDate || undefined,
              author: footerAuthor || undefined,
            }
          }
        : null

      const logo: LogoConfig | null = logoUrl
        ? {
            image_url: logoUrl,
            alt_text: logoAltText || 'Logo'
          }
        : null

      await sendCommand('updateDerivativeElements', {
        presentationId,
        footer,
        logo
      })

      setHasChanges(false)
      toast({
        title: 'Settings saved',
        description: 'Footer and logo have been updated across all slides'
      })
      onClose()
    } catch (error) {
      console.error('Failed to save derivative elements:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Clear all derivative elements
   */
  const handleClearAll = async () => {
    setIsLoading(true)
    try {
      await sendCommand('clearDerivativeElements', {
        presentationId,
        clearFooter: true,
        clearLogo: true
      })

      // Reset all state
      setFooterTemplate('')
      setFooterTitle('')
      setFooterDate('')
      setFooterAuthor('')
      setLogoUrl('')
      setLogoFileName('')
      setLogoAltText('')
      setPreviewText('')
      setHasChanges(false)

      toast({
        title: 'Settings cleared',
        description: 'Footer and logo have been removed from all slides'
      })
    } catch (error) {
      console.error('Failed to clear derivative elements:', error)
      toast({
        title: 'Clear failed',
        description: 'Failed to clear settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 left-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-semibold text-gray-900">Master</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
          title="Close panel"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Footer Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Footer</h3>
              </div>

              {/* Template Input */}
              <div className="space-y-1.5">
                <Label htmlFor="footer-template" className="text-[10px] text-gray-600">
                  Template
                </Label>
                <Input
                  id="footer-template"
                  value={footerTemplate}
                  onChange={(e) => {
                    setFooterTemplate(e.target.value)
                    handleInputChange()
                  }}
                  placeholder="{title} | Page {page} of {total}"
                  className="h-7 text-[11px]"
                />

                {/* Quick templates */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {FOOTER_TEMPLATES.map((t) => (
                    <button
                      key={t.template}
                      onClick={() => {
                        setFooterTemplate(t.template)
                        handleInputChange()
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {previewText && (
                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <div className="text-[10px] text-gray-500 mb-0.5">Preview:</div>
                  <div className="text-xs text-gray-800 font-medium">{previewText}</div>
                </div>
              )}

              {/* Variables */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-medium text-gray-500">Variables</div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-title" className="text-[10px] text-gray-600">
                    Title <span className="text-gray-400">{'{title}'}</span>
                  </Label>
                  <Input
                    id="footer-title"
                    value={footerTitle}
                    onChange={(e) => {
                      setFooterTitle(e.target.value)
                      handleInputChange()
                    }}
                    placeholder="Presentation title"
                    className="h-7 text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-date" className="text-[10px] text-gray-600">
                    Date <span className="text-gray-400">{'{date}'}</span>
                  </Label>
                  <Input
                    id="footer-date"
                    value={footerDate}
                    onChange={(e) => {
                      setFooterDate(e.target.value)
                      handleInputChange()
                    }}
                    placeholder="December 2024"
                    className="h-7 text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-author" className="text-[10px] text-gray-600">
                    Author <span className="text-gray-400">{'{author}'}</span>
                  </Label>
                  <Input
                    id="footer-author"
                    value={footerAuthor}
                    onChange={(e) => {
                      setFooterAuthor(e.target.value)
                      handleInputChange()
                    }}
                    placeholder="Author name"
                    className="h-7 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Logo Section */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Logo</h3>

              {/* Logo Preview */}
              {logoUrl ? (
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-16 h-12 flex items-center justify-center bg-white rounded border border-gray-200 overflow-hidden">
                    <img
                      src={logoUrl}
                      alt={logoAltText || 'Logo preview'}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {logoFileName || 'Logo'}
                    </div>
                    <button
                      onClick={handleRemoveLogo}
                      className="text-xs text-red-600 hover:text-red-700 mt-1 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <div className="text-center">
                    <ImageIcon className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
                    <div className="text-[11px] text-gray-500">No logo configured</div>
                  </div>
                </div>
              )}

              {/* Logo Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-7 text-[11px]"
                >
                  <Upload className="h-3 w-3 mr-1.5" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLogoPrompt(!showLogoPrompt)}
                  className="flex-1 h-7 text-[11px]"
                >
                  <Wand2 className="h-3 w-3 mr-1.5" />
                  Generate
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              {/* AI Generation Prompt */}
              {showLogoPrompt && (
                <div className="space-y-1.5 p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                  <Label htmlFor="logo-prompt" className="text-[10px] text-purple-700">
                    Describe your logo
                  </Label>
                  <Input
                    id="logo-prompt"
                    value={logoPrompt}
                    onChange={(e) => setLogoPrompt(e.target.value)}
                    placeholder="A modern tech company logo with..."
                    className="h-7 text-[11px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleGenerateLogo}
                    disabled={isGeneratingLogo || !logoPrompt.trim()}
                    className="w-full h-7 text-[11px] bg-purple-600 hover:bg-purple-700"
                  >
                    {isGeneratingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Logo
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Direct URL Input */}
              <div className="space-y-1.5">
                <Label htmlFor="logo-url" className="text-[10px] text-gray-600">
                  Or enter URL directly
                </Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value)
                    setLogoFileName('')
                    handleInputChange()
                  }}
                  placeholder="https://example.com/logo.png"
                  className="h-7 text-[11px]"
                />
              </div>

              {/* Alt Text */}
              {logoUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="logo-alt" className="text-[10px] text-gray-600">
                    Alt text (for accessibility)
                  </Label>
                  <Input
                    id="logo-alt"
                    value={logoAltText}
                    onChange={(e) => {
                      setLogoAltText(e.target.value)
                      handleInputChange()
                    }}
                    placeholder="Company Logo"
                    className="h-7 text-[11px]"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 space-y-1.5">
        {/* Clear All Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          disabled={isLoading || isSaving}
          className="w-full h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3 mr-1.5" />
          Clear All Settings
        </Button>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 h-7 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex-1 h-7 text-[11px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
