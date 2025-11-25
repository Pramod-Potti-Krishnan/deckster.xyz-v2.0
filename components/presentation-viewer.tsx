"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Grid3x3, Edit3, Maximize2, Minimize2, Save, X } from 'lucide-react'
import { SlideThumbnailStrip, SlideThumbnail } from './slide-thumbnail-strip'

interface PresentationViewerProps {
  presentationUrl: string
  presentationId: string | null
  slideCount: number | null
  slideStructure?: any // SlideUpdate payload from WebSocket
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
  slideStructure,
  showControls = true,
  downloadControls,
  onSlideChange,
  onEditModeChange,
  className = ''
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0) // Start at 0 until we get real data
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true) // For auto-hide in fullscreen

  // Extract slide thumbnails from slideStructure
  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {
    if (!slideStructure || !slideStructure.slides) {
      // If no slide structure, generate basic thumbnails based on slideCount
      if (totalSlides > 0) {
        return Array.from({ length: totalSlides }, (_, i) => ({
          slideNumber: i + 1,
          title: `Slide ${i + 1}`
        }))
      }
      return []
    }

    // Extract titles from slide structure
    return slideStructure.slides.map((slide: any, index: number) => ({
      slideNumber: index + 1,
      title: slide.title || slide.slide_type || `Slide ${index + 1}`,
      content: slide.narrative || slide.key_points?.join(', ')
    }))
  }, [slideStructure, totalSlides])

  // Define handlers FIRST (before effects that use them)
  const handleNextSlide = useCallback(async () => {
    console.log('🔘 Next button clicked!')
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      await sendCommand(iframeRef.current, 'nextSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide < (totalSlides || 999)) {
        const newSlide = currentSlide + 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        console.log(`➡️ Next slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('Error navigating to next slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handlePrevSlide = useCallback(async () => {
    console.log('🔘 Prev button clicked!')
    console.log(`   Current slide: ${currentSlide}, Total: ${totalSlides}`)
    console.log(`   Button should be disabled: ${currentSlide <= 1}`)
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      console.log('📤 Sending prevSlide command...')
      await sendCommand(iframeRef.current, 'prevSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide > 1) {
        const newSlide = currentSlide - 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        console.log(`⬅️ Previous slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('❌ Error navigating to previous slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handleToggleOverview = useCallback(() => {
    console.log('🔘 Grid button clicked - toggling thumbnail strip!')
    setShowThumbnails(prev => !prev)
  }, [])

  const handleGoToSlide = useCallback(async (slideIndex: number) => {
    console.log(`🎯 Navigating to slide ${slideIndex + 1}`)
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      const result = await sendCommand(iframeRef.current, 'goToSlide', { index: slideIndex })
      console.log(`✅ Navigated to slide ${slideIndex + 1}`)
      setCurrentSlide(slideIndex + 1)
    } catch (error) {
      console.error('Error navigating to slide:', error)
    }
  }, [])

  // Poll for slide info updates via postMessage
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!iframeRef.current) return

      try {
        const result = await sendCommand(iframeRef.current, 'getCurrentSlideInfo')
        if (result.success && result.data) {
          const slideNum = result.data.index + 1 // Convert 0-based to 1-based
          console.log(`📊 Slide info: ${slideNum} / ${result.data.total}`)
          setCurrentSlide(slideNum)
          setTotalSlides(result.data.total)
          onSlideChange?.(slideNum)
        }
      } catch (error) {
        // Silently fail during polling - iframe might not be ready yet
        console.log('⏸️ Polling failed (iframe not ready)')
      }
    }, 500)

    return () => clearInterval(interval)
  }, [onSlideChange])

  // Keyboard shortcuts (handlers are now defined above)
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

  const handleToggleEditMode = useCallback(async () => {
    console.log('🔘 Edit button clicked!')
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
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

  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
        console.log('🖥️ Entered fullscreen mode')
      } else {
        // Exit fullscreen
        await document.exitFullscreen()
        setIsFullscreen(false)
        console.log('🖥️ Exited fullscreen mode')
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error)
    }
  }, [])

  // Debug: Log button states
  useEffect(() => {
    console.log(`🎯 Button states - currentSlide: ${currentSlide}, totalSlides: ${totalSlides}`)
    console.log(`   Prev disabled: ${currentSlide === 1}`)
    console.log(`   Next disabled: ${currentSlide === totalSlides}`)
  }, [currentSlide, totalSlides])

  // Handle fullscreen change events (user presses ESC or F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement
      setIsFullscreen(isNowFullscreen)
      // When entering fullscreen, hide toolbar initially
      if (isNowFullscreen) {
        setShowToolbar(false)
      } else {
        setShowToolbar(true)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Auto-hide toolbar in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return

    let hideTimeout: NodeJS.Timeout

    const handleMouseMove = (e: MouseEvent) => {
      // Show toolbar if mouse is near top (within 100px)
      if (e.clientY < 100) {
        setShowToolbar(true)
        // Hide again after 3 seconds of no movement
        clearTimeout(hideTimeout)
        hideTimeout = setTimeout(() => {
          setShowToolbar(false)
        }, 3000)
      } else {
        // Hide toolbar if mouse is away from top
        setShowToolbar(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(hideTimeout)
    }
  }, [isFullscreen])

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className} ${isFullscreen ? 'bg-gray-800' : ''}`}>
      {/* Control Toolbar */}
      {showControls && (
        <div className={`flex items-center justify-between px-4 py-2 bg-gray-50 border-b transition-all duration-300 ${
          isFullscreen && !showToolbar ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
        }`}>
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevSlide}
              disabled={false}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextSlide}
              disabled={totalSlides ? currentSlide >= totalSlides : false}
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
              className="h-8"
              title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Divider */}
            {downloadControls && <div className="h-6 w-px bg-gray-300 mx-2" />}

            {/* Download Controls */}
            {downloadControls}
          </div>

          {/* Slide Counter */}
          <div className="text-sm font-medium text-gray-600">
            Slide {currentSlide} / {totalSlides || '?'}
          </div>
        </div>
      )}

      {/* Main Content Area - Flex container for slide and thumbnails */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Presentation Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Presentation Iframe */}
          <div className={`flex-1 relative bg-gray-800 flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-8'}`}>
            {presentationUrl ? (
              <div className={`w-full ${isFullscreen ? 'h-full' : 'max-w-7xl'}`} style={isFullscreen ? undefined : { aspectRatio: '16/9' }}>
                <iframe
                  ref={iframeRef}
                  src={presentationUrl}
                  className={`w-full h-full border-0 ${isFullscreen ? '' : 'rounded-sm shadow-2xl'}`}
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
          {isEditMode && !isFullscreen && (
            <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800">
              <strong>Edit Mode:</strong> Click on any text in the presentation to edit. Click "Save" when done or "Cancel" to discard changes.
            </div>
          )}
        </div>

        {/* Right: Slide Thumbnail Navigation Strip (Vertical) */}
        {showThumbnails && slideThumbnails.length > 0 && !isFullscreen && (
          <div className="w-32 flex-shrink-0">
            <SlideThumbnailStrip
              slides={slideThumbnails}
              currentSlide={currentSlide}
              onSlideClick={(slideNumber) => {
                handleGoToSlide(slideNumber - 1) // Convert 1-based to 0-based index
              }}
              orientation="vertical"
            />
          </div>
        )}
      </div>
    </div>
  )
}
