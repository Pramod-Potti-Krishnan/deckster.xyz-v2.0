"use client"

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Grid3x3, Edit3, Maximize2, Save, X } from 'lucide-react'

interface PresentationViewerProps {
  presentationUrl: string
  presentationId: string | null
  slideCount: number | null
  showControls?: boolean
  downloadControls?: React.ReactNode
  onSlideChange?: (slideNumber: number) => void
  onEditModeChange?: (isEditing: boolean) => void
  className?: string
}

interface SlideInfo {
  index: number
  total: number
}

// Viewer origin for postMessage communication
const VIEWER_ORIGIN = 'https://web-production-f0d13.up.railway.app'

/**
 * Send command to iframe via postMessage (cross-origin safe)
 */
function sendCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!iframe) {
      reject(new Error('Iframe not ready'))
      return
    }

    const handler = (event: MessageEvent) => {
      // Only accept messages from viewer origin
      if (event.origin !== VIEWER_ORIGIN) return

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

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('Command timeout'))
    }, 5000)

    iframe.contentWindow?.postMessage({ action, params }, VIEWER_ORIGIN)
  })
}

export function PresentationViewer({
  presentationUrl,
  presentationId,
  slideCount,
  showControls = true,
  downloadControls,
  onSlideChange,
  onEditModeChange,
  className = ''
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1)
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)

  // Poll for slide info updates via postMessage
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!iframeRef.current) return

      try {
        const result = await sendCommand(iframeRef.current, 'getCurrentSlideInfo')
        if (result.success && result.data) {
          const slideNum = result.data.index + 1 // Convert 0-based to 1-based
          setCurrentSlide(slideNum)
          setTotalSlides(result.data.total)
          onSlideChange?.(slideNum)
        }
      } catch (error) {
        // Silently fail during polling - iframe might not be ready yet
      }
    }, 500)

    return () => clearInterval(interval)
  }, [onSlideChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!iframeRef.current) return

      // Only handle if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          handleNextSlide()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          handlePrevSlide()
          break
        case 'Escape':
          e.preventDefault()
          handleToggleOverview()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextSlide, handlePrevSlide, handleToggleOverview])

  const handleNextSlide = useCallback(async () => {
    if (!iframeRef.current) return
    try {
      await sendCommand(iframeRef.current, 'nextSlide')
      console.log('➡️ Next slide')
    } catch (error) {
      console.error('Error navigating to next slide:', error)
    }
  }, [])

  const handlePrevSlide = useCallback(async () => {
    if (!iframeRef.current) return
    try {
      await sendCommand(iframeRef.current, 'prevSlide')
      console.log('⬅️ Previous slide')
    } catch (error) {
      console.error('Error navigating to previous slide:', error)
    }
  }, [])

  const handleToggleOverview = useCallback(async () => {
    if (!iframeRef.current) return
    try {
      const result = await sendCommand(iframeRef.current, 'toggleOverview')
      console.log(`🔲 Overview mode: ${result.isOverview ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling overview:', error)
    }
  }, [])

  const handleToggleEditMode = useCallback(async () => {
    if (!iframeRef.current) return
    try {
      const result = await sendCommand(iframeRef.current, 'toggleEditMode')
      const newEditMode = result.isEditing
      setIsEditMode(newEditMode)
      onEditModeChange?.(newEditMode)

      console.log(`✏️ Edit mode: ${newEditMode ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling edit mode:', error)
    }
  }, [onEditModeChange])

  const handleSaveChanges = useCallback(async () => {
    if (!iframeRef.current) return

    setIsSaving(true)
    try {
      await sendCommand(iframeRef.current, 'saveAllChanges')
      console.log('💾 Changes saved successfully')

      // Exit edit mode after saving
      setIsEditMode(false)
      onEditModeChange?.(false)
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [onEditModeChange])

  const handleCancelEdits = useCallback(async () => {
    if (!iframeRef.current) return

    // Confirm before canceling
    if (!confirm('Are you sure you want to discard all changes?')) {
      return
    }

    try {
      await sendCommand(iframeRef.current, 'cancelEdits')
      setIsEditMode(false)
      onEditModeChange?.(false)
      console.log('🚫 Edits canceled')
    } catch (error) {
      console.error('Error canceling edits:', error)
    }
  }, [onEditModeChange])

  const handleFullscreen = useCallback(() => {
    if (!presentationId) return
    // This will be handled by parent component - just notify
    window.open(`/presentation/${presentationId}`, '_blank')
  }, [presentationId])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Control Toolbar */}
      {showControls && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevSlide}
              disabled={currentSlide === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextSlide}
              disabled={currentSlide === totalSlides}
              className="h-8"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>

            {/* Overview */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleOverview}
              className="h-8"
              title="Grid view (Esc)"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>

            {/* Edit Mode Toggle */}
            {!isEditMode ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleEditMode}
                className="h-8"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="h-8 bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdits}
                  disabled={isSaving}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </>
            )}

            {/* Fullscreen */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleFullscreen}
              disabled={!presentationId}
              className="h-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            {/* Divider */}
            {downloadControls && <div className="h-6 w-px bg-gray-300 mx-2" />}

            {/* Download Controls */}
            {downloadControls}
          </div>

          {/* Slide Counter */}
          <div className="text-sm font-medium text-gray-600">
            Slide {currentSlide} / {totalSlides}
          </div>
        </div>
      )}

      {/* Presentation Iframe */}
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center p-8">
        {presentationUrl ? (
          <div className="w-full max-w-7xl" style={{ aspectRatio: '16/9' }}>
            <iframe
              ref={iframeRef}
              src={presentationUrl}
              className="w-full h-full border-0 rounded-lg shadow-2xl"
              title="Presentation Viewer"
              allow="fullscreen"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center text-gray-400">
            <p>No presentation to display</p>
          </div>
        )}
      </div>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800">
          <strong>Edit Mode:</strong> Click on any text in the presentation to edit. Click "Save" when done or "Cancel" to discard changes.
        </div>
      )}
    </div>
  )
}
