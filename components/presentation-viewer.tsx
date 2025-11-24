"use client"

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Grid3x3, Edit3, Maximize2, Save, X } from 'lucide-react'

interface PresentationViewerProps {
  presentationUrl: string
  presentationId: string | null
  slideCount: number | null
  showControls?: boolean
  onSlideChange?: (slideNumber: number) => void
  onEditModeChange?: (isEditing: boolean) => void
  className?: string
}

interface SlideInfo {
  index: number
  total: number
}

export function PresentationViewer({
  presentationUrl,
  presentationId,
  slideCount,
  showControls = true,
  onSlideChange,
  onEditModeChange,
  className = ''
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeWindow, setIframeWindow] = useState<Window | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1)
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)

  // Initialize iframe window reference on load
  useEffect(() => {
    const handleLoad = () => {
      if (iframeRef.current?.contentWindow) {
        console.log('📺 Presentation iframe loaded successfully')
        setIframeWindow(iframeRef.current.contentWindow)
      }
    }

    const iframe = iframeRef.current
    iframe?.addEventListener('load', handleLoad)

    return () => iframe?.removeEventListener('load', handleLoad)
  }, [presentationUrl])

  // Poll for slide info updates
  useEffect(() => {
    if (!iframeWindow) return

    const interval = setInterval(() => {
      try {
        const info = (iframeWindow as any).getCurrentSlideInfo?.() as SlideInfo | undefined
        if (info) {
          const slideNum = info.index + 1 // Convert 0-based to 1-based
          setCurrentSlide(slideNum)
          setTotalSlides(info.total)
          onSlideChange?.(slideNum)
        }
      } catch (error) {
        console.error('Error getting slide info:', error)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [iframeWindow, onSlideChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!iframeWindow) return

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
  }, [iframeWindow])

  const handleNextSlide = useCallback(() => {
    if (!iframeWindow) return
    try {
      ;(iframeWindow as any).Reveal?.next()
      console.log('➡️ Next slide')
    } catch (error) {
      console.error('Error navigating to next slide:', error)
    }
  }, [iframeWindow])

  const handlePrevSlide = useCallback(() => {
    if (!iframeWindow) return
    try {
      ;(iframeWindow as any).Reveal?.prev()
      console.log('⬅️ Previous slide')
    } catch (error) {
      console.error('Error navigating to previous slide:', error)
    }
  }, [iframeWindow])

  const handleToggleOverview = useCallback(() => {
    if (!iframeWindow) return
    try {
      ;(iframeWindow as any).toggleOverview?.()
      console.log('🔲 Toggled overview mode')
    } catch (error) {
      console.error('Error toggling overview:', error)
    }
  }, [iframeWindow])

  const handleToggleEditMode = useCallback(() => {
    if (!iframeWindow) return
    try {
      ;(iframeWindow as any).toggleEditMode?.()

      // Check if edit mode was actually toggled
      const body = (iframeWindow as any).document?.body
      const newEditMode = body?.getAttribute('data-mode') === 'edit'
      setIsEditMode(newEditMode)
      onEditModeChange?.(newEditMode)

      console.log(`✏️ Edit mode: ${newEditMode ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling edit mode:', error)
    }
  }, [iframeWindow, onEditModeChange])

  const handleSaveChanges = useCallback(async () => {
    if (!iframeWindow) return

    setIsSaving(true)
    try {
      await (iframeWindow as any).saveAllChanges?.()
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
  }, [iframeWindow, onEditModeChange])

  const handleCancelEdits = useCallback(() => {
    if (!iframeWindow) return

    // Confirm before canceling
    if (!confirm('Are you sure you want to discard all changes?')) {
      return
    }

    try {
      ;(iframeWindow as any).cancelEdits?.()
      setIsEditMode(false)
      onEditModeChange?.(false)
      console.log('🚫 Edits canceled')
    } catch (error) {
      console.error('Error canceling edits:', error)
    }
  }, [iframeWindow, onEditModeChange])

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
              disabled={!iframeWindow || currentSlide === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextSlide}
              disabled={!iframeWindow || currentSlide === totalSlides}
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
              disabled={!iframeWindow}
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
                disabled={!iframeWindow}
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
                  disabled={!iframeWindow || isSaving}
                  className="h-8 bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdits}
                  disabled={!iframeWindow || isSaving}
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
          </div>

          {/* Slide Counter */}
          <div className="text-sm font-medium text-gray-600">
            Slide {currentSlide} / {totalSlides}
          </div>
        </div>
      )}

      {/* Presentation Iframe */}
      <div className="flex-1 relative bg-gray-100">
        {presentationUrl ? (
          <iframe
            ref={iframeRef}
            src={presentationUrl}
            className="w-full h-full border-0"
            title="Presentation Viewer"
            allow="fullscreen"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
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
